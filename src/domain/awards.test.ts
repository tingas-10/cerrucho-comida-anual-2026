import { describe, expect, it } from 'vitest'
import cases from '../../docs/spec/06_Casos_reglas.json'
import { countBallots, directNominees, resolveRound1, resolveRound2, stableShuffle } from './awards'

interface AwardCase {
  id: string
  round: number
  counts: Record<string, number>
  expected: { outcome: string; winner?: string; finalists?: string[]; tied?: string[] }
}

describe('premios · casos de la especificación', () => {
  for (const c of cases.award_cases as unknown as AwardCase[]) {
    it(c.id, () => {
      if (c.round === 1) {
        const r = resolveRound1(c.counts)
        expect(r.outcome).toBe(c.expected.outcome)
        if (c.expected.winner) expect(r.winner).toBe(c.expected.winner)
        if (c.expected.finalists) expect([...r.finalists!].sort()).toEqual([...c.expected.finalists].sort())
      } else {
        const r = resolveRound2(c.counts)
        expect(r.outcome).toBe(c.expected.outcome)
        if (c.expected.winner) expect(r.winner).toBe(c.expected.winner)
        if (c.expected.tied) expect([...r.tied!].sort()).toEqual([...c.expected.tied].sort())
      }
    })
  }
})

describe('premios · conteo', () => {
  it('cuenta sólo claves permitidas e ignora vacíos', () => {
    const counts = countBallots(['A', 'A', null, 'B', 'Z', undefined], new Set(['A', 'B', 'NOBODY']))
    expect(counts).toEqual({ A: 2, B: 1 })
  })
  it('un líder con margen exacto de 3 gana directo', () => {
    expect(resolveRound1({ A: 10, B: 7, C: 1 }).outcome).toBe('WINNER')
  })
  it('margen 2 abre ballotage con todos los que están dentro', () => {
    const r = resolveRound1({ A: 8, B: 7, C: 6, D: 6, E: 5 })
    expect(r.outcome).toBe('RUNOFF_REQUIRED')
    expect(r.finalists).toEqual(['A', 'B', 'C', 'D'])
  })
  it('nominados directos ordenados por etiqueta', () => {
    const labels: Record<string, string> = { m1: 'Zoe', m2: 'Ana', NOBODY: 'Nadie lo merece' }
    expect(directNominees({ m1: 3, m2: 1, NOBODY: 1, m3: 0 }, (k) => labels[k] ?? k)).toEqual(['m2', 'NOBODY', 'm1'])
  })
  it('orden aleatorio estable por semilla', () => {
    const a = stableShuffle(['A', 'B', 'C', 'D'], 'user-1')
    const b = stableShuffle(['A', 'B', 'C', 'D'], 'user-1')
    expect(a).toEqual(b)
    expect([...a].sort()).toEqual(['A', 'B', 'C', 'D'])
  })
})
