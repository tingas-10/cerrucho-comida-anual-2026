import { describe, expect, it } from 'vitest'
import type { GolfCard, GolfRound } from '../data/types'
import { golfStoryData } from './golfStory'

const holes = Array.from({ length: 18 }, (_, i) => ({ par: 4, si: i + 1 }))
const card = (v: number): GolfCard => ({ strokes: Array.from({ length: 18 }, () => v), total: null, hcp: 0 })
const cfg = { garyPara: ['m-pato'], gary: [1, 2, 3, 4, 5], otras: Array.from({ length: 12 }, (_, i) => i), frases: ['a', 'b', 'c'] }

function round(id: string, mode: GolfRound['mode'], entrants: GolfRound['entrants'], cards: Record<string, GolfCard>): GolfRound {
  return { id, playedAt: 0, status: 'PLAYED', editableUntil: null, courseId: null, course: { name: 'Cancha', holes }, mode, useHcp: false, entrants, cards, createdBy: 'x', updatedBy: 'x', createdAt: 0, updatedAt: 0, revision: 1 }
}

describe('historia de golf', () => {
  const pvp = (winner: string, loser: string) => round('r-' + winner, 'scramble', [{ id: winner, players: [winner] }, { id: loser, players: [loser] }], { [winner]: card(4), [loser]: card(5) })
  it('nombra al ganador', () => {
    for (let roll = 0; roll < 20; roll++) expect(golfStoryData(pvp('m-yayo', 'm-pato'), roll, cfg).chosenId).toBe('m-yayo')
  })
  it('si gana Pato, siempre sale Gary Player', () => {
    for (let roll = 0; roll < 30; roll++) {
      const d = golfStoryData(pvp('m-pato', 'm-yayo'), roll, cfg)
      expect(d.gary).toBe(true)
      expect(d.imageIndex).toBeLessThan(5)
    }
  })
  it('si no gana Pato, sale cualquiera de las otras fotos', () => {
    const seen = new Set<number>()
    for (let roll = 0; roll < 60; roll++) {
      const d = golfStoryData(pvp('m-yayo', 'm-pato'), roll, cfg)
      expect(d.gary).toBe(false)
      seen.add(d.imageIndex)
    }
    expect(seen.size).toBeGreaterThan(6)
  })
  it('en equipo: Gary si Pato está en el equipo ganador, y el nombrado es del equipo', () => {
    const r = round('four', 'fourball', [{ id: 'A', players: ['m-pato', 'm-yayo'] }, { id: 'B', players: ['m-chueco', 'm-zubel'] }], { 'm-pato': card(4), 'm-yayo': card(5), 'm-chueco': card(5), 'm-zubel': card(5) })
    for (let roll = 0; roll < 20; roll++) {
      const d = golfStoryData(r, roll, cfg)
      expect(d.gary).toBe(true)
      expect(['m-pato', 'm-yayo']).toContain(d.chosenId)
    }
  })
  it('es la misma para todos (mismo partido, misma tirada)', () => {
    expect(golfStoryData(pvp('m-yayo', 'm-pato'), 3, cfg)).toEqual(golfStoryData(pvp('m-yayo', 'm-pato'), 3, cfg))
  })
})
