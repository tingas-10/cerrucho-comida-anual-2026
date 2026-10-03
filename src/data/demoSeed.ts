// Datos de ejemplo del modo demo (sin Firebase). Sólo se cargan en memoria/localStorage.
// Marcan miembros ficticios con mails @demo.test para que se pueda entrar como cualquiera.
import { EDICION_ACTUAL, GRUPO } from '../content/config'
import { P } from './paths'
import type { MemoryAdapter } from './memoryAdapter'
import { ensureEdition, ensureOwnerAndDrafts, newMember, slugify } from './seed'
import type { BeverageProfile, Member, MemberPrivate, Poll, PollResponse, Rsvp } from './types'

export const DEMO_OWNER_UID = 'demo-owner'

export const DEMO_ACTIVE_ALIASES = ['Choclo', 'Facu', 'Felix', 'Marcos', 'Mateo', 'Nacho', 'Pato', 'Pipe', 'Santi', 'Tomi', 'Topo', 'Ucky']

export function demoEmailFor(alias: string): string {
  return `${slugify(alias)}@demo.test`
}

export async function seedDemo(db: MemoryAdapter) {
  if (db.size > 0) return
  const now = Date.now()
  const slug = EDICION_ACTUAL.slug
  await ensureOwnerAndDrafts(db, DEMO_OWNER_UID, GRUPO.ownerEmail)
  await ensureEdition(db)

  // Activar algunos miembros con mail ficticio.
  for (const alias of DEMO_ACTIVE_ALIASES) {
    const id = 'm-' + slugify(alias)
    const existing = await db.getDoc<Member>(P.member(id))
    await db.setDoc(P.member(id), {
      ...(existing ?? newMember(id, alias, now)),
      status: 'active',
      hasEmail: true,
      uid: 'demo-' + id,
      vao: ['Choclo', 'Facu', 'Marcos', 'Pato', 'Pipe', 'Tomi'].includes(alias),
    })
    await db.setDoc<MemberPrivate>(P.memberPrivate(id), { email: demoEmailFor(alias), invitedAt: now })
    await db.setDoc(P.uid('demo-' + id), { memberId: id })
  }
  const activeIds = ['owner', ...DEMO_ACTIVE_ALIASES.map((a) => 'm-' + slugify(a))]

  // Encuesta de fechas abierta con algunas respuestas.
  const day = (offsetDays: number, hour = 21) => {
    const d = new Date(now + offsetDays * 86400000)
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hour + 3, 0)
  }
  const poll: Poll = {
    id: 'fechas-1',
    kind: 'dates',
    title: '¿Qué día nos juntamos?',
    description: 'Marcá todas las fechas en las que podés. Estar disponible todavía no confirma asistencia.',
    method: 'AVAILABILITY',
    state: 'OPEN',
    options: [
      { id: 'd1', label: 'Viernes', startsAt: day(23) },
      { id: 'd2', label: 'Sábado', startsAt: day(24) },
      { id: 'd3', label: 'Viernes siguiente', startsAt: day(30) },
    ],
    electorate: activeIds,
    audience: 'ALL',
    openAt: now - 86400000,
    closeAt: now + 5 * 86400000,
    quorumPct: 70,
    version: 1,
    closure: null,
    decision: null,
    createdAt: now - 86400000,
    updatedAt: now - 86400000,
  }
  await db.setDoc(P.poll(slug, poll.id), poll)
  await db.updateDoc(P.edition(slug), { 'decisions.fecha': { status: 'VOTING', pollId: poll.id }, state: 'ORGANIZING' })
  const answers: Array<[string, Record<string, 'yes' | 'maybe' | 'no'>]> = [
    ['m-choclo', { d1: 'yes', d2: 'yes', d3: 'no' }],
    ['m-facu', { d1: 'no', d2: 'yes', d3: 'maybe' }],
    ['m-felix', { d1: 'yes', d2: 'maybe', d3: 'yes' }],
    ['m-marcos', { d1: 'maybe', d2: 'yes', d3: 'yes' }],
    ['m-pato', { d1: 'yes', d2: 'yes', d3: 'yes' }],
  ]
  for (const [id, payload] of answers) {
    const r: PollResponse = { payload, revision: 1, updatedAt: now - 3600000 }
    await db.setDoc(P.response(slug, poll.id, id), r)
  }

  // Encuesta de monto de regalo en borrador.
  const giftPoll: Poll = {
    id: 'regalo-monto',
    kind: 'gift_amount',
    title: '¿Cuánto ponemos para el amigo invisible?',
    description: 'Monto de referencia por regalo.',
    method: 'SINGLE',
    state: 'DRAFT',
    options: [50000, 75000, 100000, 150000].map((n) => ({ id: 'ars-' + n, label: `$ ${n.toLocaleString('es-AR')}` })),
    electorate: [],
    audience: 'ALL',
    openAt: null,
    closeAt: null,
    quorumPct: 70,
    version: 1,
    closure: null,
    decision: null,
    createdAt: now,
    updatedAt: now,
  }
  await db.setDoc(P.poll(slug, giftPoll.id), giftPoll)

  // Algunas bebidas y RSVP de ejemplo.
  const bev: Array<[string, BeverageProfile]> = [
    ['m-choclo', { portions: 4, noAlcohol: false, pct: { fernet: 50, cerveza: 50, gin: 0, vodka: 0, vino: 0, aperol: 0 }, revision: 1, updatedAt: now }],
    ['m-pato', { portions: 6, noAlcohol: false, pct: { fernet: 70, cerveza: 0, gin: 30, vodka: 0, vino: 0, aperol: 0 }, revision: 1, updatedAt: now }],
    ['m-felix', { portions: 0, noAlcohol: true, pct: { fernet: 0, cerveza: 0, gin: 0, vodka: 0, vino: 0, aperol: 0 }, revision: 1, updatedAt: now }],
  ]
  for (const [id, p] of bev) await db.setDoc(P.beverage(slug, id), p)
  const rsvps: Array<[string, Rsvp['status']]> = [
    ['m-choclo', 'YES'],
    ['m-pato', 'YES'],
    ['m-felix', 'YES'],
    ['m-facu', 'MAYBE'],
  ]
  for (const [id, status] of rsvps) {
    const r: Rsvp = { status, planVersion: 1, afterparty: null, updatedAt: now, revision: 1 }
    await db.setDoc(P.rsvp(slug, id), r)
  }

  // Propuestas de comida pendientes.
  await db.setDoc(P.proposal(slug, 'prop-1'), {
    id: 'prop-1',
    type: 'food',
    authorId: 'm-nacho',
    label: 'Asado en lo de Topo',
    detail: 'Topo tiene parrilla y lugar para 25.',
    state: 'PENDING',
    createdAt: now - 7200000,
    updatedAt: now - 7200000,
  })
}
