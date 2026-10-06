import { describe, expect, it } from 'vitest'
import type { PadelMatch } from '../data/types'
import { computePadelStats, computePairStats, padelHeadToHead, padelRanking, pairKey, partnersOf, setsToWin, validateMatch, winnerOf } from './padel'

const guest = (id: string) => id.startsWith('g-')
let n = 0
function match(pairA: [string, string], pairB: [string, string], bestOf: 1 | 3 | 5, sets: Array<[number, number]>, status: PadelMatch['status'] = 'PLAYED'): PadelMatch {
  n++
  return { id: 'p' + n, playedAt: Date.UTC(2026, 9, 10, 23), bestOf, pairA, pairB, sets: sets.map(([a, b]) => ({ a, b })), status, createdBy: 'x', updatedBy: 'x', createdAt: 0, updatedAt: 0, revision: 1 }
}

describe('pádel · validación', () => {
  it('sets para ganar', () => {
    expect(setsToWin(1)).toBe(1)
    expect(setsToWin(3)).toBe(2)
    expect(setsToWin(5)).toBe(3)
  })
  it('son 4, sin repetir, con hasta 1 invitado', () => {
    expect(validateMatch(match(['a', 'b'], ['c', ''], 1, [[6, 4]]), guest)).toMatch(/Faltan/)
    expect(validateMatch(match(['a', 'b'], ['c', 'a'], 1, [[6, 4]]), guest)).toMatch(/repetido/)
    expect(validateMatch(match(['a', 'g-1'], ['c', 'g-2'], 1, [[6, 4]]), guest)).toMatch(/invitado/)
    expect(validateMatch(match(['a', 'g-1'], ['c', 'd'], 1, [[6, 4]]), guest)).toBeNull()
  })
  it('el partido tiene que quedar definido, sin sets de más ni empatados', () => {
    expect(validateMatch(match(['a', 'b'], ['c', 'd'], 3, [[6, 4]]), guest)).toMatch(/Falta definir/)
    expect(validateMatch(match(['a', 'b'], ['c', 'd'], 3, [[6, 4], [6, 6]]), guest)).toMatch(/empatado/)
    expect(validateMatch(match(['a', 'b'], ['c', 'd'], 3, [[6, 4], [6, 3], [2, 6]]), guest)).toMatch(/definido/)
    expect(validateMatch(match(['a', 'b'], ['c', 'd'], 3, [[6, 4], [3, 6], [7, 5]]), guest)).toBeNull()
    expect(validateMatch(match(['a', 'b'], ['c', 'd'], 5, [[6, 4], [6, 4], [6, 4]]), guest)).toBeNull()
  })
})

describe('pádel · puntos y rankings', () => {
  const ms = [
    match(['a', 'b'], ['c', 'd'], 1, [[6, 3]]), // a,b +1
    match(['a', 'c'], ['b', 'd'], 3, [[4, 6], [6, 2], [3, 6]]), // b,d +2
    match(['b', 'a'], ['c', 'g-1'], 5, [[6, 1], [6, 2], [6, 0]]), // a,b +3
    match(['a', 'b'], ['c', 'd'], 3, [[6, 1]], 'DRAFT'), // no cuenta
  ]
  it('a 1 set suma 1, al mejor de 3 suma 2, al mejor de 5 suma 3; perder suma 0', () => {
    const s = computePadelStats(ms)
    expect(s.a.points).toBe(4)
    expect(s.b.points).toBe(6)
    expect(s.d.points).toBe(2)
    expect(s.c.points).toBe(0)
    expect(s.a.played).toBe(3)
    expect(s.b.won).toBe(3)
    expect(s['g-1'].lost).toBe(1)
  })
  it('sets y games', () => {
    const s = computePadelStats(ms)
    expect(s.a.setsWon).toBe(5)
    expect(s.a.setsLost).toBe(2)
    expect(winnerOf(ms[1])).toBe('B')
  })
  it('ranking por puntos y después ganados', () => {
    expect(padelRanking(computePadelStats(ms)).map((x) => x.id)[0]).toBe('b')
  })
  it('parejas: el orden drive/revés no importa', () => {
    const p = computePairStats(ms)
    const ab = p[pairKey(['a', 'b'])]
    expect(ab.played).toBe(2)
    expect(ab.points).toBe(4)
    expect(p[pairKey(['b', 'd'])].points).toBe(2)
  })
  it('1 vs 1: en contra y juntos', () => {
    const h = padelHeadToHead(ms, 'a', 'b')
    expect(h.together).toEqual({ played: 2, won: 2, lost: 0 })
    expect(h.against.played).toBe(1)
    expect(h.against.bWins).toBe(1)
  })
  it('compañeros', () => {
    const p = partnersOf(ms, 'a')
    expect(p[0].id).toBe('b')
    expect(p[0].won).toBe(2)
  })
})
