// Reglas puras de truco: quién ganó, malas y buenas, ranking (+1,5 / −1), 1 vs 1, torneos
// (liga, eliminación directa y grupos + eliminación) y la simulación de un mano a mano.
import { TRUCO } from '../content/truco'
import type { TrucoMatch, TrucoTournament } from '../data/types'
import { yearOf } from './fmo'

export type Side = 'A' | 'B'
type MatchLike = Pick<TrucoMatch, 'scoreA' | 'scoreB' | 'target' | 'resultOnly' | 'winner'>

/** Equipo que ganó: el primero en llegar a los puntos del partido (o el que marcaron en "sólo sé quién ganó"). */
export function winnerOf(m: MatchLike): Side | null {
  if (m.resultOnly) return m.winner ?? null
  const a = m.scoreA >= m.target
  const b = m.scoreB >= m.target
  if (a === b) return null
  return a ? 'A' : 'B'
}

export function playersOf(m: Pick<TrucoMatch, 'teamA' | 'teamB'>): string[] {
  return [...m.teamA, ...m.teamB].filter(Boolean)
}

export function sideOf(m: Pick<TrucoMatch, 'teamA' | 'teamB'>, playerId: string): Side | null {
  if (m.teamA.includes(playerId)) return 'A'
  if (m.teamB.includes(playerId)) return 'B'
  return null
}

/** En un partido a 30, los primeros 15 son "las malas" y los otros 15 "las buenas". */
export function malasBuenas(score: number, target: number): { part: 'malas' | 'buenas' | null; inPart: number } {
  if (target !== 30) return { part: null, inPart: Math.min(score, target) }
  const s = Math.min(score, target)
  return s < 15 ? { part: 'malas', inPart: s } : { part: 'buenas', inPart: s - 15 }
}

/** Devuelve null si los equipos están completos, o el motivo. */
export function validateTeams(m: Pick<TrucoMatch, 'teamA' | 'teamB' | 'size'>): string | null {
  const a = m.teamA.filter(Boolean)
  const b = m.teamB.filter(Boolean)
  if (a.length !== m.size || b.length !== m.size) return m.size === 1 ? 'Elegí a los dos que juegan.' : `Cada equipo tiene que tener ${m.size} jugadores.`
  if (new Set([...a, ...b]).size !== a.length + b.length) return 'Hay un jugador repetido.'
  return null
}

/** Devuelve null si el partido se puede guardar como jugado, o el motivo. */
export function validateMatch(m: TrucoMatch): string | null {
  const teams = validateTeams(m)
  if (teams) return teams
  if (m.resultOnly) return m.winner === 'A' || m.winner === 'B' ? null : 'Marcá quién ganó.'
  if (m.scoreA >= m.target && m.scoreB >= m.target) return `Los dos llegaron a ${m.target}: revisá los puntos.`
  if (!winnerOf(m)) return `Nadie llegó a ${m.target} todavía.`
  return null
}

function counted(matches: TrucoMatch[], year?: number, size?: number): TrucoMatch[] {
  return matches.filter((m) => m.status === 'PLAYED' && winnerOf(m) !== null && (year === undefined || yearOf(m.playedAt) === year) && (size === undefined || m.size === size))
}

export interface TrucoStats {
  id: string
  played: number
  won: number
  lost: number
  pointsFor: number // tantos a favor (sólo partidos anotados)
  pointsAgainst: number
  scored: number // partidos con los tantos anotados (base para promedios)
  points: number // ranking: +1,5 por ganado, −1 por perdido
}

export function emptyTrucoStats(id: string): TrucoStats {
  return { id, played: 0, won: 0, lost: 0, pointsFor: 0, pointsAgainst: 0, scored: 0, points: 0 }
}

export function rankingPoints(won: number, lost: number): number {
  return won * TRUCO.puntos.gana + lost * TRUCO.puntos.pierde
}

/** Estadísticas por jugador. `size` filtra por formato (1 vs 1, 2 vs 2, 3 vs 3). */
export function computeTrucoStats(matches: TrucoMatch[], year?: number, size?: number): Record<string, TrucoStats> {
  const out: Record<string, TrucoStats> = {}
  for (const m of counted(matches, year, size)) {
    const w = winnerOf(m)
    for (const side of ['A', 'B'] as const) {
      for (const id of (side === 'A' ? m.teamA : m.teamB).filter(Boolean)) {
        const s = (out[id] ??= emptyTrucoStats(id))
        s.played++
        if (w === side) s.won++
        else s.lost++
        if (!m.resultOnly) {
          s.scored++
          s.pointsFor += Math.min(side === 'A' ? m.scoreA : m.scoreB, m.target)
          s.pointsAgainst += Math.min(side === 'A' ? m.scoreB : m.scoreA, m.target)
        }
      }
    }
  }
  for (const s of Object.values(out)) s.points = rankingPoints(s.won, s.lost)
  return out
}

/** Ranking: puntos, después ganados, después menos jugados. */
export function trucoRanking(stats: Record<string, TrucoStats>): TrucoStats[] {
  return Object.values(stats).sort((x, y) => y.points - x.points || y.won - x.won || x.played - y.played || x.id.localeCompare(y.id))
}

export interface TrucoHeadToHead {
  against: { played: number; aWins: number; bWins: number }
  together: { played: number; won: number; lost: number }
}

export function trucoHeadToHead(matches: TrucoMatch[], a: string, b: string, year?: number): TrucoHeadToHead {
  const out: TrucoHeadToHead = { against: { played: 0, aWins: 0, bWins: 0 }, together: { played: 0, won: 0, lost: 0 } }
  for (const m of counted(matches, year)) {
    const sa = sideOf(m, a)
    const sb = sideOf(m, b)
    if (!sa || !sb) continue
    const w = winnerOf(m)
    if (sa === sb) {
      out.together.played++
      if (w === sa) out.together.won++
      else out.together.lost++
    } else {
      out.against.played++
      if (w === sa) out.against.aWins++
      else out.against.bWins++
    }
  }
  return out
}

export function trucoYears(matches: TrucoMatch[], currentYear: number): number[] {
  const set = new Set<number>([currentYear])
  for (const m of matches) if (m.status === 'PLAYED') set.add(yearOf(m.playedAt))
  return Array.from(set).sort((x, y) => y - x)
}

// ------------------------------------------------------------------
// Simulación de un mano a mano
// ------------------------------------------------------------------

/** Nivel de cada jugador (tipo Elo, arranca en 1000) a partir de todos los partidos, en orden. */
export function trucoRatings(matches: TrucoMatch[]): Record<string, number> {
  const r: Record<string, number> = {}
  const K = 24
  const get = (id: string) => r[id] ?? 1000
  for (const m of counted(matches).sort((x, y) => x.playedAt - y.playedAt)) {
    const a = m.teamA.filter(Boolean)
    const b = m.teamB.filter(Boolean)
    const ra = a.reduce((s, id) => s + get(id), 0) / a.length
    const rb = b.reduce((s, id) => s + get(id), 0) / b.length
    const ea = winProbability(ra, rb)
    const sa = winnerOf(m) === 'A' ? 1 : 0
    for (const id of a) r[id] = get(id) + K * (sa - ea)
    for (const id of b) r[id] = get(id) + K * (1 - sa - (1 - ea))
  }
  return r
}

export function winProbability(ra: number, rb: number): number {
  return 1 / (1 + Math.pow(10, (rb - ra) / 400))
}

/** Números al azar repetibles (misma semilla, misma simulación). */
export function rng(seed: number): () => number {
  let t = seed >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let x = Math.imul(t ^ (t >>> 15), 1 | t)
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

export interface SimHand {
  n: number
  lines: string[] // qué pasó en la mano
  a: number // puntos que sumó cada uno en la mano
  b: number
  totalA: number
  totalB: number
}

export interface SimMatch {
  hands: SimHand[]
  scoreA: number
  scoreB: number
  winner: Side
}

/** Simula un partido mano por mano. `q` es la chance de que A gane cada canto o mano. */
export function simulateMatch(target: number, q: number, rand: () => number, nameA = 'A', nameB = 'B'): SimMatch {
  let A = 0
  let B = 0
  const hands: SimHand[] = []
  const name = (s: Side) => (s === 'A' ? nameA : nameB)
  const pick = (): Side => (rand() < q ? 'A' : 'B')
  const other = (s: Side): Side => (s === 'A' ? 'B' : 'A')
  for (let n = 1; n <= 200 && A < target && B < target; n++) {
    const lines: string[] = []
    let a = 0
    let b = 0
    const add = (s: Side, pts: number) => {
      if (s === 'A') a += pts
      else b += pts
    }
    // Envido
    if (rand() < 0.55) {
      const singer: Side = rand() < 0.5 ? 'A' : 'B'
      const r = rand()
      if (r < 0.28) {
        add(singer, 1)
        lines.push(`${name(singer)} cantó envido y no se lo quisieron: +1.`)
      } else {
        const [label, pts] = r < 0.68 ? ['Envido', 2] : r < 0.84 ? ['Real envido', 3] : r < 0.95 ? ['Envido y real envido', 5] : ['Falta envido', Math.max(1, target - Math.max(A, B))]
        const w = pick()
        const hi = 25 + Math.floor(rand() * 9) // 25 a 33
        const lo = 20 + Math.floor(rand() * Math.max(1, hi - 20))
        add(w, pts)
        lines.push(`${label} querido: ${name(w)} tenía ${hi} contra ${lo}. +${pts} para ${name(w)}.`)
      }
    }
    // Truco
    if (A + a < target && B + b < target) {
      const r = rand()
      const caller: Side = rand() < 0.5 ? 'A' : 'B'
      if (r < 0.22) {
        const w = pick()
        add(w, 1)
        lines.push(`Nadie cantó truco: ${name(w)} se lleva la mano. +1.`)
      } else if (r < 0.44) {
        add(caller, 1)
        lines.push(`${name(caller)} cantó truco y ${name(other(caller))} no quiso: +1.`)
      } else if (r < 0.74) {
        const w = pick()
        add(w, 2)
        lines.push(`Truco querido: lo ganó ${name(w)}. +2.`)
      } else if (r < 0.84) {
        add(other(caller), 2)
        lines.push(`Retruco de ${name(other(caller))} y no lo quisieron: +2.`)
      } else if (r < 0.95) {
        const w = pick()
        add(w, 3)
        lines.push(`Retruco querido: lo ganó ${name(w)}. +3.`)
      } else {
        const w = pick()
        add(w, 4)
        lines.push(`¡Vale cuatro querido! Lo ganó ${name(w)}. +4.`)
      }
    }
    A += a
    B += b
    hands.push({ n, lines, a, b, totalA: Math.min(A, target), totalB: Math.min(B, target) })
  }
  return { hands, scoreA: Math.min(A, target), scoreB: Math.min(B, target), winner: A >= target ? 'A' : 'B' }
}

/** Cuántos de `n` partidos simulados gana A. */
export function simulateMany(target: number, q: number, n: number, seed: number): number {
  const rand = rng(seed)
  let wins = 0
  for (let i = 0; i < n; i++) if (simulateMatch(target, q, rand).winner === 'A') wins++
  return wins
}

const handCache = new Map<string, number>()
/** Chance por mano que hace que A gane el partido con probabilidad `p` (se calibra simulando). */
export function handProbability(p: number, target: number): number {
  const pp = Math.round(Math.min(0.97, Math.max(0.03, p)) * 100) / 100
  if (pp === 0.5) return 0.5
  const key = `${pp}:${target}`
  const hit = handCache.get(key)
  if (hit !== undefined) return hit
  let lo = 0.2
  let hi = 0.8
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) / 2
    if (simulateMany(target, mid, 500, 7) / 500 < pp) lo = mid
    else hi = mid
  }
  const q = (lo + hi) / 2
  handCache.set(key, q)
  return q
}

// ------------------------------------------------------------------
// Torneos
// ------------------------------------------------------------------

export const BYE = '__libre' // lugar vacío en la llave (el rival pasa solo)

export interface FixtureResult {
  winner: string // participante que ganó
  scoreA: number
  scoreB: number
  resultOnly: boolean
  matchId: string
}

export interface Fixture {
  key: string
  round: number
  a: string | null // null = todavía no se sabe quién juega
  b: string | null
  result: FixtureResult | null
  openMatchId: string | null // partido armado o en juego, sin terminar
}

export interface TableRow {
  id: string
  pj: number
  pg: number
  pp: number
  tf: number // tantos a favor
  tc: number
}

/** Todos contra todos (método del círculo). Con 2 vueltas, la vuelta invierte quién es A y B. */
export function roundRobin(ids: string[], legs: 1 | 2 = 1): Array<Array<[string, string]>> {
  const list = ids.length % 2 ? [...ids, BYE] : [...ids]
  const n = list.length
  const rounds: Array<Array<[string, string]>> = []
  let arr = [...list]
  for (let r = 0; r < n - 1; r++) {
    const pairs: Array<[string, string]> = []
    for (let i = 0; i < n / 2; i++) {
      const x = arr[i]
      const y = arr[n - 1 - i]
      if (x !== BYE && y !== BYE) pairs.push(r % 2 ? [y, x] : [x, y])
    }
    rounds.push(pairs)
    arr = [arr[0], arr[n - 1], ...arr.slice(1, n - 1)]
  }
  if (legs === 2) return [...rounds, ...rounds.map((pairs) => pairs.map(([x, y]) => [y, x] as [string, string]))]
  return rounds
}

/** Orden de las cabezas de serie en una llave de `size` (1 contra el último, 2 del otro lado). */
export function seedOrder(size: number): number[] {
  let s = [1]
  while (s.length < size) {
    const m = s.length * 2 + 1
    s = s.flatMap((x) => [x, m - x])
  }
  return s
}

export function roundName(ties: number): string {
  if (ties === 1) return 'Final'
  if (ties === 2) return 'Semifinales'
  if (ties === 4) return 'Cuartos de final'
  if (ties === 8) return 'Octavos de final'
  return `Ronda de ${ties * 2}`
}

function results(t: TrucoTournament, matches: TrucoMatch[]) {
  const done: Record<string, FixtureResult & { a: string; b: string }> = {}
  const open: Record<string, string> = {}
  for (const m of matches) {
    if (m.tournamentId !== t.id || !m.fixtureId) continue
    if (m.status === 'PLAYED') {
      const w = winnerOf(m)
      if (!w || !m.entrantA || !m.entrantB) continue
      done[m.fixtureId] = { winner: w === 'A' ? m.entrantA : m.entrantB, a: m.entrantA, b: m.entrantB, scoreA: m.scoreA, scoreB: m.scoreB, resultOnly: !!m.resultOnly, matchId: m.id }
    } else open[m.fixtureId] = m.id
  }
  return { done, open }
}

function fixture(key: string, round: number, a: string | null, b: string | null, res: ReturnType<typeof results>): Fixture {
  const r = res.done[key]
  // Si cambió quién juega ese cruce (se corrigió un resultado anterior), el resultado viejo no vale.
  const valid = r && a && b && ((r.a === a && r.b === b) || (r.a === b && r.b === a))
  const result = valid ? { winner: r.winner, scoreA: r.a === a ? r.scoreA : r.scoreB, scoreB: r.a === a ? r.scoreB : r.scoreA, resultOnly: r.resultOnly, matchId: r.matchId } : null
  return { key, round, a, b, result, openMatchId: result ? null : (res.open[key] ?? null) }
}

/** Tabla de posiciones: ganados, después diferencia de tantos, después tantos a favor. */
export function standings(ids: string[], fixtures: Fixture[]): TableRow[] {
  const rows: Record<string, TableRow> = Object.fromEntries(ids.map((id) => [id, { id, pj: 0, pg: 0, pp: 0, tf: 0, tc: 0 }]))
  for (const f of fixtures) {
    if (!f.result || !f.a || !f.b || !rows[f.a] || !rows[f.b]) continue
    for (const [me, mine, theirs] of [
      [f.a, f.result.scoreA, f.result.scoreB],
      [f.b, f.result.scoreB, f.result.scoreA],
    ] as const) {
      const row = rows[me]
      row.pj++
      if (f.result.winner === me) row.pg++
      else row.pp++
      if (!f.result.resultOnly) {
        row.tf += mine
        row.tc += theirs
      }
    }
  }
  return ids.map((id) => rows[id]).sort((x, y) => y.pg - x.pg || y.tf - y.tc - (x.tf - x.tc) || y.tf - x.tf || ids.indexOf(x.id) - ids.indexOf(y.id))
}

/** Llave de eliminación directa armada con `seeds` (en orden de cabeza de serie). Los lugares vacíos pasan solos. */
export function knockout(prefix: string, seeds: Array<string | null>, res: ReturnType<typeof results>): Fixture[][] {
  const n = seeds.length
  if (n < 2) return []
  let size = 1
  while (size < n) size *= 2
  const order = seedOrder(size)
  const rounds: Fixture[][] = []
  const first: Fixture[] = []
  for (let i = 0; i < size / 2; i++) {
    const a = order[2 * i] <= n ? seeds[order[2 * i] - 1] : BYE
    const b = order[2 * i + 1] <= n ? seeds[order[2 * i + 1] - 1] : BYE
    first.push(fixture(`${prefix}-0-${i}`, 0, a, b, res))
  }
  rounds.push(first)
  const winnerOfFixture = (f: Fixture): string | null => {
    if (f.a === BYE && f.b === BYE) return BYE
    if (f.a === BYE) return f.b
    if (f.b === BYE) return f.a
    return f.result?.winner ?? null
  }
  for (let r = 1; rounds[r - 1].length > 1; r++) {
    const prev = rounds[r - 1]
    const cur: Fixture[] = []
    for (let i = 0; i < prev.length / 2; i++) cur.push(fixture(`${prefix}-${r}-${i}`, r, winnerOfFixture(prev[2 * i]), winnerOfFixture(prev[2 * i + 1]), res))
    rounds.push(cur)
  }
  return rounds
}

export function fixtureWinner(f: Fixture): string | null {
  if (f.a === BYE) return f.b
  if (f.b === BYE) return f.a
  return f.result?.winner ?? null
}

/** ¿Este cruce se juega? (no es un pase libre y ya se sabe quiénes son) */
export function playable(f: Fixture): boolean {
  return !!f.a && !!f.b && f.a !== BYE && f.b !== BYE
}

export interface TournamentState {
  league: { rounds: Fixture[][]; table: TableRow[]; done: boolean } | null
  groups: Array<{ name: string; ids: string[]; rounds: Fixture[][]; table: TableRow[]; done: boolean }> | null
  knockout: { rounds: Fixture[][]; ready: boolean } | null
  qualifiers: string[] // grupos: los que pasan, en orden de cabeza de serie
  champion: string | null
  played: number
  total: number // cruces que se juegan (sin contar pases libres ni los que todavía no se saben)
}

/** Estado del torneo armado a partir de sus partidos: tablas, cruces, llave y campeón. */
export function tournamentState(t: TrucoTournament, matches: TrucoMatch[]): TournamentState {
  const res = results(t, matches)
  const ids = t.entrants.map((e) => e.id)
  const mk = (prefix: string, list: string[]) => roundRobin(list, t.legs).map((pairs, r) => pairs.map(([a, b], i) => fixture(`${prefix}-${r}-${i}`, r, a, b, res)))
  const count = (rounds: Fixture[][]) => {
    const all = rounds.flat().filter(playable)
    return { played: all.filter((f) => f.result).length, total: all.length }
  }
  if (t.format === 'league') {
    const rounds = mk('L', ids)
    const c = count(rounds)
    const table = standings(ids, rounds.flat())
    const done = c.total > 0 && c.played === c.total
    return { league: { rounds, table, done }, groups: null, knockout: null, qualifiers: [], champion: done ? table[0].id : null, ...c }
  }
  if (t.format === 'knockout') {
    const rounds = knockout('K', ids, res)
    const c = count(rounds)
    const final = rounds[rounds.length - 1]?.[0]
    return { league: null, groups: null, knockout: { rounds, ready: true }, qualifiers: [], champion: final ? fixtureWinner(final) : null, ...c }
  }
  const groups = (t.groups ?? []).map((g, gi) => {
    const rounds = mk(`G${gi}`, g.ids)
    const c = count(rounds)
    return { name: g.name, ids: g.ids, rounds, table: standings(g.ids, rounds.flat()), done: c.total > 0 && c.played === c.total }
  })
  const ready = groups.length > 0 && groups.every((g) => g.done)
  const k = t.advance === 'all' || !t.advance ? Infinity : t.advance
  const byPos: string[] = []
  const maxLen = Math.max(0, ...groups.map((g) => g.table.length))
  for (let pos = 0; pos < Math.min(k, maxLen); pos++) {
    const tier = groups.map((g) => g.table[pos]).filter(Boolean)
    tier.sort((x, y) => y.pg - x.pg || y.tf - y.tc - (x.tf - x.tc) || y.tf - x.tf)
    byPos.push(...tier.map((r) => r.id))
  }
  const ko = ready ? knockout('K', byPos, res) : []
  const groupCount = groups.reduce((acc, g) => {
    const c = count(g.rounds)
    return { played: acc.played + c.played, total: acc.total + c.total }
  }, { played: 0, total: 0 })
  const koCount = count(ko)
  const final = ko[ko.length - 1]?.[0]
  return {
    league: null,
    groups,
    knockout: { rounds: ko, ready },
    qualifiers: byPos,
    champion: final ? fixtureWinner(final) : null,
    played: groupCount.played + koCount.played,
    total: groupCount.total + koCount.total,
  }
}

/** Reparte en `n` grupos parejos, en el orden dado (ya sorteado o por ranking, en zigzag). */
export function splitGroups(ids: string[], n: number): Array<{ name: string; ids: string[] }> {
  const groups = Array.from({ length: n }, (_, i) => ({ name: `Grupo ${String.fromCharCode(65 + i)}`, ids: [] as string[] }))
  ids.forEach((id, i) => {
    const round = Math.floor(i / n)
    const g = round % 2 === 0 ? i % n : n - 1 - (i % n)
    groups[g].ids.push(id)
  })
  return groups
}

/** Mezcla al azar (Fisher-Yates) con un generador dado. */
export function shuffle<T>(list: T[], rand: () => number = Math.random): T[] {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
