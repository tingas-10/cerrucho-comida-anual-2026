// Reglas puras de pádel: validación del partido, ganador por sets, estadísticas, rankings y 1 vs 1.
import { PADEL } from '../content/padel'
import type { PadelMatch } from '../data/types'
import { yearOf } from './fmo'

export type Pair = 'A' | 'B'

export function setsToWin(bestOf: number): number {
  return Math.floor(bestOf / 2) + 1
}

export function playersOf(m: PadelMatch): string[] {
  return [...m.pairA, ...m.pairB].filter(Boolean)
}

export function pairOf(m: PadelMatch, playerId: string): Pair | null {
  if (m.pairA.includes(playerId)) return 'A'
  if (m.pairB.includes(playerId)) return 'B'
  return null
}

/** Sets ganados por cada pareja y games totales. */
export function tally(m: PadelMatch): { a: number; b: number; gamesA: number; gamesB: number } {
  let a = 0
  let b = 0
  let gamesA = 0
  let gamesB = 0
  for (const s of m.sets) {
    gamesA += s.a
    gamesB += s.b
    if (s.a > s.b) a++
    else if (s.b > s.a) b++
  }
  return { a, b, gamesA, gamesB }
}

/** Pareja ganadora si los sets cargados definen el partido; si no, null. */
export function winnerOf(m: PadelMatch): Pair | null {
  const t = tally(m)
  const need = setsToWin(m.bestOf)
  if (t.a >= need && t.a > t.b) return 'A'
  if (t.b >= need && t.b > t.a) return 'B'
  return null
}

/** Devuelve null si el partido se puede guardar como jugado, o el motivo. */
export function validateMatch(m: PadelMatch, isGuest: (id: string) => boolean): string | null {
  const ids = playersOf(m)
  if (ids.length < 4) return 'Faltan jugadores: un partido es entre 4.'
  if (new Set(ids).size < 4) return 'Hay un jugador repetido.'
  if (ids.filter(isGuest).length > PADEL.maxInvitados) return `Puede jugar hasta ${PADEL.maxInvitados} invitado.`
  if (!(PADEL.formatos as readonly number[]).includes(m.bestOf)) return 'Elegí el formato del partido.'
  if (m.sets.length === 0) return 'Cargá el resultado de los sets.'
  const need = setsToWin(m.bestOf)
  let a = 0
  let b = 0
  for (let i = 0; i < m.sets.length; i++) {
    const s = m.sets[i]
    if (!Number.isInteger(s.a) || !Number.isInteger(s.b) || s.a < 0 || s.b < 0 || s.a > 99 || s.b > 99) return `El set ${i + 1} tiene un número raro.`
    if (s.a === s.b) return `El set ${i + 1} está empatado: alguien lo tiene que ganar.`
    if (a === need || b === need) return `El partido ya estaba definido antes del set ${i + 1}. Borrá los sets de más.`
    if (s.a > s.b) a++
    else b++
  }
  if (a < need && b < need) return m.bestOf === 1 ? 'Cargá el set.' : `Falta definir: alguien tiene que ganar ${need} sets.`
  return null
}

export interface PadelStats {
  id: string // jugador o pareja ("a+b")
  players: string[]
  played: number
  won: number
  lost: number
  setsWon: number
  setsLost: number
  gamesWon: number
  gamesLost: number
  points: number
}

export function emptyPadelStats(id: string, players: string[] = [id]): PadelStats {
  return { id, players, played: 0, won: 0, lost: 0, setsWon: 0, setsLost: 0, gamesWon: 0, gamesLost: 0, points: 0 }
}

function counted(matches: PadelMatch[], year?: number): PadelMatch[] {
  return matches.filter((m) => m.status === 'PLAYED' && winnerOf(m) !== null && (year === undefined || yearOf(m.playedAt) === year))
}

function addResult(s: PadelStats, m: PadelMatch, side: Pair) {
  const t = tally(m)
  const won = winnerOf(m) === side
  s.played++
  if (won) {
    s.won++
    s.points += PADEL.puntos[m.bestOf] ?? 0
  } else s.lost++
  s.setsWon += side === 'A' ? t.a : t.b
  s.setsLost += side === 'A' ? t.b : t.a
  s.gamesWon += side === 'A' ? t.gamesA : t.gamesB
  s.gamesLost += side === 'A' ? t.gamesB : t.gamesA
}

/** Estadísticas por jugador. Sólo cuentan los partidos jugados con ganador. */
export function computePadelStats(matches: PadelMatch[], year?: number): Record<string, PadelStats> {
  const out: Record<string, PadelStats> = {}
  for (const m of counted(matches, year)) {
    for (const side of ['A', 'B'] as const) {
      for (const id of (side === 'A' ? m.pairA : m.pairB).filter(Boolean)) addResult((out[id] ??= emptyPadelStats(id)), m, side)
    }
  }
  return out
}

export function pairKey(ids: string[]): string {
  return [...ids].sort().join('+')
}

/** Estadísticas por pareja (sin importar quién jugó de drive o de revés). */
export function computePairStats(matches: PadelMatch[], year?: number): Record<string, PadelStats> {
  const out: Record<string, PadelStats> = {}
  for (const m of counted(matches, year)) {
    for (const side of ['A', 'B'] as const) {
      const ids = (side === 'A' ? m.pairA : m.pairB).filter(Boolean)
      if (ids.length !== 2) continue
      const key = pairKey(ids)
      addResult((out[key] ??= emptyPadelStats(key, [...ids].sort())), m, side)
    }
  }
  return out
}

/** Ranking: puntos, después ganados, diferencia de sets, diferencia de games y menos partidos jugados. */
export function padelRanking(stats: Record<string, PadelStats>): PadelStats[] {
  return Object.values(stats).sort(
    (x, y) =>
      y.points - x.points ||
      y.won - x.won ||
      y.setsWon - y.setsLost - (x.setsWon - x.setsLost) ||
      y.gamesWon - y.gamesLost - (x.gamesWon - x.gamesLost) ||
      x.played - y.played ||
      x.id.localeCompare(y.id),
  )
}

export interface PadelHeadToHead {
  against: { played: number; aWins: number; bWins: number; aSets: number; bSets: number }
  together: { played: number; won: number; lost: number }
}

export function padelHeadToHead(matches: PadelMatch[], a: string, b: string, year?: number): PadelHeadToHead {
  const out: PadelHeadToHead = { against: { played: 0, aWins: 0, bWins: 0, aSets: 0, bSets: 0 }, together: { played: 0, won: 0, lost: 0 } }
  for (const m of counted(matches, year)) {
    const pa = pairOf(m, a)
    const pb = pairOf(m, b)
    if (!pa || !pb) continue
    const w = winnerOf(m)
    const t = tally(m)
    if (pa === pb) {
      out.together.played++
      if (w === pa) out.together.won++
      else out.together.lost++
    } else {
      out.against.played++
      out.against.aSets += pa === 'A' ? t.a : t.b
      out.against.bSets += pb === 'A' ? t.a : t.b
      if (w === pa) out.against.aWins++
      else out.against.bWins++
    }
  }
  return out
}

/** Con quién jugó cada uno: récord por compañero. */
export function partnersOf(matches: PadelMatch[], playerId: string, year?: number): PadelStats[] {
  const out: Record<string, PadelStats> = {}
  for (const m of counted(matches, year)) {
    const side = pairOf(m, playerId)
    if (!side) continue
    const mate = (side === 'A' ? m.pairA : m.pairB).find((id) => id && id !== playerId)
    if (!mate) continue
    addResult((out[mate] ??= emptyPadelStats(mate)), m, side)
  }
  return padelRanking(out)
}

export function padelYears(matches: PadelMatch[], currentYear: number): number[] {
  const set = new Set<number>([currentYear])
  for (const m of matches) if (m.status === 'PLAYED') set.add(yearOf(m.playedAt))
  return Array.from(set).sort((x, y) => y - x)
}

export function setsText(m: PadelMatch): string {
  return m.sets.map((s) => `${s.a}-${s.b}`).join(' · ')
}
