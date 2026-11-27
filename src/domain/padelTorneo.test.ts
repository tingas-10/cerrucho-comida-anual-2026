import { describe, expect, it } from 'vitest'
import type { PadelMatch, PadelTournament } from '../data/types'
import { BYE, buildGroups, koTies, qualifiersCount, resultProblem, rrGames, setProblem, tournamentState } from './padelTorneo'
import { computePadelStats } from './padel'

const pairs = (ids: string[]) => ids.map((id) => ({ id, players: [`${id}-1`, `${id}-2`] as [string, string] }))

function tucan(): PadelTournament {
  return {
    id: 't1',
    name: 'Tucan Open',
    format: 'groups',
    pairs: pairs(['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8']),
    games: null,
    groups: [
      { name: 'Grupo A', ids: ['p5', 'p7', 'p4', 'p8'], games: rrGames(['p5', 'p7', 'p4', 'p8']) },
      { name: 'Grupo B', ids: ['p1', 'p3', 'p2', 'p6'], games: rrGames(['p1', 'p3', 'p2', 'p6']) },
    ],
    advance: 2,
    formats: { rr: 'g4', ko: { '2': 's1', '1': 's1' } },
    points: { win: 3, draw: 1, loss: 0 },
    deuce: 'oro',
    date: null,
    place: null,
    createdBy: 'owner',
    updatedBy: 'owner',
    createdAt: 1,
    updatedAt: 1,
  }
}

let n = 0
function play(t: PadelTournament, key: string, a: string, b: string, sets: Array<[number, number]>, extra: Partial<PadelMatch> = {}): PadelMatch {
  n++
  const pa = t.pairs.find((p) => p.id === a)!
  const pb = t.pairs.find((p) => p.id === b)!
  return {
    id: `m${n}`,
    playedAt: n,
    bestOf: sets.length > 1 ? 3 : 1,
    games: 4,
    pairA: pa.players,
    pairB: pb.players,
    sets: sets.map(([x, y]) => ({ a: x, b: y })),
    status: 'PLAYED',
    tournamentId: t.id,
    fixtureId: key,
    entrantA: a,
    entrantB: b,
    createdBy: 'owner',
    updatedBy: 'owner',
    createdAt: n,
    updatedAt: n,
    revision: 1,
    ...extra,
  }
}

describe('fixture de grupos', () => {
  it('con 4 parejas sigue el orden del Tucan Open: 1-3 y 2-4, 1-4 y 2-3, 1-2 y 3-4', () => {
    const g = rrGames(['p5', 'p7', 'p4', 'p8'])
    expect(g.map((x) => `${x.r}:${x.a}-${x.b}`)).toEqual(['0:p5-p4', '0:p7-p8', '1:p5-p8', '1:p7-p4', '2:p5-p7', '2:p4-p8'])
  })
  it('con 5 parejas todos juegan contra todos una vez', () => {
    const g = rrGames(['a', 'b', 'c', 'd', 'e'])
    expect(g).toHaveLength(10)
    const seen = new Set(g.map((x) => [x.a, x.b].sort().join('')))
    expect(seen.size).toBe(10)
  })
  it('arma los grupos en zigzag con su fixture', () => {
    const gs = buildGroups(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], 2)
    expect(gs.map((g) => g.ids)).toEqual([
      ['a', 'd', 'e', 'h'],
      ['b', 'c', 'f', 'g'],
    ])
    expect(gs[0].games).toHaveLength(6)
  })
})

describe('Tucan Open: grupos + semis cruzadas', () => {
  it('antes de terminar los grupos, las semis muestran de dónde sale cada pareja', () => {
    const st = tournamentState(tucan(), [])
    const semis = st.knockout![0]
    expect(semis).toHaveLength(2)
    expect([semis[0].aLabel, semis[0].bLabel]).toEqual(['1° Grupo A', '2° Grupo B'])
    expect([semis[1].aLabel, semis[1].bLabel]).toEqual(['1° Grupo B', '2° Grupo A'])
    expect(st.knockout![1][0].aLabel).toBe('Ganador semi 1')
    expect(st.total).toBe(15)
    expect(st.played).toBe(0)
  })

  it('con los grupos jugados arma 1A-2B y 1B-2A, y el campeón sale de la final', () => {
    const t = tucan()
    const ms: PadelMatch[] = []
    // Grupo A: p5 gana todo, p8 segunda, p7 tercera, p4 última.
    const gA = t.groups![0].games
    const orderA = ['p5', 'p8', 'p7', 'p4']
    gA.forEach((g, i) => {
      const aWins = orderA.indexOf(g.a) < orderA.indexOf(g.b)
      ms.push(play(t, `G0-${i}`, g.a, g.b, [aWins ? [4, 1] : [2, 4]]))
    })
    // Grupo B: p6 primera, p1 segunda.
    const gB = t.groups![1].games
    const orderB = ['p6', 'p1', 'p3', 'p2']
    gB.forEach((g, i) => {
      const aWins = orderB.indexOf(g.a) < orderB.indexOf(g.b)
      ms.push(play(t, `G1-${i}`, g.a, g.b, [aWins ? [4, 3] : [0, 4]]))
    })
    let st = tournamentState(t, ms)
    expect(st.groups!.map((g) => g.table.map((r) => r.id))).toEqual([orderA, orderB])
    expect(st.groups![0].table[0].pts).toBe(9)
    const [s1, s2] = st.knockout![0]
    expect([s1.a, s1.b]).toEqual(['p5', 'p1'])
    expect([s2.a, s2.b]).toEqual(['p6', 'p8'])
    expect(s1.format).toBe('s1')
    // Semis y final (la pareja B del partido puede ser la "a" del cruce: se da vuelta sola).
    ms.push(play(t, 'K-0-0', 'p1', 'p5', [[6, 3]]))
    ms.push(play(t, 'K-0-1', 'p6', 'p8', [[7, 5]]))
    st = tournamentState(t, ms)
    expect(st.knockout![0][0].result!.winner).toBe('p1')
    expect(st.knockout![0][0].result!.sets).toEqual([{ a: 3, b: 6 }])
    const fin = st.knockout![1][0]
    expect([fin.a, fin.b]).toEqual(['p1', 'p6'])
    ms.push(play(t, 'K-1-0', 'p1', 'p6', [[6, 4], [3, 6], [6, 2]]))
    st = tournamentState(t, ms)
    expect(st.champion).toBe('p1')
    expect(st.runnerUp).toBe('p6')
    expect(st.played).toBe(15)
  })

  it('si dos empatan en puntos, manda el partido entre ellos', () => {
    const t = tucan()
    const g = t.groups![0].games // 0:p5-p4 1:p7-p8 2:p5-p8 3:p7-p4 4:p5-p7 5:p4-p8
    const ms = [
      play(t, 'G0-0', 'p5', 'p4', [[4, 0]]),
      play(t, 'G0-1', 'p7', 'p8', [[3, 4]]),
      play(t, 'G0-2', 'p5', 'p8', [[4, 0]]),
      play(t, 'G0-3', 'p7', 'p4', [[4, 3]]),
      play(t, 'G0-4', 'p5', 'p7', [[3, 4]]), // p7 le gana a p5
      play(t, 'G0-5', 'p4', 'p8', [[4, 0]]),
    ]
    expect(g).toHaveLength(6)
    const table = tournamentState(t, ms).groups![0].table
    // p5 y p7 terminan con 6 puntos; p5 tiene mejor diferencia de games (+7 contra +1), pero p7 le ganó.
    expect(table.map((r) => [r.id, r.pts])).toEqual([
      ['p7', 6],
      ['p5', 6],
      ['p4', 3],
      ['p8', 3],
    ])
  })

  it('un resultado viejo no vale si cambió quién juega el cruce', () => {
    const t = tucan()
    const st = tournamentState(t, [play(t, 'G0-0', 'p5', 'p7', [[4, 0]])])
    expect(st.groups![0].fixtures[0].result).toBeNull()
  })

  it('un partido en cancha se ve como en vivo', () => {
    const t = tucan()
    const live = { ...play(t, 'G0-1', 'p7', 'p8', []), status: 'LIVE' as const }
    const f = tournamentState(t, [live]).groups![0].fixtures[1]
    expect(f.live).toBe(true)
    expect(f.result).toBeNull()
  })

  it('el empate suma los puntos de empate en la tabla y no cuenta para el ranking general', () => {
    const t = { ...tucan(), formats: { rr: 'bo3' as const, ko: {} } }
    const m = play(t, 'G0-0', 'p5', 'p4', [[6, 4], [4, 6]], { bestOf: 3, games: 6, draw: true })
    const table = tournamentState(t, [m]).groups![0].table
    expect(table.find((r) => r.id === 'p5')!.pts).toBe(1)
    expect(table.find((r) => r.id === 'p4')!.pe).toBe(1)
    expect(Object.keys(computePadelStats([m]))).toHaveLength(0)
  })

  it('un partido a 4 games suma medio punto al ranking general', () => {
    const t = tucan()
    const s = computePadelStats([play(t, 'G0-0', 'p5', 'p4', [[4, 2]])])
    expect(s['p5-1'].points).toBe(0.5)
    expect(s['p4-1'].points).toBe(0)
  })
})

describe('eliminación directa', () => {
  it('con 5 parejas, las 3 mejores pasan directo a la segunda ronda', () => {
    const t: PadelTournament = { ...tucan(), format: 'knockout', groups: null, advance: null, pairs: pairs(['a', 'b', 'c', 'd', 'e']) }
    const st = tournamentState(t, [])
    const r0 = st.knockout![0]
    expect(r0).toHaveLength(4)
    expect(r0.filter((f) => f.a === BYE || f.b === BYE)).toHaveLength(3)
    expect(st.knockout![1][0].a).toBe('a') // el 1 pasa directo a semis
    expect(st.total).toBe(4) // 1 cruce de primera ronda + 2 semis + final
  })
  it('rondas del cuadro según cuántas parejas entran', () => {
    expect(koTies(8)).toEqual([4, 2, 1])
    expect(koTies(5)).toEqual([4, 2, 1])
    expect(koTies(2)).toEqual([1])
    expect(qualifiersCount([4, 4], 2)).toBe(4)
    expect(qualifiersCount([4, 3], 'all')).toBe(7)
  })
})

describe('resultados válidos', () => {
  it('set a 4 games: 4-0 a 4-3', () => {
    expect(setProblem({ a: 4, b: 3 }, 4, 0)).toBeNull()
    expect(setProblem({ a: 5, b: 3 }, 4, 0)).not.toBeNull()
    expect(setProblem({ a: 3, b: 3 }, 4, 0)).not.toBeNull()
  })
  it('set a 4 games con tie-break en 4-4: 4-2, 5-3 y 5-4 sí; 4-3 no', () => {
    expect(setProblem({ a: 4, b: 2 }, 4, 0, 4)).toBeNull()
    expect(setProblem({ a: 5, b: 3 }, 4, 0, 4)).toBeNull()
    expect(setProblem({ a: 4, b: 5 }, 4, 0, 4)).toBeNull()
    expect(setProblem({ a: 4, b: 3 }, 4, 0, 4)).not.toBeNull()
    expect(setProblem({ a: 6, b: 4 }, 4, 0, 4)).not.toBeNull()
    expect(resultProblem([{ a: 5, b: 4 }], 'g4', false, 4)).toBeNull()
    expect(resultProblem([{ a: 5, b: 4 }], 'g4', false)).not.toBeNull()
  })
  it('set a 6 games: 6-4, 7-5 y 7-6 sí; 6-5 no', () => {
    expect(setProblem({ a: 6, b: 4 }, 6, 0)).toBeNull()
    expect(setProblem({ b: 7, a: 5 }, 6, 0)).toBeNull()
    expect(setProblem({ a: 7, b: 6 }, 6, 0)).toBeNull()
    expect(setProblem({ a: 6, b: 5 }, 6, 0)).not.toBeNull()
  })
  it('mejor de 3: hace falta el tercero si van 1 a 1, salvo empate permitido', () => {
    expect(resultProblem([{ a: 6, b: 4 }, { a: 4, b: 6 }], 'bo3', false)).not.toBeNull()
    expect(resultProblem([{ a: 6, b: 4 }, { a: 4, b: 6 }], 'bo3', true)).toBeNull()
    expect(resultProblem([{ a: 6, b: 4 }, { a: 6, b: 2 }, { a: 2, b: 6 }], 'bo3', false)).not.toBeNull()
    expect(resultProblem([{ a: 4, b: 1 }], 'g4', false)).toBeNull()
  })
})
