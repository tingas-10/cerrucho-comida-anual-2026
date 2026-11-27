// Datos de ejemplo del modo demo (sin Firebase). Sólo se cargan en memoria/localStorage.
// Cada miembro de ejemplo tiene usuario = su alias en minúsculas y contraseña "demo123".
import { EDICION_ACTUAL, MIEMBROS_INICIALES } from '../content/config'
import { authEmailFor, normalizeUsername } from '../domain/accounts'
import { defaultPosition } from '../domain/fmo'
import { BYE, tournamentState } from '../domain/truco'
import { rrGames } from '../domain/padelTorneo'
import { demoRegisterAccount } from './auth'
import type { MemoryAdapter } from './memoryAdapter'
import { P } from './paths'
import { OWNER_ID, ensureEdition, ensureOwnerAndDrafts, slugify } from './seed'
import GOLF_CANCHAS from '../content/golf-canchas.json'
import type { BeverageProfile, GolfCourse, LoginDoc, Member, MemberPrivate, PadelMatch, PadelTPair, PadelTournament, Poll, PollResponse, Rsvp, TrucoMatch, TrucoTournament } from './types'

export const DEMO_PASSWORD = 'demo123'
// Usuarios de ejemplo (el id sale de este nombre; lo que se muestra es el apodo actual de MIEMBROS_INICIALES).
export const DEMO_ACTIVE_ALIASES = ['Choclo', 'Facu', 'Felix', 'Marcos', 'Mateo', 'Nacho', 'Pato', 'Pipe', 'Santi', 'Tomi', 'Topo', 'Ucky', 'Saimon', 'Agus']

/** Cuentas de ejemplo para el selector rápido del login demo. */
export function demoAccounts(): Array<{ id: string; label: string; uid: string; email: string }> {
  return [
    { id: OWNER_ID, label: 'Agustín (administrador)', uid: 'demo-owner', email: authEmailFor('agustin', 'demo') },
    ...DEMO_ACTIVE_ALIASES.map((a) => ({ id: 'm-' + slugify(a), label: a === 'Facu' ? 'Facu (presidente)' : (MIEMBROS_INICIALES.find((x) => (x.id ?? 'm-' + slugify(x.alias)) === 'm-' + slugify(a))?.alias ?? a), uid: 'demo-m-' + slugify(a), email: authEmailFor(normalizeUsername(a), 'demo') })),
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

  // Pádel: un torneo como el Tucan Open (2 grupos de 4, pasan 2 cruzados), con la fecha 1 y parte de la 2 jugadas.
  await db.setDoc(P.fmoGuest('g-demo-inv1'), { id: 'g-demo-inv1', name: 'Invitado 1', createdBy: 'owner', createdAt: now, updatedAt: now })
  await db.setDoc(P.fmoGuest('g-demo-inv2'), { id: 'g-demo-inv2', name: 'Invitado 2', createdBy: 'owner', createdAt: now, updatedAt: now })
  const tucanPairs: PadelTPair[] = [
    { id: 'p1', players: ['m-pay', 'm-marcos'] },
    { id: 'p2', players: ['m-francisco', 'm-saimon'] },
    { id: 'p3', players: ['m-tomi', 'm-rodri'] },
    { id: 'p4', players: ['g-demo-inv1', 'g-demo-inv2'] },
    { id: 'p5', players: ['m-santi', 'm-torta'] },
    { id: 'p6', players: ['m-facu', 'm-pipe'] },
    { id: 'p7', players: ['m-mateo', 'm-agus'] },
    { id: 'p8', players: ['owner', 'm-tita'] },
  ]
  const tucan: PadelTournament = {
    id: 'demo-tucan',
    name: 'Tucan Open',
    format: 'groups',
    pairs: tucanPairs,
    games: null,
    groups: [
      { name: 'Grupo A', ids: ['p5', 'p7', 'p4', 'p8'], games: rrGames(['p5', 'p7', 'p4', 'p8']) },
      { name: 'Grupo B', ids: ['p1', 'p3', 'p2', 'p6'], games: rrGames(['p1', 'p3', 'p2', 'p6']) },
    ],
    advance: 2,
    formats: { rr: 'g4', ko: { '2': 's1', '1': 's1' } },
    points: { win: 3, draw: 1, loss: 0 },
    deuce: 'oro',
    date: now,
    place: null,
    createdBy: 'owner',
    updatedBy: 'owner',
    createdAt: now - 3600000,
    updatedAt: now - 3600000,
  }
  await db.setDoc(P.padelTournament(tucan.id), tucan)
  const tucanMatch = (key: string, a: string, b: string, sets: Array<[number, number]>, status: 'PLAYED' | 'LIVE' = 'PLAYED', ago = 1): PadelMatch => ({
    id: `demo-tucan-${key}`,
    playedAt: now - ago * 600000,
    bestOf: 1,
    games: 4,
    pairA: tucanPairs.find((p) => p.id === a)!.players,
    pairB: tucanPairs.find((p) => p.id === b)!.players,
    sets: sets.map(([x, y]) => ({ a: x, b: y })),
    status,
    resultOnly: false,
    winner: null,
    draw: false,
    tournamentId: tucan.id,
    fixtureId: key,
    entrantA: a,
    entrantB: b,
    notes: '',
    createdBy: 'owner',
    updatedBy: 'owner',
    createdAt: now - ago * 600000,
    updatedAt: now - ago * 600000,
    revision: 1,
  })
  for (const m of [
    tucanMatch('G0-0', 'p5', 'p4', [[4, 1]], 'PLAYED', 9),
    tucanMatch('G0-1', 'p7', 'p8', [[3, 4]], 'PLAYED', 8),
    tucanMatch('G1-0', 'p1', 'p2', [[4, 2]], 'PLAYED', 7),
    tucanMatch('G1-1', 'p3', 'p6', [[1, 4]], 'PLAYED', 6),
    tucanMatch('G0-2', 'p5', 'p8', [[4, 3]], 'PLAYED', 4),
    tucanMatch('G1-2', 'p1', 'p6', [], 'LIVE', 1),
  ])
    await db.setDoc(P.padelMatch(m.id), m)

  // Truco: partidos 1 vs 1 y 2 vs 2, uno en vivo, una liga a medio jugar y una eliminación de parejas.
  const tb = { nameA: 'Nosotros', nameB: 'Ellos', log: [], notes: '', createdBy: 'owner', updatedBy: 'owner', createdAt: now, updatedAt: now, revision: 1, tournamentId: null, fixtureId: null, entrantA: null, entrantB: null }
  const truco = (id: string, daysAgo: number, teamA: string[], teamB: string[], scoreA: number, scoreB: number, extra: Partial<TrucoMatch> = {}) =>
    db.setDoc(P.trucoMatch(id), { ...tb, id, playedAt: now - daysAgo * 86400000, size: teamA.length as 1 | 2 | 3, target: 30, teamA, teamB, scoreA, scoreB, status: 'PLAYED', ...extra } satisfies TrucoMatch)
  await truco('demo-t1', 9, ['m-pato'], ['owner'], 30, 24)
  await truco('demo-t2', 7, ['m-choclo', 'm-facu'], ['m-pato', 'm-topo'], 18, 30, { nameA: 'Los del fondo', nameB: 'Los de siempre' })
  await truco('demo-t3', 4, ['owner'], ['m-felix'], 30, 11)
  await truco('demo-t4', 2, ['m-pato'], ['m-choclo'], 0, 0, { resultOnly: true, winner: 'A' })
  await truco('demo-t5', 0, ['m-felix', 'm-nacho'], ['owner', 'm-tomi'], 17, 12, { status: 'LIVE', log: [{ t: 'A', n: 17, at: now }, { t: 'B', n: 12, at: now }] })
  const liga: TrucoTournament = {
    id: 'demo-liga',
    name: 'Liga de noviembre',
    size: 1,
    target: 30,
    format: 'league',
    legs: 1,
    entrants: ['m-pato', 'owner', 'm-choclo', 'm-felix'].map((id) => ({ id, name: id, players: [id] })),
    groups: null,
    advance: null,
    createdBy: 'owner',
    createdAt: now - 6 * 86400000,
    updatedAt: now,
  }
  await db.setDoc(P.trucoTournament(liga.id), liga)
  const ligaFx = tournamentState(liga, []).league!.rounds.flat().slice(0, 3)
  for (const [i, f] of ligaFx.entries()) await truco(`demo-tl${i}`, 5 - i, [f.a!], [f.b!], i === 1 ? 22 : 30, i === 1 ? 30 : 19, { tournamentId: liga.id, fixtureId: f.key, entrantA: f.a, entrantB: f.b })
  const copa: TrucoTournament = {
    id: 'demo-copa',
    name: 'Copa de parejas',
    size: 2,
    target: 30,
    format: 'knockout',
    legs: 1,
    entrants: [
      { id: 'e1', name: 'Pato / Topo', players: ['m-pato', 'm-topo'] },
      { id: 'e2', name: 'Tingas / Tomi', players: ['owner', 'm-tomi'] },
      { id: 'e3', name: 'Choclo / Facu', players: ['m-choclo', 'm-facu'] },
      { id: 'e4', name: 'Felix / Nacho', players: ['m-felix', 'm-nacho'] },
      { id: 'e5', name: 'Pipe / Santi', players: ['m-pipe', 'm-santi'] },
    ],
    groups: null,
    advance: null,
    createdBy: 'owner',
    createdAt: now - 3 * 86400000,
    updatedAt: now,
  }
  await db.setDoc(P.trucoTournament(copa.id), copa)
  const copaR0 = tournamentState(copa, []).knockout!.rounds[0].filter((f) => f.a !== BYE && f.b !== BYE)
  const pl = (eid: string) => copa.entrants.find((e) => e.id === eid)!
  await truco('demo-tc0', 1, pl(copaR0[0].a!).players, pl(copaR0[0].b!).players, 30, 26, { nameA: pl(copaR0[0].a!).name, nameB: pl(copaR0[0].b!).name, tournamentId: copa.id, fixtureId: copaR0[0].key, entrantA: copaR0[0].a, entrantB: copaR0[0].b })

  // Golf: las canchas reales, hándicaps, un 1 vs 1 jugado, una vuelta individual, un four ball en vivo
  // con dos líneas, un desafío pendiente para Pato y una propuesta pendiente de la comisión.
  for (const c of GOLF_CANCHAS as GolfCourse[]) await db.setDoc(P.golfCourse(c.id), { ...c, updatedAt: now })
  const colorada = (GOLF_CANCHAS as GolfCourse[]).find((c) => c.id === 'jockey-colorada')!
  const maylingC = (GOLF_CANCHAS as GolfCourse[]).find((c) => c.id === 'mayling')!
  const par18 = colorada.holes.map((h) => h.par)
  for (const [id, hcp] of [['m-pato', 14], ['m-tomi', 9], ['owner', 22], ['m-choclo', 18], ['m-facu', 26]] as const) await db.setDoc(P.golfPlayer(id), { hcp, history: [{ at: now - 20 * 86400000, hcp, by: id }], updatedAt: now })
  const score = (base: number[], adj: number[]) => base.map((p, i) => p + (adj[i % adj.length] ?? 0))
  const golfBase = { notes: '', createdBy: 'm-pato', updatedBy: 'm-pato', createdAt: now, updatedAt: now, revision: 1, voided: false, lines: [], live: false, challengeId: null }
  const course = (c: GolfCourse) => ({ courseId: c.id, course: { name: c.name, holes: c.holes } })
  await db.setDoc(P.golfRound('demo-g1'), {
    ...golfBase,
    ...course(colorada),
    id: 'demo-g1',
    playedAt: now - 6 * 86400000,
    status: 'PLAYED',
    editableUntil: now - 4 * 86400000,
    mode: 'match',
    useHcp: true,
    entrants: ['m-pato', 'm-tomi'].map((id) => ({ id, players: [id] })),
    cards: {
      'm-pato': { strokes: score(par18, [1, 0, 1, 1, -1, 1]), total: null, hcp: 14 },
      'm-tomi': { strokes: score(par18, [0, 1, 0, 0, 1, 0]), total: null, hcp: 9 },
    },
  })
  await db.setDoc(P.golfRound('demo-g2'), {
    ...golfBase,
    ...course(maylingC),
    id: 'demo-g2',
    playedAt: now - 2 * 86400000,
    status: 'PLAYED',
    editableUntil: now + 86400000,
    mode: 'solo',
    useHcp: true,
    entrants: [{ id: 'm-pato', players: ['m-pato'] }],
    cards: { 'm-pato': { strokes: maylingC.holes.map(() => null), total: 86, hcp: 14 } },
  })
  const half = (adj: number[]) => score(par18, adj).map((v, i) => (i < 7 ? v : null))
  await db.setDoc(P.golfRound('demo-g3'), {
    ...golfBase,
    ...course(colorada),
    id: 'demo-g3',
    playedAt: now - 2 * 3600000,
    status: 'DRAFT',
    editableUntil: null,
    live: true,
    mode: 'fourball',
    useHcp: true,
    entrants: [
      { id: 't1', players: ['m-pato', 'owner'] },
      { id: 't2', players: ['m-tomi', 'm-choclo'] },
      { id: 't3', players: ['m-facu', 'm-felix'] },
    ],
    lines: [
      { id: 'l1', players: ['m-pato', 'owner', 'm-tomi', 'm-choclo'] },
      { id: 'l2', players: ['m-facu', 'm-felix'] },
    ],
    cards: {
      'm-pato': { strokes: half([0, 1, 0, -1]), total: null, hcp: 14 },
      owner: { strokes: half([1, 1, 2, 0]), total: null, hcp: 22 },
      'm-tomi': { strokes: half([0, 0, 1, 0]), total: null, hcp: 9 },
      'm-choclo': { strokes: half([1, 2, 1, 1]), total: null, hcp: 18 },
      'm-facu': { strokes: score(par18, [1, 2, 1]).map((v, i) => (i < 3 ? v : null)), total: null, hcp: 26 },
      'm-felix': { strokes: score(par18, [2, 1, 2]).map((v, i) => (i < 3 ? v : null)), total: null, hcp: 30 },
    },
  })
  const olivosBlanca = (GOLF_CANCHAS as GolfCourse[]).find((c) => c.id === 'olivos-blanca')!
  const par9 = olivosBlanca.holes.map((h) => h.par)
  await db.setDoc(P.golfRound('demo-g4'), {
    ...golfBase,
    ...course(olivosBlanca),
    id: 'demo-g4',
    playedAt: now - 3 * 86400000,
    status: 'PLAYED',
    editableUntil: now - 86400000,
    mode: 'sixes',
    useHcp: false,
    entrants: ['m-pato', 'm-tomi', 'm-choclo'].map((id) => ({ id, players: [id] })),
    cards: {
      'm-pato': { strokes: score(par9, [0, 1, 0, 1, -1, 0, 1, 0, 1]), total: null, hcp: 14 },
      'm-tomi': { strokes: score(par9, [1, 0, 0, 2, 0, 1, 0, 0, 1]), total: null, hcp: 9 },
      'm-choclo': { strokes: score(par9, [1, 1, 2, 0, 1, 1, 1, 0, 2]), total: null, hcp: 18 },
    },
  })
  await db.setDoc(P.golfChallenge('demo-ch1'), {
    id: 'demo-ch1',
    mode: 'match',
    challengers: ['m-choclo'],
    challenged: ['m-pato'],
    playAt: now + 3 * 86400000,
    courseId: 'olivos-blanca-colorada',
    message: 'Te espero en Olivos',
    status: 'PENDING',
    roundId: null,
    createdBy: 'm-choclo',
    createdAt: now - 3600000,
    updatedAt: now - 3600000,
    answeredBy: null,
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
