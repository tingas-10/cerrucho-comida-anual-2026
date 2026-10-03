// Datos de ejemplo del modo demo (sin Firebase). Sólo se cargan en memoria/localStorage.
// Marcan miembros ficticios con mails @demo.test para que se pueda entrar como cualquiera.
import { EDICION_ACTUAL, GRUPO } from '../content/config'
import { P } from './paths'
import type { MemoryAdapter } from './memoryAdapter'
import { defaultPosition } from '../domain/fmo'
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

  // Respuestas de ejemplo a la consulta real de fechas (la crea ensureEdition).
  const pollId = 'fechas-' + slug
  const datePoll = await db.getDoc<Poll>(P.poll(slug, pollId))
  const ids = (datePoll?.options ?? []).slice(0, 3).map((o) => o.id)
  const [o1, o2, o3] = ids
  const answers: Array<[string, Record<string, 'yes' | 'maybe' | 'no'>]> = [
    ['m-choclo', { [o1]: 'yes', [o2]: 'yes', [o3]: 'no' }],
    ['m-facu', { [o1]: 'no', [o2]: 'yes', [o3]: 'maybe' }],
    ['m-felix', { [o1]: 'yes', [o2]: 'maybe', [o3]: 'yes' }],
    ['m-marcos', { [o1]: 'maybe', [o2]: 'yes', [o3]: 'yes' }],
    ['m-pato', { [o1]: 'yes', [o2]: 'yes', [o3]: 'yes' }],
  ]
  for (const [id, partial] of answers) {
    const payload: Record<string, 'yes' | 'maybe' | 'no'> = {}
    for (const o of datePoll?.options ?? []) payload[o.id] = partial[o.id] ?? 'no'
    const r: PollResponse = { payload, revision: 1, updatedAt: now - 3600000 }
    await db.setDoc(P.response(slug, pollId, id), r)
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
    ['m-choclo', { level: 40, portions: 4, noAlcohol: false, pct: { fernet: 50, cerveza: 50, gin: 0, vodka: 0, vino: 0, aperol: 0 }, revision: 1, updatedAt: now }],
    ['m-pato', { level: 70, portions: 7, noAlcohol: false, pct: { fernet: 70, cerveza: 0, gin: 30, vodka: 0, vino: 0, aperol: 0 }, revision: 1, updatedAt: now }],
    ['m-felix', { level: 0, portions: 0, noAlcohol: true, pct: { fernet: 0, cerveza: 0, gin: 0, vodka: 0, vino: 0, aperol: 0 }, revision: 1, updatedAt: now }],
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

  // Regalo: monto ya definido y dos anotados, para poder probar el sorteo.
  await db.updateDoc(P.gift(slug), { amountCents: 10000000, updatedAt: now })
  await db.updateDoc(P.edition(slug), { 'decisions.regalo': { status: 'CONFIRMED', label: '$ 100.000', confirmedBy: 'owner', confirmedAt: now } })
  for (const id of ['m-choclo', 'm-pato']) {
    await db.setDoc(P.giftParticipant(slug, id), { accepted: true, acceptedBudgetVersion: 1, attending: true, delegateId: null, wishes: id === 'm-pato' ? 'Algo para el asado' : '', avoid: '', updatedAt: now })
  }

  // FMO: un invitado y dos partidos de ejemplo.
  await db.setDoc(P.fmoGuest('g-demo-primo'), { id: 'g-demo-primo', name: 'Primo de Topo', createdBy: 'm-topo', createdAt: now, updatedAt: now })
  const fmoPlayers = (a: Array<[string, number]>, b: Array<[string, number]>) => {
    const out: Record<string, { team: 'A' | 'B'; x: number; y: number; goals: number }> = {}
    a.forEach(([id, goals], i) => (out[id] = { team: 'A', ...defaultPosition('A', i), goals }))
    b.forEach(([id, goals], i) => (out[id] = { team: 'B', ...defaultPosition('B', i), goals }))
    return out
  }
  const fmoBase = { size: 5, nameA: 'Claros', nameB: 'Oscuros', otherA: 0, otherB: 0, notes: '', createdBy: 'owner', updatedBy: 'owner', createdAt: now, updatedAt: now, revision: 1 }
  await db.setDoc(P.fmoMatch('demo-1'), { ...fmoBase, id: 'demo-1', playedAt: now - 9 * 86400000, status: 'PLAYED', players: fmoPlayers([['owner', 2], ['m-choclo', 1], ['m-facu', 0], ['m-pato', 0], ['m-pipe', 1]], [['m-felix', 1], ['m-marcos', 0], ['m-nacho', 2], ['m-topo', 0], ['g-demo-primo', 0]]) })
  await db.setDoc(P.fmoMatch('demo-2'), { ...fmoBase, id: 'demo-2', playedAt: now - 2 * 86400000, status: 'PLAYED', otherB: 1, players: fmoPlayers([['owner', 0], ['m-felix', 2], ['m-nacho', 0], ['m-santi', 0], ['m-tomi', 0]], [['m-choclo', 1], ['m-facu', 0], ['m-pato', 0], ['m-topo', 0], ['m-ucky', 0]]) })

  // Propuestas de comida pendientes.
  await db.setDoc(P.proposal(slug, 'prop-1'), {
    id: 'prop-1',
    type: 'food',
    authorId: 'm-nacho',
    label: 'Asado en lo de Topo',
    detail: 'Topo tiene parrilla y lugar para 25.',
    state: 'PENDING',
    votes: { 'm-nacho': 'up', 'm-pato': 'up', 'm-felix': 'down' },
    createdAt: now - 7200000,
    updatedAt: now - 7200000,
  })
}
