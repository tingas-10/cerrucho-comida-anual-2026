// Datos de la historia de Instagram de un partido de golf: quién ganó, a quién se nombra, foto y frase.
// El azar es fijo por partido (sale de su id), así todos ven y bajan la misma historia; "Otra" cambia la tirada.
import type { GolfRound } from '../data/types'
import { hashString } from './fmoStory'
import { roundResult, type Standing } from './golf'

export interface GolfStoryData {
  standings: Standing[]
  winners: string[] // jugadores del (o de los) que salieron primeros
  chosenId: string | null // el nombrado en el globo, uno de los ganadores
  gary: boolean // ganó alguien que siempre lleva foto de Gary Player
  imageIndex: number // dentro de la lista que toca (Gary o las otras)
  phraseIndex: number
}

export function golfStoryData(r: GolfRound, roll: number, cfg: { garyPara: string[]; gary: unknown[]; otras: unknown[]; frases: unknown[] }): GolfStoryData {
  const res = roundResult(r)
  const winners = [...new Set(res.standings.filter((s) => s.position === 1).flatMap((s) => s.players))].sort()
  const gary = winners.some((id) => cfg.garyPara.includes(id)) && cfg.gary.length > 0
  const pick = (salt: string, n: number) => (n > 0 ? hashString(`${r.id}:${salt}:${roll}`) % n : 0)
  return {
    standings: res.standings,
    winners,
    chosenId: winners.length ? winners[pick('quien', winners.length)] : null,
    gary,
    imageIndex: pick('foto', gary ? cfg.gary.length : cfg.otras.length),
    phraseIndex: pick('frase', cfg.frases.length),
  }
}
