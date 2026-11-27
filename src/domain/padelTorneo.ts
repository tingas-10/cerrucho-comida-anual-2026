// Torneos de pádel: fixture de la liga y de los grupos, tablas, cuadro de eliminación y campeón.
// Los cruces no se guardan: todo sale de los partidos (`tournamentId`, `fixtureId`, `entrantA/B`),
// así corregir un resultado acomoda la tabla y el cuadro solos.
import { FORMATO_PARTIDO, PADEL_TORNEO } from '../content/padel'
import type { PadelFormat, PadelMatch, PadelTGame, PadelTournament } from '../data/types'
import { winnerOf } from './padel'
import { BYE, roundRobin, seedOrder, splitGroups } from './truco'

export { BYE }

export interface PResult {
  winner: string | null // pareja que ganó; null = empate (sólo en liga o grupos)
  sets: Array<{ a: number; b: number }> // vistos desde la pareja `a` del cruce
  resultOnly: boolean
  matchId: string
}

export interface PFixture {
  key: string
  stage: 'rr' | 'ko' // rr = liga o grupo; ko = cuadro
  round: number // fecha (liga o grupo) o ronda del cuadro (0 = la primera)
  index: number // número de cruce dentro de la ronda del cuadro
  group: number | null
  a: string | null // pareja, BYE o null si todavía no se sabe
  b: string | null
  aLabel: string | null // de dónde sale mientras no se sabe: "1° Grupo A", "Ganador semi 1"
  bLabel: string | null
  format: PadelFormat
  result: PResult | null
  openMatchId: string | null // partido abierto (en cancha) de este cruce
  live: boolean
}

export interface PRow {
  id: string
  pj: number
  pg: number
  pe: number
  pp: number
  sw: number // sets ganados
  sl: number
  gw: number // games ganados
  gl: number
  pts: number
}

export interface PadelTState {
  league: { fixtures: PFixture[]; rounds: number; table: PRow[]; done: boolean } | null
  groups: Array<{ name: string; ids: string[]; fixtures: PFixture[]; rounds: number; table: PRow[]; done: boolean }> | null
  knockout: PFixture[][] | null
  champion: string | null
  runnerUp: string | null
  played: number
  total: number
}

interface Res {
  done: Record<string, PadelMatch>
  open: Record<string, PadelMatch>
}

function collect(t: PadelTournament, matches: PadelMatch[]): Res {
  const done: Record<string, PadelMatch> = {}
  const open: Record<string, PadelMatch> = {}
  for (const m of matches) {
    if (m.tournamentId !== t.id || !m.fixtureId) continue
    if (m.status === 'PLAYED') {
      if (!m.entrantA || !m.entrantB) continue
      if (!m.draw && !winnerOf(m)) continue
      const prev = done[m.fixtureId]
      if (!prev || m.updatedAt > prev.updatedAt) done[m.fixtureId] = m
    } else {
      const prev = open[m.fixtureId]
      if (!prev || m.updatedAt > prev.updatedAt) open[m.fixtureId] = m
    }
  }
  return { done, open }
}

/** Resultado de un partido visto desde el cruce (la pareja `a` puede haber quedado como B en el partido). */
export function resultFromMatch(m: PadelMatch, a: string): PResult {
  const flip = m.entrantA !== a
  const w = m.draw ? null : winnerOf(m)
  const winner = w === null ? null : w === 'A' ? (m.entrantA ?? null) : (m.entrantB ?? null)
  const sets = m.resultOnly ? [] : m.sets.map((s) => (flip ? { a: s.b, b: s.a } : { a: s.a, b: s.b }))
  return { winner, sets, resultOnly: !!m.resultOnly, matchId: m.id }
}

function makeFixture(
  key: string,
  stage: PFixture['stage'],
  round: number,
  index: number,
  group: number | null,
  a: string | null,
  b: string | null,
  format: PadelFormat,
  res: Res,
  aLabel: string | null = null,
  bLabel: string | null = null,
): PFixture {
  const m = res.done[key]
  // Si cambió quién juega ese cruce (se corrigió un resultado anterior), el resultado viejo no vale.
  const valid = !!m && !!a && !!b && ((m.entrantA === a && m.entrantB === b) || (m.entrantA === b && m.entrantB === a))
  const result = valid ? resultFromMatch(m, a!) : null
  const open = result ? undefined : res.open[key]
  return { key, stage, round, index, group, a, b, aLabel, bLabel, format, result, openMatchId: open?.id ?? null, live: open?.status === 'LIVE' }
}

/** ¿Este cruce se juega? (ya se sabe quiénes son y no es un pase libre) */
export function playable(f: PFixture): boolean {
  return !!f.a && !!f.b && f.a !== BYE && f.b !== BYE
}

export function fixtureWinner(f: PFixture): string | null {
  if (f.a === BYE && f.b === BYE) return BYE
  if (f.a === BYE) return f.b
  if (f.b === BYE) return f.a
  return f.result?.winner ?? null
}

/** Fixture de un grupo o de la liga. Con 4 parejas: 1-3 y 2-4, después 1-4 y 2-3, y al final 1-2 y 3-4
 *  (las dos primeras del sorteo se cruzan en la última fecha). Con otra cantidad, todos contra todos. */
export function rrGames(ids: string[], legs: 1 | 2 = 1): PadelTGame[] {
  if (ids.length === 4) {
    const [p1, p2, p3, p4] = ids
    const ida: PadelTGame[] = [
      { r: 0, a: p1, b: p3 },
      { r: 0, a: p2, b: p4 },
      { r: 1, a: p1, b: p4 },
      { r: 1, a: p2, b: p3 },
      { r: 2, a: p1, b: p2 },
      { r: 2, a: p3, b: p4 },
    ]
    return legs === 2 ? [...ida, ...ida.map((g) => ({ r: g.r + 3, a: g.b, b: g.a }))] : ida
  }
  return roundRobin(ids, legs).flatMap((pairs, r) => pairs.map(([a, b]) => ({ r, a, b })))
}

/** Arma los grupos con su fixture, en el orden dado (sorteado o por ranking, en zigzag). */
export function buildGroups(ids: string[], n: number): Array<{ name: string; ids: string[]; games: PadelTGame[] }> {
  return splitGroups(ids, n).map((g) => ({ ...g, games: rrGames(g.ids) }))
}

/** Tabla: puntos; si empatan dos, el partido entre ellos; después diferencia de sets, de games y games a favor. */
export function standings(ids: string[], fixtures: PFixture[], points: PadelTournament['points']): PRow[] {
  const rows: Record<string, PRow> = Object.fromEntries(ids.map((id) => [id, { id, pj: 0, pg: 0, pe: 0, pp: 0, sw: 0, sl: 0, gw: 0, gl: 0, pts: 0 }]))
  for (const f of fixtures) {
    const r = f.result
    if (!r || !f.a || !f.b || !rows[f.a] || !rows[f.b]) continue
    const ra = rows[f.a]
    const rb = rows[f.b]
    ra.pj++
    rb.pj++
    for (const s of r.sets) {
      ra.gw += s.a
      ra.gl += s.b
      rb.gw += s.b
      rb.gl += s.a
      if (s.a > s.b) {
        ra.sw++
        rb.sl++
      } else if (s.b > s.a) {
        rb.sw++
        ra.sl++
      }
    }
    if (r.winner === null) {
      ra.pe++
      rb.pe++
      ra.pts += points.draw
      rb.pts += points.draw
    } else {
      const [w, l] = r.winner === f.a ? [ra, rb] : [rb, ra]
      w.pg++
      l.pp++
      w.pts += points.win
      l.pts += points.loss
    }
  }
  const sorted = ids
    .map((id) => rows[id])
    .sort((x, y) => y.pts - x.pts || y.sw - y.sl - (x.sw - x.sl) || y.gw - y.gl - (x.gw - x.gl) || y.gw - x.gw || ids.indexOf(x.id) - ids.indexOf(y.id))
  // Dos empatados en puntos: manda el partido entre ellos.
  for (let i = 0; i < sorted.length; i++) {
    let j = i
    while (j + 1 < sorted.length && sorted[j + 1].pts === sorted[i].pts) j++
    if (j === i + 1 && sorted[i].pj > 0) {
      const [x, y] = [sorted[i].id, sorted[j].id]
      const direct = fixtures.filter((f) => f.result && f.result.winner !== null && ((f.a === x && f.b === y) || (f.a === y && f.b === x)))
      const yWins = direct.filter((f) => f.result!.winner === y).length
      const xWins = direct.filter((f) => f.result!.winner === x).length
      if (yWins > xWins) [sorted[i], sorted[j]] = [sorted[j], sorted[i]]
    }
    i = j
  }
  return sorted
}

/** Rondas del cuadro según cuántas parejas entran: cuántos cruces tiene cada una (la última es la final). */
export function koTies(entrants: number): number[] {
  if (entrants < 2) return []
  let size = 1
  while (size < entrants) size *= 2
  const out: number[] = []
  for (let ties = size / 2; ties >= 1; ties /= 2) out.push(ties)
  return out
}

/** Cuántas parejas pasan al cuadro desde los grupos. */
export function qualifiersCount(groupSizes: number[], advance: PadelTournament['advance']): number {
  return groupSizes.reduce((acc, n) => acc + (advance === 'all' || !advance ? n : Math.min(advance, n)), 0)
}

export function koFormat(t: Pick<PadelTournament, 'formats'>, ties: number): PadelFormat {
  return t.formats.ko[String(ties)] ?? PADEL_TORNEO.formatoLlave
}

export function roundTitle(ties: number): string {
  if (ties === 1) return 'Final'
  if (ties === 2) return 'Semifinales'
  if (ties === 4) return 'Cuartos de final'
  if (ties === 8) return 'Octavos de final'
  if (ties === 16) return 'Dieciseisavos'
  return `Ronda de ${ties * 2}`
}

/** Nombre corto de un cruce del cuadro: "Final", "Semi 1", "Cuartos 3". */
export function tieName(ties: number, index: number): string {
  if (ties === 1) return 'Final'
  if (ties === 2) return `Semi ${index + 1}`
  if (ties === 4) return `Cuartos ${index + 1}`
  if (ties === 8) return `Octavos ${index + 1}`
  return `Cruce ${index + 1}`
}

interface Slot {
  id: string | null
  label: string | null
}

function bracket(first: Slot[], t: PadelTournament, res: Res): PFixture[][] {
  const rounds: PFixture[][] = []
  const r0: PFixture[] = []
  const ties0 = first.length / 2
  for (let i = 0; i < ties0; i++) {
    const a = first[2 * i]
    const b = first[2 * i + 1]
    r0.push(makeFixture(`K-0-${i}`, 'ko', 0, i, null, a.id, b.id, koFormat(t, ties0), res, a.label, b.label))
  }
  rounds.push(r0)
  const slotOf = (f: PFixture): Slot => {
    const w = fixtureWinner(f)
    if (w) return { id: w, label: null }
    // Pase libre de alguien que todavía no se sabe: hereda su etiqueta ("1° Grupo A").
    if (f.a === BYE) return { id: null, label: f.bLabel }
    if (f.b === BYE) return { id: null, label: f.aLabel }
    return { id: null, label: `Ganador ${tieName(rounds[f.round].length, f.index).toLowerCase()}` }
  }
  for (let r = 1; rounds[r - 1].length > 1; r++) {
    const prev = rounds[r - 1]
    const ties = prev.length / 2
    const cur: PFixture[] = []
    for (let i = 0; i < ties; i++) {
      const a = slotOf(prev[2 * i])
      const b = slotOf(prev[2 * i + 1])
      cur.push(makeFixture(`K-${r}-${i}`, 'ko', r, i, null, a.id, b.id, koFormat(t, ties), res, a.label, b.label))
    }
    rounds.push(cur)
  }
  return rounds
}

function seeded(seeds: Slot[]): Slot[] {
  let size = 1
  while (size < seeds.length) size *= 2
  return seedOrder(size).map((s) => (s <= seeds.length ? seeds[s - 1] : { id: BYE, label: null }))
}

/** Estado del torneo armado a partir de sus partidos: tablas, cuadro y campeón. */
export function tournamentState(t: PadelTournament, matches: PadelMatch[]): PadelTState {
  const res = collect(t, matches)
  const rrFixtures = (prefix: string, games: PadelTGame[], group: number | null) => games.map((g, i) => makeFixture(`${prefix}-${i}`, 'rr', g.r, i, group, g.a, g.b, t.formats.rr, res))
  const countOf = (list: PFixture[]) => {
    const all = list.filter((f) => f.a !== BYE && f.b !== BYE)
    return { played: all.filter((f) => f.result).length, total: all.length }
  }
  const roundsOf = (games: PadelTGame[]) => games.reduce((m, g) => Math.max(m, g.r + 1), 0)

  if (t.format === 'league') {
    const fixtures = rrFixtures('L', t.games ?? [], null)
    const c = countOf(fixtures)
    const ids = t.pairs.map((p) => p.id)
    const table = standings(ids, fixtures, t.points)
    const done = c.total > 0 && c.played === c.total
    return { league: { fixtures, rounds: roundsOf(t.games ?? []), table, done }, groups: null, knockout: null, champion: done ? table[0]?.id ?? null : null, runnerUp: done ? table[1]?.id ?? null : null, ...c }
  }

  let first: Slot[] = []
  let groups: PadelTState['groups'] = null
  if (t.format === 'knockout') {
    first = seeded(t.pairs.map((p) => ({ id: p.id, label: null })))
  } else {
    groups = (t.groups ?? []).map((g, gi) => {
      const fixtures = rrFixtures(`G${gi}`, g.games, gi)
      const c = countOf(fixtures)
      return { name: g.name, ids: g.ids, fixtures, rounds: roundsOf(g.games), table: standings(g.ids, fixtures, t.points), done: c.total > 0 && c.played === c.total }
    })
    const gs = groups
    const k = t.advance === 'all' || !t.advance ? Math.max(0, ...gs.map((g) => g.ids.length)) : t.advance
    const d = (g: number, pos: number): Slot => {
      const grp = gs[g]
      if (pos >= grp.ids.length) return { id: BYE, label: null }
      return grp.done ? { id: grp.table[pos].id, label: null } : { id: null, label: `${pos + 1}° ${grp.name}` }
    }
    const G = gs.length
    const pow2 = (n: number) => n > 0 && (n & (n - 1)) === 0
    if (k === 2 && G >= 2 && G % 2 === 0 && pow2(2 * G) && gs.every((g) => g.ids.length >= 2)) {
      // Como en el Mundial: el 1° de un grupo contra el 2° del otro, y los dos de un mismo grupo en mitades distintas.
      const top: Slot[] = []
      const bottom: Slot[] = []
      for (let c = 0; c < G / 2; c++) {
        top.push(d(2 * c, 0), d(2 * c + 1, 1))
        bottom.push(d(2 * c + 1, 0), d(2 * c, 1))
      }
      first = [...top, ...bottom]
    } else {
      const seeds: Slot[] = []
      for (let pos = 0; pos < k; pos++) {
        const order = Array.from({ length: G }, (_, g) => (pos % 2 === 0 ? g : G - 1 - g))
        for (const g of order) if (pos < gs[g].ids.length) seeds.push(d(g, pos))
      }
      first = seeds.length >= 2 ? seeded(seeds) : []
    }
  }

  const knockout = first.length >= 2 ? bracket(first, t, res) : []
  const final = knockout[knockout.length - 1]?.[0]
  const champion = final ? fixtureWinner(final) : null
  const runnerUp = final && champion && champion !== BYE ? (final.a === champion ? final.b : final.a) : null
  const all = [...(groups ?? []).flatMap((g) => g.fixtures), ...knockout.flat()]
  return { league: null, groups, knockout, champion: champion === BYE ? null : champion, runnerUp, ...countOf(all) }
}

/** Todos los cruces del torneo (liga, grupos y cuadro). */
export function allFixtures(st: PadelTState): PFixture[] {
  return [...(st.league?.fixtures ?? []), ...(st.groups ?? []).flatMap((g) => g.fixtures), ...(st.knockout ?? []).flat()]
}

/** Dónde se juega un cruce: "Grupo A · Fecha 1", "Fecha 3", "Semi 2", "Final". */
export function fixtureTitle(f: PFixture, st: PadelTState): string {
  if (f.stage === 'ko') return tieName(st.knockout?.[f.round]?.length ?? 1, f.index)
  if (f.group !== null && st.groups) return `${st.groups[f.group].name} · Fecha ${f.round + 1}`
  return `Fecha ${f.round + 1}`
}

/** Valida los games de un set según el formato. Devuelve el problema o null. */
export function setProblem(s: { a: number; b: number }, games: 4 | 6, i: number, tiebreak4: 3 | 4 = 3): string | null {
  const hi = Math.max(s.a, s.b)
  const lo = Math.min(s.a, s.b)
  const n = `El set ${i + 1}`
  if (s.a === s.b) return `${n} está empatado: alguien lo tiene que ganar.`
  if (games === 4 && tiebreak4 === 4)
    return (hi === 4 && lo <= 2) || (hi === 5 && (lo === 3 || lo === 4)) ? null : `${n} es a 4 games con tie-break en 4-4: termina 4-0, 4-1, 4-2, 5-3 o 5-4.`
  if (games === 4) return hi === 4 && lo <= 3 ? null : `${n} es a 4 games: termina 4-0, 4-1, 4-2 o 4-3 (en 3-3 hay tie-break).`
  if ((hi === 6 && lo <= 4) || (hi === 7 && (lo === 5 || lo === 6))) return null
  return `${n} no cierra: termina 6 a 4 o menos, 7-5 o 7-6.`
}

/** Sets que hacen falta según el formato del cruce y el problema del resultado cargado (o null si está bien). */
export function resultProblem(sets: Array<{ a: number; b: number }>, format: PadelFormat, allowDraw: boolean, tiebreak4: 3 | 4 = 3): string | null {
  const f = FORMATO_PARTIDO[format]
  if (!sets.length) return 'Cargá el resultado.'
  for (let i = 0; i < sets.length; i++) {
    const p = setProblem(sets[i], f.games, i, tiebreak4)
    if (p) return p
  }
  const need = Math.floor(f.bestOf / 2) + 1
  let a = 0
  let b = 0
  for (let i = 0; i < sets.length; i++) {
    if (a === need || b === need) return `El partido ya estaba definido antes del set ${i + 1}. Borrá el set de más.`
    if (sets[i].a > sets[i].b) a++
    else b++
  }
  if (a === need || b === need) return null
  if (allowDraw && a === b) return null
  return f.bestOf === 1 ? 'Cargá el set.' : 'Falta el set que define el partido.'
}

/** Cómo se define un set a 4 games en este torneo, para mostrarlo. */
export function shortSetText(t: Pick<PadelTournament, 'tiebreak4'>): string {
  return t.tiebreak4 === 4 ? 'en 3-3 siguen, en 4-4 hay tie-break y termina 5-4' : 'en 3-3 hay tie-break y termina 4-3'
}
