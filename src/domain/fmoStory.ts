// Datos de la historia de Instagram de un partido de FMO: ganador, goleadores y el "bailado" al azar.
// El azar es fijo por partido (sale de su id), así todos ven y bajan la misma historia; "Otro jugador" cambia la tirada.
import type { FmoMatch } from '../data/types'
import { scoreOf, teamOf, type Team } from './fmo'

/** Número estable a partir de un texto (FNV-1a). */
export function hashString(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export interface StoryData {
  winner: Team | null // null = empate
  score: { a: number; b: number }
  scorersA: Array<{ id: string; goals: number }>
  scorersB: Array<{ id: string; goals: number }>
  chosenId: string | null // jugador del equipo ganador (en empate, de cualquiera)
  imageIndex: number
}

export function storyData(m: FmoMatch, roll: number, imageCount: number): StoryData {
  const score = scoreOf(m)
  const winner: Team | null = score.a === score.b ? null : score.a > score.b ? 'A' : 'B'
  const scorers = (t: Team) =>
    teamOf(m, t)
      .filter((id) => (m.players[id].goals || 0) > 0)
      .map((id) => ({ id, goals: m.players[id].goals }))
      .sort((x, y) => y.goals - x.goals || x.id.localeCompare(y.id))
  // Orden fijo de candidatos para que el azar no dependa del orden en que se guardaron.
  const pool = (winner ? teamOf(m, winner) : [...teamOf(m, 'A'), ...teamOf(m, 'B')]).sort()
  const h = hashString(`${m.id}:${roll}`)
  return {
    winner,
    score,
    scorersA: scorers('A'),
    scorersB: scorers('B'),
    chosenId: pool.length ? pool[h % pool.length] : null,
    imageIndex: imageCount > 0 ? hashString(`${m.id}:img:${roll}`) % imageCount : 0,
  }
}
