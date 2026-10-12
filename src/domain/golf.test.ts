import { describe, expect, it } from 'vitest'
import type { GolfCard, GolfEntrant, GolfMode, GolfRound } from '../data/types'
import { calcCard, courseHistory, defaultLines, golfPlayerStats, golfVersus, liveBoard, meritTable, playingHcp, pointsText, regroup, roundResult, strokesOn, validateRound } from './golf'

const holes18 = Array.from({ length: 18 }, (_, i) => ({ par: 4, si: i + 1 }))
const all = (v: number, n = 18) => Array.from({ length: n }, () => v)
const card = (strokes: Array<number | null>, hcp = 0, total: number | null = null): GolfCard => ({ strokes, total, hcp })

let k = 0
function round(mode: GolfMode, entrants: GolfEntrant[], cards: Record<string, GolfCard>, over: Partial<GolfRound> = {}): GolfRound {
  k++
  return {
    id: 'r' + k,
    playedAt: Date.UTC(2026, 9, 10, 12),
    status: 'PLAYED',
    editableUntil: null,
    courseId: 'c1',
    course: { name: 'Cancha', holes: holes18 },
    mode,
    useHcp: true,
    entrants,
    cards,
    createdBy: 'x',
    updatedBy: 'x',
    createdAt: 0,
    updatedAt: 0,
    revision: 1,
    ...over,
  }
}
const solo = (...ids: string[]) => ids.map((id) => ({ id, players: [id] }))

describe('golf · hándicap por hoyo', () => {
  it('reparte los golpes por dificultad', () => {
    expect(strokesOn(18, 7, 18)).toBe(1)
    expect(strokesOn(20, 2, 18)).toBe(2)
    expect(strokesOn(20, 3, 18)).toBe(1)
    expect(strokesOn(5, 5, 18)).toBe(1)
    expect(strokesOn(5, 6, 18)).toBe(0)
    expect(strokesOn(-2, 17, 18)).toBe(-1)
    expect(strokesOn(-2, 16, 18)).toBe(0)
  })
  it('en 9 hoyos se usa la mitad', () => {
    expect(playingHcp(15, 9)).toBe(8)
    expect(playingHcp(15.4, 18)).toBe(15)
  })
})

describe('golf · tarjetas', () => {
  it('stableford: el par da 2 puntos por hoyo, y el hándicap suma', () => {
    const r = round('stableford', solo('a'), {})
    expect(calcCard(r, card(all(4))).stableford).toBe(36)
    expect(calcCard(r, card(all(5), 18)).stableford).toBe(36)
    expect(calcCard(r, card(all(3))).stableford).toBe(54)
    expect(calcCard(r, card(all(9))).stableford).toBe(0)
  })
  it('sólo el total vale en medal, no en stableford', () => {
    const m = round('medal', solo('a'), {})
    const s = round('stableford', solo('a'), {})
    const c = card(all(18).map(() => null), 0, 80)
    expect(calcCard(m, c).complete).toBe(true)
    expect(calcCard(m, c).gross).toBe(80)
    expect(calcCard(s, c).complete).toBe(false)
  })
})

describe('golf · resultados por modalidad', () => {
  it('medal: con hándicap gana el mejor neto; sin hándicap, el bruto', () => {
    const cards = { a: card(all(18).map(() => null), 10, 80), b: card(all(18).map(() => null), 0, 75) }
    expect(roundResult(round('medal', solo('a', 'b'), cards)).standings[0].entrantId).toBe('a')
    expect(roundResult(round('medal', solo('a', 'b'), cards, { useHcp: false })).standings[0].entrantId).toBe('b')
  })
  it('empatados comparten el puesto', () => {
    const res = roundResult(round('stableford', solo('a', 'b', 'c'), { a: card(all(4)), b: card(all(4)), c: card(all(5)) }))
    expect(res.standings.map((s) => s.position)).toEqual([1, 1, 3])
  })
  it('match play: el de más hándicap recibe la diferencia', () => {
    const res = roundResult(round('match', solo('a', 'b'), { a: card(all(4), 0), b: card(all(5), 9) }))
    expect(res.match).toEqual({ aId: 'a', bId: 'b', aHoles: 9, bHoles: 0, halved: 9 })
    expect(res.standings[0].entrantId).toBe('a')
  })
  it('mejor pelota: cuenta el mejor de la pareja en cada hoyo', () => {
    const p1 = { id: 't1', players: ['a', 'b'] }
    const p2 = { id: 't2', players: ['c', 'd'] }
    const alt = (x: number, y: number) => Array.from({ length: 18 }, (_, i) => (i % 2 ? x : y))
    const res = roundResult(round('fourball', [p1, p2], { a: card(alt(3, 6)), b: card(alt(6, 4)), c: card(all(4)), d: card(all(5)) }, { useHcp: false }))
    expect(res.standings[0].entrantId).toBe('t1')
    expect(res.standings[0].label).toBe('63')
  })
  it('scramble: una tarjeta por equipo, con hándicap de equipo', () => {
    const t1 = { id: 't1', players: ['a', 'b'] }
    const t2 = { id: 't2', players: ['c', 'd'] }
    const res = roundResult(round('scramble', [t1, t2], { t1: card(all(18).map(() => null), 4, 70), t2: card(all(18).map(() => null), 0, 68) }))
    expect(res.standings[0].entrantId).toBe('t1')
  })
})

describe('golf · validación', () => {
  it('pide al menos 2 y tarjetas completas', () => {
    expect(validateRound(round('medal', solo('a'), { a: card(all(4)) }))).toMatch(/al menos 2/)
    expect(validateRound(round('stableford', solo('a', 'b'), { a: card(all(4)), b: card([4, null, ...all(4, 16)]) }))).toMatch(/Faltan/)
    expect(validateRound(round('match', solo('a', 'b', 'c'), { a: card(all(4)), b: card(all(4)), c: card(all(4)) }))).toMatch(/entre 2/)
    expect(validateRound(round('fourball', [{ id: 't1', players: ['a'] }, { id: 't2', players: ['c', 'd'] }], {}))).toMatch(/2 jugadores/)
    expect(validateRound(round('stableford', solo('a', 'b'), { a: card(all(4)), b: card(all(5)) }))).toBeNull()
  })
  it('al pasar a parejas agrupa de a 2', () => {
    expect(regroup(['a', 'b', 'c', 'd'], 'fourball')).toEqual([{ id: 't1', players: ['a', 'b'] }, { id: 't2', players: ['c', 'd'] }])
    expect(regroup(['a', 'b'], 'medal')).toEqual(solo('a', 'b'))
  })
})

describe('golf · Orden de Mérito, estadísticas y 1 vs 1', () => {
  const r1 = round('stableford', solo('a', 'b', 'c'), { a: card(all(4)), b: card(all(5)), c: card(all(5)) })
  const r2 = round('medal', solo('a', 'b'), { a: card(all(5)), b: card([1, 3, 2, ...all(4, 15)]) })
  const voided = round('medal', solo('a', 'b'), { a: card(all(3)), b: card(all(9)) }, { voided: true })
  const draft = round('medal', solo('a', 'b'), { a: card(all(3)), b: card(all(9)) }, { status: 'DRAFT' })
  const cfg = { participation: 1, positions: [10, 6, 4] }
  it('suma por jugar y por puesto; anuladas y por jugarse no cuentan', () => {
    const t = meritTable([r1, r2, voided, draft], cfg)
    const by = Object.fromEntries(t.map((x) => [x.playerId, x]))
    expect(by.a.points).toBe(11 + 7)
    expect(by.b.points).toBe(7 + 11)
    expect(by.c.points).toBe(7)
    expect(by.a.rounds).toBe(2)
    expect(by.b.wins).toBe(1)
  })
  it('puntos según cuántos juegan: entre 2, 5/0; entre 3, 7/3/0; más el punto por jugar', () => {
    const byField = { participation: 1, positions: [10, 6, 4], byField: { '2': [5, 0], '3': [7, 3, 0] } }
    const by = Object.fromEntries(meritTable([r1, r2], byField).map((x) => [x.playerId, x.points]))
    // r1 (3 jugadores): a 1º → 1+7; b y c empatan 2º → 1+3 cada uno. r2 (2 jugadores): b 1º → 1+5; a 2º → 1+0.
    expect(by).toEqual({ a: 8 + 1, b: 4 + 6, c: 4 })
    const four = round('stableford', solo('a', 'b', 'c', 'd'), { a: card(all(3)), b: card(all(4)), c: card(all(5)), d: card(all(6)) })
    expect(Object.fromEntries(meritTable([four], byField).map((x) => [x.playerId, x.points]))).toEqual({ a: 11, b: 7, c: 5, d: 1 })
    expect(pointsText(byField)).toBe('1 por jugar · entre 2: 5/0 · entre 3: 7/3/0 · 4 o más: 10/6/4')
  })
  it('estadísticas: mejor ronda, birdies, eagles y hoyo en uno', () => {
    const s = golfPlayerStats([r1, r2], 'b')
    expect(s.best18).toBe(66)
    expect(s.aces).toBe(1)
    expect(s.birdies).toBe(1)
    expect(s.eagles).toBe(1)
    expect(s.bestStableford).toBe(18)
  })
  it('1 vs 1', () => {
    const v = golfVersus([r1, r2], 'a', 'b')
    expect(v.together).toBe(2)
    expect(v.aAhead).toBe(1)
    expect(v.bAhead).toBe(1)
  })
})

describe('golf · vueltas individuales, rankings por modalidad, en vivo y canchas', () => {
  const cfg = { participation: 1, positions: [10, 6, 4], byField: { '2': [5, 0], '3': [7, 3, 0] } }
  const solo1 = round('solo', solo('a'), { a: card(all(4)) })
  const m1 = round('match', solo('a', 'b'), { a: card(all(4)), b: card(all(5)) })
  const fb = round('fourball', [{ id: 't1', players: ['a', 'c'] }, { id: 't2', players: ['b', 'd'] }], { a: card(all(4)), c: card(all(5)), b: card(all(5)), d: card(all(6)) })
  it('la vuelta individual se valida sola, no suma al ranking pero cuenta en estadísticas', () => {
    expect(validateRound(solo1)).toBeNull()
    expect(roundResult(solo1).complete).toBe(true)
    expect(meritTable([solo1], cfg)).toEqual([])
    const st = golfPlayerStats([solo1, m1], 'a')
    expect(st.solos).toBe(1)
    expect(st.rounds).toBe(1)
    expect(st.best18).toBe(72)
  })
  it('ranking por modalidad', () => {
    const general = Object.fromEntries(meritTable([m1, fb], cfg).map((x) => [x.playerId, x.points]))
    const onlyMatch = Object.fromEntries(meritTable([m1, fb], cfg, undefined, 'match').map((x) => [x.playerId, x.points]))
    expect(onlyMatch).toEqual({ a: 6, b: 1 })
    expect(general.a).toBe(12)
    expect(general.c).toBe(6)
  })
  it('en vivo: hasta qué hoyo va cada uno y cómo viene', () => {
    const r = round('fourball', [{ id: 't1', players: ['a', 'c'] }, { id: 't2', players: ['b', 'd'] }], {
      a: card([3, 4, null, ...all(null as unknown as number, 15)]),
      c: card([5, 5, null, ...all(null as unknown as number, 15)]),
      b: card([4, null, ...all(null as unknown as number, 16)]),
      d: card([4, null, ...all(null as unknown as number, 16)]),
    }, { useHcp: false })
    const board = liveBoard(r)
    expect(board[0]).toMatchObject({ entrantId: 't1', thru: 2, toPar: -1 })
    expect(board[1]).toMatchObject({ entrantId: 't2', thru: 1, toPar: 0 })
    const mm = liveBoard(round('match', solo('a', 'b'), { a: card([3, 4, null, ...all(null as unknown as number, 15)]), b: card([4, 4, null, ...all(null as unknown as number, 15)]) }, { useHcp: false }))
    expect(mm[0].label).toBe('1 arriba (hoyo 2)')
  })
  it('líneas de a 4 sin separar parejas', () => {
    expect(defaultLines({ entrants: solo('a', 'b', 'c', 'd', 'e') }).map((l) => l.players)).toEqual([['a', 'b', 'c', 'd'], ['e']])
    expect(defaultLines({ entrants: [{ id: 't1', players: ['a', 'b'] }, { id: 't2', players: ['c', 'd'] }, { id: 't3', players: ['e', 'f'] }] }).map((l) => l.players.length)).toEqual([4, 2])
  })
  it('historial de la cancha: récord de cada uno (incluye vueltas individuales)', () => {
    const h = courseHistory([solo1, m1, fb], 'c1')
    const a = h.find((x) => x.playerId === 'a')!
    expect(a.rounds).toBe(3)
    expect(a.best).toBe(72)
  })
})

