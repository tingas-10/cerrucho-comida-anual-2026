import { describe, expect, it } from 'vitest'
import type { FmoMatch } from '../data/types'
import { computeStats, defaultPosition, formatPoints, headToHead, ranking, resultFor, scoreOf, yearOf } from './fmo'

function match(id: string, playedAt: number, a: Record<string, number>, b: Record<string, number>, over: Partial<FmoMatch> = {}): FmoMatch {
  const players: FmoMatch['players'] = {}
  for (const [pid, goals] of Object.entries(a)) players[pid] = { team: 'A', x: 50, y: 20, goals }
  for (const [pid, goals] of Object.entries(b)) players[pid] = { team: 'B', x: 50, y: 80, goals }
  return { id, playedAt, size: 5, nameA: 'Claros', nameB: 'Oscuros', players, otherA: 0, otherB: 0, status: 'PLAYED', createdBy: 'x', updatedBy: 'x', createdAt: 0, updatedAt: 0, revision: 1, ...over }
}

const d2026 = Date.UTC(2026, 9, 10, 23)
const d2025 = Date.UTC(2025, 5, 10, 23)

describe('FMO · resultado', () => {
  it('suma goles de jugadores y goles sin dueño', () => {
    const m = match('m1', d2026, { ana: 2, beto: 1 }, { caro: 1 }, { otherB: 1 })
    expect(scoreOf(m)).toEqual({ a: 3, b: 2 })
    expect(resultFor(m, 'ana')).toBe('W')
    expect(resultFor(m, 'caro')).toBe('L')
    expect(resultFor(m, 'nadie')).toBeNull()
  })
  it('empate', () => {
    const m = match('m2', d2026, { ana: 1 }, { caro: 1 })
    expect(resultFor(m, 'ana')).toBe('D')
    expect(resultFor(m, 'caro')).toBe('D')
  })
  it('el año se toma en hora de Buenos Aires', () => {
    expect(yearOf(Date.UTC(2027, 0, 1, 1))).toBe(2026) // 31/12 22:00 en Buenos Aires
    expect(yearOf(Date.UTC(2027, 0, 1, 4))).toBe(2027)
  })
})

describe('FMO · estadísticas y ranking', () => {
  const matches = [
    match('m1', d2026, { ana: 2, beto: 0 }, { caro: 1, dani: 0 }), // gana A 2-1
    match('m2', d2026, { ana: 1, caro: 0 }, { beto: 1, dani: 0 }), // empate 1-1
    match('m3', d2025, { ana: 0 }, { caro: 3 }), // 2025: gana B
    match('m4', d2026, { ana: 5 }, { caro: 0 }, { status: 'DRAFT' }), // armado, no cuenta
  ]
  it('ganado 2, empatado 1, perdido 0, gol 0,5', () => {
    const s = computeStats(matches, 2026)
    expect(s.ana).toMatchObject({ played: 2, won: 1, drawn: 1, lost: 0, goals: 3, points: 2 + 1 + 1.5 })
    expect(s.beto).toMatchObject({ played: 2, won: 1, drawn: 1, lost: 0, goals: 1, points: 2 + 1 + 0.5 })
    expect(s.caro).toMatchObject({ played: 2, won: 0, drawn: 1, lost: 1, goals: 1, points: 1 + 0.5 })
    expect(s.dani).toMatchObject({ played: 2, won: 0, drawn: 1, lost: 1, goals: 0, points: 1 })
  })
  it('los partidos armados sin jugar no cuentan', () => {
    expect(computeStats(matches, 2026).ana.goals).toBe(3)
  })
  it('histórico incluye todos los años', () => {
    const s = computeStats(matches)
    expect(s.caro).toMatchObject({ played: 3, won: 1, goals: 4 })
  })
  it('ranking ordenado por puntos', () => {
    expect(ranking(computeStats(matches, 2026)).map((x) => x.playerId)).toEqual(['ana', 'beto', 'caro', 'dani'])
  })
  it('1 vs 1: en contra y juntos', () => {
    const h = headToHead(matches, 'ana', 'caro')
    expect(h.against).toEqual({ played: 2, aWins: 1, bWins: 1, draws: 0, aGoals: 2, bGoals: 4 })
    expect(h.together).toEqual({ played: 1, won: 0, drawn: 1, lost: 0 })
  })
})

describe('FMO · utilidades', () => {
  it('posiciones por defecto: A arriba, B abajo', () => {
    expect(defaultPosition('A', 0).y).toBeLessThan(50)
    expect(defaultPosition('B', 0).y).toBeGreaterThan(50)
  })
  it('formato de puntos', () => {
    expect(formatPoints(4)).toBe('4')
    expect(formatPoints(4.5)).toBe('4,5')
  })
})
