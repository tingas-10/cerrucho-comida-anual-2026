import { describe, expect, it } from 'vitest'
import type { FmoMatch } from '../data/types'
import { storyData } from './fmoStory'

function match(id: string, players: Record<string, ['A' | 'B', number]>, other: [number, number] = [0, 0]): FmoMatch {
  return {
    id,
    playedAt: 0,
    size: 5,
    nameA: 'Claros',
    nameB: 'Oscuros',
    players: Object.fromEntries(Object.entries(players).map(([pid, [team, goals]]) => [pid, { team, x: 50, y: 50, goals }])),
    otherA: other[0],
    otherB: other[1],
    status: 'PLAYED',
    createdBy: 'x',
    updatedBy: 'x',
    createdAt: 0,
    updatedAt: 0,
    revision: 1,
  }
}

describe('historia de FMO', () => {
  const m = match('abc', { a1: ['A', 2], a2: ['A', 0], a3: ['A', 1], b1: ['B', 1], b2: ['B', 0] })
  it('el elegido siempre es del equipo ganador', () => {
    for (let roll = 0; roll < 30; roll++) expect(['a1', 'a2', 'a3']).toContain(storyData(m, roll, 2).chosenId)
  })
  it('es el mismo para todos (mismo partido, misma tirada)', () => {
    expect(storyData(m, 0, 2).chosenId).toBe(storyData({ ...m, players: Object.fromEntries(Object.entries(m.players).reverse()) }, 0, 2).chosenId)
  })
  it('goleadores ordenados y sin los que no metieron', () => {
    const d = storyData(m, 0, 2)
    expect(d.winner).toBe('A')
    expect(d.score).toEqual({ a: 3, b: 1 })
    expect(d.scorersA.map((s) => s.id)).toEqual(['a1', 'a3'])
    expect(d.scorersB).toEqual([{ id: 'b1', goals: 1 }])
  })
  it('empate: elige de cualquiera de los dos', () => {
    const d = storyData(match('x', { a1: ['A', 1], b1: ['B', 1] }), 3, 2)
    expect(d.winner).toBeNull()
    expect(['a1', 'b1']).toContain(d.chosenId)
  })
  it('gol en contra cuenta para el resultado', () => {
    expect(storyData(match('y', { a1: ['A', 0], b1: ['B', 0] }, [1, 0]), 0, 2).winner).toBe('A')
  })
})
