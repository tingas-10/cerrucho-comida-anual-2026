import { describe, expect, it } from 'vitest'
import type { GolfCard, GolfEntrant, GolfMode, GolfRound } from '../data/types'
import { calcCard, golfPlayerStats, golfVersus, meritTable, playingHcp, regroup, roundResult, strokesOn, validateRound } from './golf'

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
