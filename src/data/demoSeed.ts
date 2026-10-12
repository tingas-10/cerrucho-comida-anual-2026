// Datos de ejemplo del modo demo (sin Firebase). Sólo se cargan en memoria/localStorage.
// Cada miembro de ejemplo tiene usuario = su alias en minúsculas y contraseña "demo123".
import { EDICION_ACTUAL } from '../content/config'
import { authEmailFor, normalizeUsername } from '../domain/accounts'
import { defaultPosition } from '../domain/fmo'
import { demoRegisterAccount } from './auth'
import type { MemoryAdapter } from './memoryAdapter'
import { P } from './paths'
import { OWNER_ID, ensureEdition, ensureOwnerAndDrafts, slugify } from './seed'
import type { BeverageProfile, LoginDoc, Member, MemberPrivate, Poll, PollResponse, Rsvp } from './types'

export const DEMO_PASSWORD = 'demo123'
export const DEMO_ACTIVE_ALIASES = ['Choclo', 'Facu', 'Felix', 'Marcos', 'Mateo', 'Nacho', 'Pato', 'Pipe', 'Santi', 'Tomi', 'Topo', 'Ucky']

/** Cuentas de ejemplo para el selector rápido del login demo. */
export function demoAccounts(): Array<{ id: string; label: string; uid: string; email: string }> {
  return [
    { id: OWNER_ID, label: 'Agustín (administrador)', uid: 'demo-owner', email: authEmailFor('agustin', 'demo') },
    ...DEMO_ACTIVE_ALIASES.map((a) => ({ id: 'm-' + slugify(a), label: a === 'Facu' ? 'Facu (presidente)' : a, uid: 'demo-m-' + slugify(a), email: authEmailFor(normalizeUsername(a), 'demo') })),
  ]
}

export async function seedDemo(db: MemoryAdapter) {
  if (db.size > 0) return
  const now = Date.now()
  const slug = EDICION_ACTUAL.slug
  await ensureOwnerAndDrafts(db)
  await ensureEdition(db)

  // Cuentas de ejemplo: el propietario y algunos miembros activos.
  const birthdays: Record<string, { d: number; m: number }> = { owner: { d: 14, m: 3 }, 'm-choclo': { d: 5, m: 10 }, 'm-facu': { d: 22, m: 10 }, 'm-pato': { d: 9, m: 12 }, 'm-felix': { d: 30, m: 1 }, 'm-nacho': { d: 18, m: 7 } }
  const prefs: Record<string, string> = { 'm-pato': 'Algo para el asado: cuchillo, tabla, delantal.', 'm-choclo': 'Remeras de fútbol, birra artesanal.', 'm-facu': 'Libros de historia y vinos.' }
  for (const acc of demoAccounts()) {
    const username = acc.email.split('.demo@')[0]
    const existing = await db.getDoc<Member>(P.member(acc.id))
    if (!existing) continue
    await db.setDoc<Member>(P.member(acc.id), {
      ...existing,
      status: 'active',
      hasLogin: true,
      profileDone: acc.id !== 'm-mateo',
      birthday: birthdays[acc.id] ?? null,
      giftPrefs: prefs[acc.id] ?? '',
      vao: ['m-choclo', 'm-facu', 'm-marcos', 'm-pato', 'm-pipe', 'm-tomi'].includes(acc.id),
    })
    await db.setDoc(P.uid(acc.uid), { memberId: acc.id })
    await db.setDoc<LoginDoc>(P.login(username), { memberId: acc.id, email: acc.email })
    await db.setDoc<MemberPrivate>(P.memberPrivate(acc.id), { username, authEmail: acc.email, uid: acc.uid, birthYear: 1990, updatedAt: now })
    demoRegisterAccount(acc.email, acc.uid, DEMO_PASSWORD)
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
    ['m-choclo', { level: 40, portions: 4, noAlcohol: false, pct: { fernet: 50, cerveza: 50, vino: 0 }, revision: 1, updatedAt: now }],
    ['m-pato', { level: 70, portions: 7, noAlcohol: false, pct: { fernet: 70, cerveza: 0, vino: 30 }, revision: 1, updatedAt: now }],
    ['m-felix', { level: 0, portions: 0, noAlcohol: true, pct: { fernet: 0, cerveza: 0, vino: 0 }, revision: 1, updatedAt: now }],
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

  // Regalo: monto de referencia ya definido.
  await db.updateDoc(P.gift(slug), { amountCents: 10000000, updatedAt: now })
  await db.updateDoc(P.edition(slug), { 'decisions.regalo': { status: 'CONFIRMED', label: '$ 100.000', confirmedBy: 'owner', confirmedAt: now } })

  // FMO: un invitado y dos partidos de ejemplo.
  await db.setDoc(P.fmoGuest('g-demo-primo'), { id: 'g-demo-primo', name: 'Primo de Topo', createdBy: 'm-topo', createdAt: now, updatedAt: now })
  const fmoPlayers = (a: Array<[string, number]>, b: Array<[string, number]>) => {
    const out: Record<string, { team: 'A' | 'B'; x: number; y: number; goals: number; sub?: boolean }> = {}
    a.forEach(([id, goals], i) => (out[id] = { team: 'A', ...defaultPosition('A', i), goals }))
    b.forEach(([id, goals], i) => (out[id] = { team: 'B', ...defaultPosition('B', i), goals }))
    return out
  }
  const fmoBase = { size: 5, nameA: 'Claros', nameB: 'Oscuros', otherA: 0, otherB: 0, notes: '', createdBy: 'owner', updatedBy: 'owner', createdAt: now, updatedAt: now, revision: 1 }
  await db.setDoc(P.fmoMatch('demo-1'), { ...fmoBase, id: 'demo-1', playedAt: now - 9 * 86400000, status: 'PLAYED', players: fmoPlayers([['owner', 2], ['m-choclo', 1], ['m-facu', 0], ['m-pato', 0], ['m-pipe', 1]], [['m-felix', 1], ['m-marcos', 0], ['m-nacho', 2], ['m-topo', 0], ['g-demo-primo', 0]]) })
  await db.setDoc(P.fmoMatch('demo-2'), { ...fmoBase, id: 'demo-2', playedAt: now - 2 * 86400000, status: 'PLAYED', otherB: 1, players: fmoPlayers([['owner', 0], ['m-felix', 2], ['m-nacho', 0], ['m-santi', 0], ['m-tomi', 0]], [['m-choclo', 1], ['m-facu', 0], ['m-pato', 0], ['m-topo', 0], ['m-ucky', 0]]) })

  // Uno por jugarse, con suplentes.
  const upcoming = fmoPlayers([['m-pato', 0], ['m-choclo', 0], ['m-facu', 0], ['m-topo', 0], ['m-pipe', 0]], [['owner', 0], ['m-felix', 0], ['m-nacho', 0], ['m-santi', 0], ['m-tomi', 0]])
  for (const [id, team] of [['m-ucky', 'A'], ['m-marcos', 'B'], ['g-demo-primo', 'B']] as const) upcoming[id] = { team, x: 50, y: 50, goals: 0, sub: true }
  await db.setDoc(P.fmoMatch('demo-3'), { ...fmoBase, id: 'demo-3', playedAt: now + 3 * 86400000, status: 'DRAFT', players: upcoming })

  // Pádel: dos partidos de ejemplo.
  const padelBase = { status: 'PLAYED' as const, notes: '', createdBy: 'owner', updatedBy: 'owner', createdAt: now, updatedAt: now, revision: 1 }
  await db.setDoc(P.padelMatch('demo-p1'), { ...padelBase, id: 'demo-p1', playedAt: now - 5 * 86400000, bestOf: 3, pairA: ['owner', 'm-pato'], pairB: ['m-facu', 'g-demo-primo'], sets: [{ a: 6, b: 4 }, { a: 3, b: 6 }, { a: 7, b: 5 }] })
  await db.setDoc(P.padelMatch('demo-p2'), { ...padelBase, id: 'demo-p2', playedAt: now - 86400000, bestOf: 1, pairA: ['m-choclo', 'm-felix'], pairB: ['owner', 'm-pato'], sets: [{ a: 4, b: 6 }] })

  // Golf: dos canchas, hándicaps, dos rondas jugadas, una por jugarse y una propuesta pendiente de la comisión.
  const par18 = [4, 4, 3, 5, 4, 4, 3, 4, 5, 4, 3, 4, 5, 4, 4, 3, 4, 5]
  const si18 = [7, 3, 15, 1, 11, 5, 17, 9, 13, 8, 16, 2, 12, 6, 10, 18, 4, 14]
  const holes18 = par18.map((par, i) => ({ par, si: si18[i] }))
  const holes9 = [4, 3, 5, 4, 4, 3, 4, 5, 4].map((par, i) => ({ par, si: [5, 9, 1, 3, 7, 8, 4, 2, 6][i] }))
  await db.setDoc(P.golfCourse('demo-pilar'), { id: 'demo-pilar', name: 'Golf Club Pilar', holes: holes18, archived: false, updatedAt: now })
  await db.setDoc(P.golfCourse('demo-9'), { id: 'demo-9', name: 'Cancha de 9 del barrio', holes: holes9, archived: false, updatedAt: now })
  for (const [id, hcp] of [['m-pato', 14], ['m-tomi', 9], ['owner', 22], ['m-choclo', 18], ['m-facu', 26]] as const) await db.setDoc(P.golfPlayer(id), { hcp, history: [{ at: now - 20 * 86400000, hcp, by: id }], updatedAt: now })
  const score = (base: number[], adj: number[]) => base.map((p, i) => p + (adj[i % adj.length] ?? 0))
  const golfBase = { notes: '', createdBy: 'm-pato', updatedBy: 'm-pato', createdAt: now, updatedAt: now, revision: 1, voided: false }
  await db.setDoc(P.golfRound('demo-g1'), {
    ...golfBase,
    id: 'demo-g1',
    playedAt: now - 6 * 86400000,
    status: 'PLAYED',
    editableUntil: now - 4 * 86400000,
    courseId: 'demo-pilar',
    course: { name: 'Golf Club Pilar', holes: holes18 },
    mode: 'stableford',
    useHcp: true,
    entrants: ['m-pato', 'm-tomi', 'owner', 'm-choclo'].map((id) => ({ id, players: [id] })),
    cards: {
      'm-pato': { strokes: score(par18, [1, 0, 1, 1, -1, 1]), total: null, hcp: 14 },
      'm-tomi': { strokes: score(par18, [0, 1, 0, 0, 1, 0]), total: null, hcp: 9 },
      owner: { strokes: score(par18, [1, 2, 1, 1, 2, 0]), total: null, hcp: 22 },
      'm-choclo': { strokes: score(par18, [2, 1, 1, 0, 1, 2]), total: null, hcp: 18 },
    },
  })
  await db.setDoc(P.golfRound('demo-g2'), {
    ...golfBase,
    id: 'demo-g2',
    playedAt: now - 2 * 86400000,
    status: 'PLAYED',
    editableUntil: now + 86400000,
    courseId: 'demo-9',
    course: { name: 'Cancha de 9 del barrio', holes: holes9 },
    mode: 'medal',
    useHcp: true,
    entrants: ['m-pato', 'owner', 'm-facu'].map((id) => ({ id, players: [id] })),
    cards: {
      'm-pato': { strokes: holes9.map(() => null), total: 44, hcp: 14 },
      owner: { strokes: holes9.map(() => null), total: 49, hcp: 22 },
      'm-facu': { strokes: holes9.map(() => null), total: 52, hcp: 26 },
    },
  })
  await db.setDoc(P.golfRound('demo-g3'), {
    ...golfBase,
    id: 'demo-g3',
    playedAt: now + 4 * 86400000,
    status: 'DRAFT',
    editableUntil: null,
    courseId: 'demo-pilar',
    course: { name: 'Golf Club Pilar', holes: holes18 },
    mode: 'fourball',
    useHcp: true,
    entrants: [
      { id: 't1', players: ['m-pato', 'owner'] },
      { id: 't2', players: ['m-tomi', 'm-choclo'] },
    ],
    cards: Object.fromEntries(['m-pato', 'owner', 'm-tomi', 'm-choclo'].map((id) => [id, { strokes: holes18.map(() => null), total: null, hcp: id === 'm-pato' ? 14 : id === 'owner' ? 22 : id === 'm-tomi' ? 9 : 18 }])),
  })
  await db.setDoc(P.golfProposal('demo-gp1'), {
    id: 'demo-gp1',
    type: 'points',
    summary: 'Sistema de puntos: 2 por jugar · 12/8/5/3 a los primeros 4',
    payload: { points: { participation: 2, positions: [12, 8, 5, 3] } },
    proposedBy: 'm-pato',
    approvals: { 'm-pato': now - 3600000 },
    rejections: {},
    status: 'OPEN',
    createdAt: now - 3600000,
    updatedAt: now - 3600000,
    appliedAt: null,
    appliedBy: null,
  })

  // Propuestas de comida pendientes.
  await db.setDoc(P.proposal(slug, 'prop-1'), {
    id: 'prop-1',
    type: 'food',
    authorId: 'm-nacho',
    label: 'Asado en lo de Topo',
    detail: 'Topo tiene parrilla y lugar para 25.',
    state: 'PENDING',
    votes: { 'm-nacho': 'up', 'm-pato': 'up', 'm-felix': 'down', 'm-choclo': 'up' },
    createdAt: now - 7200000,
    updatedAt: now - 7200000,
  })
}
