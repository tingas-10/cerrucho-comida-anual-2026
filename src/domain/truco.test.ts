import { describe, expect, it } from 'vitest'
import type { TrucoMatch, TrucoTournament } from '../data/types'
import {
  BYE,
  computeTrucoStats,
  handProbability,
  malasBuenas,
  rng,
  roundRobin,
  seedOrder,
  simulateMany,
  simulateMatch,
  splitGroups,
  tournamentState,
  trucoHeadToHead,
  trucoRanking,
  trucoRatings,
  validateMatch,
  winnerOf,
  winProbability,
} from './truco'

let k = 0
function match(teamA: string[], teamB: string[], scoreA: number, scoreB: number, over: Partial<TrucoMatch> = {}): TrucoMatch {
  k++
  return {
    id: 't' + k,
    playedAt: Date.UTC(2026, 10, 10, 23) + k * 60000,
    size: teamA.length as 1 | 2 | 3,
    target: 30,
    teamA,
    teamB,
    nameA: 'Nosotros',
    nameB: 'Ellos',
    scoreA,
    scoreB,
    status: 'PLAYED',
    createdBy: 'x',
    updatedBy: 'x',
    createdAt: 0,
    updatedAt: 0,
    revision: 1,
    ...over,
  }
}

describe('truco · partido', () => {
  it('gana el primero que llega a los puntos del partido', () => {
    expect(winnerOf(match(['a'], ['b'], 30, 22))).toBe('A')
    expect(winnerOf(match(['a'], ['b'], 12, 15, { target: 15 }))).toBe('B')
    expect(winnerOf(match(['a'], ['b'], 29, 22))).toBeNull()
    expect(winnerOf(match(['a'], ['b'], 0, 0, { resultOnly: true, winner: 'B' }))).toBe('B')
  })
  it('malas y buenas en un partido a 30', () => {
    expect(malasBuenas(9, 30)).toEqual({ part: 'malas', inPart: 9 })
    expect(malasBuenas(15, 30)).toEqual({ part: 'buenas', inPart: 0 })
    expect(malasBuenas(33, 30)).toEqual({ part: 'buenas', inPart: 15 })
    expect(malasBuenas(9, 15)).toEqual({ part: null, inPart: 9 })
  })
  it('validación: equipos completos, sin repetidos y con ganador', () => {
    expect(validateMatch(match(['a', ''], ['b', 'c'], 30, 2))).toMatch(/2 jugadores/)
    expect(validateMatch(match(['a', 'b'], ['b', 'c'], 30, 2))).toMatch(/repetido/)
    expect(validateMatch(match(['a'], ['b'], 20, 2))).toMatch(/Nadie llegó/)
    expect(validateMatch(match(['a'], ['b'], 30, 30))).toMatch(/Los dos/)
    expect(validateMatch(match(['a'], ['b'], 0, 0, { resultOnly: true }))).toMatch(/quién ganó/)
    expect(validateMatch(match(['a', 'b', 'c'], ['d', 'e', 'f'], 30, 28))).toBeNull()
  })
})

describe('truco · ranking', () => {
  const ms = [
    match(['a'], ['b'], 30, 20),
    match(['a', 'c'], ['b', 'd'], 10, 30),
    match(['a'], ['c'], 0, 0, { resultOnly: true, winner: 'A' }),
    match(['a'], ['b'], 30, 0, { status: 'DRAFT' }),
    match(['a'], ['b'], 30, 0, { playedAt: Date.UTC(2025, 5, 1) }),
  ]
  it('gana suma 1,5 y pierde resta 1, a cada jugador del equipo', () => {
    const s = computeTrucoStats(ms, 2026)
    expect(s.a).toMatchObject({ played: 3, won: 2, lost: 1, points: 2 })
    expect(s.b).toMatchObject({ played: 2, won: 1, lost: 1, points: 0.5 })
    expect(s.d).toMatchObject({ played: 1, won: 1, points: 1.5 })
    expect(s.c).toMatchObject({ played: 2, won: 0, lost: 2, points: -2 })
    expect(trucoRanking(s).map((x) => x.id)).toEqual(['a', 'd', 'b', 'c'])
  })
  it('los tantos sólo cuentan en partidos anotados; filtra por formato', () => {
    const s = computeTrucoStats(ms, 2026)
    expect(s.a).toMatchObject({ scored: 2, pointsFor: 40, pointsAgainst: 50 })
    expect(Object.keys(computeTrucoStats(ms, 2026, 2)).sort()).toEqual(['a', 'b', 'c', 'd'])
    expect(computeTrucoStats(ms, 2026, 1).d).toBeUndefined()
  })
  it('1 vs 1: enfrentados y juntos', () => {
    expect(trucoHeadToHead(ms, 'a', 'b', 2026)).toEqual({ against: { played: 2, aWins: 1, bWins: 1 }, together: { played: 0, won: 0, lost: 0 } })
    expect(trucoHeadToHead(ms, 'a', 'c', 2026).together).toEqual({ played: 1, won: 0, lost: 1 })
  })
})

describe('truco · simulación', () => {
  it('es repetible con la misma semilla', () => {
    const x = simulateMatch(30, 0.5, rng(42), 'Pato', 'Yayo')
    const y = simulateMatch(30, 0.5, rng(42), 'Pato', 'Yayo')
    expect(x).toEqual(y)
    expect(Math.max(x.scoreA, x.scoreB)).toBe(30)
    expect(x.hands.length).toBeGreaterThan(3)
  })
  it('el que gana más partidos tiene más chance', () => {
    const ms = Array.from({ length: 8 }, () => match(['a'], ['b'], 30, 10))
    const r = trucoRatings(ms)
    expect(r.a).toBeGreaterThan(r.b)
    expect(winProbability(r.a, r.b)).toBeGreaterThan(0.6)
  })
  it('la chance por mano se calibra para dar la del partido', () => {
    const q = handProbability(0.7, 30)
    expect(q).toBeGreaterThan(0.5)
    const wins = simulateMany(30, q, 2000, 99) / 2000
    expect(wins).toBeGreaterThan(0.63)
    expect(wins).toBeLessThan(0.77)
    expect(handProbability(0.5, 30)).toBe(0.5)
  })
})

function tournament(over: Partial<TrucoTournament>): TrucoTournament {
  return { id: 'T', name: 'Copa', size: 1, target: 30, format: 'league', legs: 1, entrants: [], groups: null, advance: null, createdBy: 'x', createdAt: 0, updatedAt: 0, ...over }
}
const ent = (ids: string[]) => ids.map((id) => ({ id, name: id.toUpperCase(), players: [id] }))
function played(t: TrucoTournament, fixtureId: string, a: string, b: string, winner: 'A' | 'B', scores: [number, number] = winner === 'A' ? [30, 20] : [20, 30]): TrucoMatch {
  return match([a], [b], scores[0], scores[1], { tournamentId: t.id, fixtureId, entrantA: a, entrantB: b })
}

describe('truco · torneos', () => {
  it('liga: todos contra todos una vez (o ida y vuelta)', () => {
    const r = roundRobin(['a', 'b', 'c', 'd', 'e'])
    expect(r.length).toBe(5)
    const pairs = r.flat().map(([x, y]) => [x, y].sort().join('-'))
    expect(new Set(pairs).size).toBe(10)
    expect(pairs.length).toBe(10)
    expect(roundRobin(['a', 'b', 'c', 'd'], 2).flat().length).toBe(12)
  })
  it('cabezas de serie: el 1 y el 2 sólo se cruzan en la final', () => {
    expect(seedOrder(4)).toEqual([1, 4, 2, 3])
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6])
  })
  it('liga: tabla y campeón cuando se jugó todo', () => {
    const t = tournament({ entrants: ent(['a', 'b', 'c']) })
    let st = tournamentState(t, [])
    expect(st.total).toBe(3)
    expect(st.champion).toBeNull()
    const fx = st.league!.rounds.flat()
    const ms = fx.map((f) => played(t, f.key, f.a!, f.b!, f.a === 'b' || (f.b !== 'b' && f.a === 'a') ? 'A' : 'B'))
    st = tournamentState(t, ms)
    expect(st.played).toBe(3)
    expect(st.league!.table[0].id).toBe('b')
    expect(st.champion).toBe('b')
  })
  it('eliminación directa con pases libres', () => {
    const t = tournament({ format: 'knockout', entrants: ent(['a', 'b', 'c', 'd', 'e', 'f']) })
    let st = tournamentState(t, [])
    const r0 = st.knockout!.rounds[0]
    expect(r0.length).toBe(4)
    expect(r0.filter((f) => f.a === BYE || f.b === BYE).length).toBe(2)
    expect(st.knockout!.rounds[1][0].a).toBe('a') // el 1 pasa solo a semis
    expect(st.total).toBe(2)
    const toPlay = r0.filter((f) => f.a !== BYE && f.b !== BYE)
    const ms = toPlay.map((f) => played(t, f.key, f.a!, f.b!, 'A'))
    st = tournamentState(t, ms)
    const semis = st.knockout!.rounds[1]
    expect(semis.every((f) => f.a && f.b)).toBe(true)
    const ms2 = [...ms, ...semis.map((f) => played(t, f.key, f.a!, f.b!, 'B'))]
    st = tournamentState(t, ms2)
    const final = st.knockout!.rounds[2][0]
    const ms3 = [...ms2, played(t, final.key, final.a!, final.b!, 'A')]
    st = tournamentState(t, ms3)
    expect(st.champion).toBe(final.a)
    expect(st.played).toBe(st.total)
  })
  it('un resultado viejo no vale si cambió quién juega el cruce', () => {
    const t = tournament({ format: 'knockout', entrants: ent(['a', 'b', 'c', 'd']) })
    const st = tournamentState(t, [played(t, 'K-1-0', 'x', 'y', 'A')])
    expect(st.knockout!.rounds[1][0].result).toBeNull()
  })
  it('grupos: pasan los mejores de cada grupo y se arma la llave al terminar', () => {
    const groups = splitGroups(['a', 'b', 'c', 'd', 'e', 'f'], 2)
    expect(groups.map((g) => g.ids.length)).toEqual([3, 3])
    const t = tournament({ format: 'groups', entrants: ent(['a', 'b', 'c', 'd', 'e', 'f']), groups, advance: 2 })
    let st = tournamentState(t, [])
    expect(st.knockout!.ready).toBe(false)
    expect(st.total).toBe(6)
    // En cada grupo gana siempre el de menor letra
    const ms = st.groups!.flatMap((g) => g.rounds.flat().map((f) => played(t, f.key, f.a!, f.b!, f.a! < f.b! ? 'A' : 'B')))
    st = tournamentState(t, ms)
    expect(st.knockout!.ready).toBe(true)
    expect(st.qualifiers.length).toBe(4)
    const semis = st.knockout!.rounds[0]
    expect(semis.length).toBe(2)
    // Los primeros de grupo no se cruzan en semis
    const firsts = st.groups!.map((g) => g.table[0].id)
    expect(semis.some((f) => firsts.includes(f.a!) && firsts.includes(f.b!))).toBe(false)
  })
  it('grupos: pasan todos, en orden de posiciones', () => {
    const t = tournament({ format: 'groups', entrants: ent(['a', 'b', 'c', 'd']), groups: splitGroups(['a', 'b', 'c', 'd'], 2), advance: 'all' })
    const st0 = tournamentState(t, [])
    const ms = st0.groups!.flatMap((g) => g.rounds.flat().map((f) => played(t, f.key, f.a!, f.b!, 'A')))
    const st = tournamentState(t, ms)
    expect(st.qualifiers.length).toBe(4)
    // Primero pasan los primeros de cada grupo, después los segundos
    expect(new Set(st.qualifiers.slice(0, 2))).toEqual(new Set(st.groups!.map((g) => g.table[0].id)))
    expect(new Set(st.qualifiers.slice(2))).toEqual(new Set(st.groups!.map((g) => g.table[1].id)))
  })
})
