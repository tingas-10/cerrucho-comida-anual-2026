// Reglas puras de FMO: resultado de un partido, estadísticas por jugador, ranking anual y 1 vs 1.
import { FMO } from '../content/fmo'
import type { FmoMatch } from '../data/types'

export type Team = 'A' | 'B'

export function scoreOf(m: FmoMatch): { a: number; b: number } {
  let a = Math.max(0, m.otherA || 0)
  let b = Math.max(0, m.otherB || 0)
  for (const p of Object.values(m.players)) {
    if (p.team === 'A') a += p.goals || 0
    else b += p.goals || 0
  }
  return { a, b }
}

export function teamOf(m: FmoMatch, team: Team): string[] {
  return Object.entries(m.players)
    .filter(([, p]) => p.team === team)
    .map(([id]) => id)
}

/** Titulares (en la cancha) y suplentes de un equipo. Los suplentes no tienen límite. */
export function startersOf(m: FmoMatch, team: Team): string[] {
  return teamOf(m, team).filter((id) => !m.players[id].sub)
}

export function subsOf(m: FmoMatch, team: Team): string[] {
  return teamOf(m, team).filter((id) => m.players[id].sub)
}

/** Próximos partidos (por jugarse), del más cercano al más lejano. */
export function upcomingMatches(matches: FmoMatch[]): FmoMatch[] {
  return matches.filter((m) => m.status === 'DRAFT').sort((a, b) => a.playedAt - b.playedAt)
}

/** Resultado del partido para un jugador: G, E, P o null si no jugó. */
export function resultFor(m: FmoMatch, playerId: string): 'W' | 'D' | 'L' | null {
  const p = m.players[playerId]
  if (!p) return null
  const s = scoreOf(m)
  if (s.a === s.b) return 'D'
  const winner: Team = s.a > s.b ? 'A' : 'B'
  return p.team === winner ? 'W' : 'L'
}

/** Año calendario del partido en hora de Buenos Aires (UTC-3). */
export function yearOf(ms: number): number {
  return new Date(ms - 3 * 3600000).getUTCFullYear()
}

export interface PlayerStats {
  playerId: string
  played: number
  won: number
  drawn: number
  lost: number
  goals: number
  points: number
}

export function emptyStats(playerId: string): PlayerStats {
  return { playerId, played: 0, won: 0, drawn: 0, lost: 0, goals: 0, points: 0 }
}

export function pointsOf(s: Pick<PlayerStats, 'won' | 'drawn' | 'lost' | 'goals'>): number {
  const p = FMO.puntos
  return s.won * p.ganado + s.drawn * p.empatado + s.lost * p.perdido + s.goals * p.gol
}

/** Sólo cuentan los partidos guardados como jugados. `year` filtra por año; sin año es el histórico. */
export function computeStats(matches: FmoMatch[], year?: number): Record<string, PlayerStats> {
  const out: Record<string, PlayerStats> = {}
  for (const m of matches) {
    if (m.status !== 'PLAYED') continue
    if (year !== undefined && yearOf(m.playedAt) !== year) continue
    for (const [id, p] of Object.entries(m.players)) {
      const s = (out[id] ??= emptyStats(id))
      s.played++
      s.goals += p.goals || 0
      const r = resultFor(m, id)
      if (r === 'W') s.won++
      else if (r === 'D') s.drawn++
      else if (r === 'L') s.lost++
    }
  }
  for (const s of Object.values(out)) s.points = pointsOf(s)
  return out
}

/** Ranking: puntos, después partidos ganados, después goles, después menos partidos jugados. */
export function ranking(stats: Record<string, PlayerStats>): PlayerStats[] {
  return Object.values(stats).sort((x, y) => y.points - x.points || y.won - x.won || y.goals - x.goals || x.played - y.played || x.playerId.localeCompare(y.playerId))
}

export interface HeadToHead {
  against: { played: number; aWins: number; bWins: number; draws: number; aGoals: number; bGoals: number }
  together: { played: number; won: number; drawn: number; lost: number }
}

export function headToHead(matches: FmoMatch[], a: string, b: string, year?: number): HeadToHead {
  const out: HeadToHead = { against: { played: 0, aWins: 0, bWins: 0, draws: 0, aGoals: 0, bGoals: 0 }, together: { played: 0, won: 0, drawn: 0, lost: 0 } }
  for (const m of matches) {
    if (m.status !== 'PLAYED') continue
    if (year !== undefined && yearOf(m.playedAt) !== year) continue
    const pa = m.players[a]
    const pb = m.players[b]
    if (!pa || !pb) continue
    const ra = resultFor(m, a)
    if (pa.team === pb.team) {
      out.together.played++
      if (ra === 'W') out.together.won++
      else if (ra === 'D') out.together.drawn++
      else out.together.lost++
    } else {
      out.against.played++
      out.against.aGoals += pa.goals || 0
      out.against.bGoals += pb.goals || 0
      if (ra === 'W') out.against.aWins++
      else if (ra === 'L') out.against.bWins++
      else out.against.draws++
    }
  }
  return out
}

export function yearsWithMatches(matches: FmoMatch[], currentYear: number): number[] {
  const set = new Set<number>([currentYear])
  for (const m of matches) if (m.status === 'PLAYED') set.add(yearOf(m.playedAt))
  return Array.from(set).sort((x, y) => y - x)
}

// Posiciones por defecto en la cancha (porcentajes). El equipo A ocupa la mitad de arriba, el B la de abajo.
const SLOTS_A: Array<[number, number]> = [
  [50, 7],
  [28, 20],
  [72, 20],
  [50, 30],
  [22, 40],
  [78, 40],
  [40, 43],
  [60, 43],
]

export function defaultPosition(team: Team, index: number): { x: number; y: number } {
  const [x, y] = SLOTS_A[index % SLOTS_A.length]
  return team === 'A' ? { x, y } : { x: 100 - x, y: 100 - y }
}

export function formatPoints(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',')
}
