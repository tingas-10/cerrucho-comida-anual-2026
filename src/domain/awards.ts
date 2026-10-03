// Reglas puras de los premios: conteo, ballotage y resultado.
// No dependen de Firebase ni de React. Están cubiertas por awards.test.ts.
import { MARGEN_PRIMERA_RONDA, NOBODY } from '../content/premios'

export type Counts = Record<string, number>

export interface Round1Resolution {
  outcome: 'WINNER' | 'DESERTED' | 'NO_VOTES' | 'RUNOFF_REQUIRED'
  winner?: string
  finalists?: string[]
  counts: Counts
}

export interface Round2Resolution {
  outcome: 'WINNER' | 'DESERTED' | 'NO_VOTES' | 'TIE'
  winner?: string
  tied?: string[]
  counts: Counts
}

/** Cuenta la última selección válida de cada elector. `allowed` filtra claves válidas. */
export function countBallots(choices: Array<string | null | undefined>, allowed?: Set<string>): Counts {
  const counts: Counts = {}
  for (const c of choices) {
    if (!c) continue
    if (allowed && !allowed.has(c)) continue
    counts[c] = (counts[c] ?? 0) + 1
  }
  return counts
}

function winnerOrDeserted(key: string): 'WINNER' | 'DESERTED' {
  return key === NOBODY ? 'DESERTED' : 'WINNER'
}

export function resolveRound1(counts: Counts, margin = MARGEN_PRIMERA_RONDA): Round1Resolution {
  const voted = Object.entries(counts).filter(([, n]) => n > 0)
  if (voted.length === 0) return { outcome: 'NO_VOTES', counts }
  if (voted.length === 1) {
    const [key] = voted[0]
    return { outcome: winnerOrDeserted(key), winner: key === NOBODY ? undefined : key, counts }
  }
  const sorted = voted.map(([, n]) => n).sort((a, b) => b - a)
  const leaderVotes = sorted[0]
  const secondVotes = sorted[1]
  if (leaderVotes - secondVotes >= margin) {
    const [key] = voted.find(([, n]) => n === leaderVotes)!
    return { outcome: winnerOrDeserted(key), winner: key === NOBODY ? undefined : key, counts }
  }
  const finalists = voted
    .filter(([, n]) => leaderVotes - n < margin)
    .map(([k]) => k)
    .sort()
  return { outcome: 'RUNOFF_REQUIRED', finalists, counts }
}

export function resolveRound2(counts: Counts): Round2Resolution {
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  if (total === 0) return { outcome: 'NO_VOTES', counts }
  const top = Math.max(...Object.values(counts))
  const topKeys = Object.entries(counts)
    .filter(([, n]) => n === top)
    .map(([k]) => k)
    .sort()
  if (topKeys.length > 1) return { outcome: 'TIE', tied: topKeys, counts }
  const key = topKeys[0]
  return { outcome: winnerOrDeserted(key), winner: key === NOBODY ? undefined : key, counts }
}

/** Nominados de ceremonia para un premio resuelto en primera ronda: todas las opciones votadas, alfabético. */
export function directNominees(counts: Counts, labelOf: (k: string) => string): string[] {
  return Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([k]) => k)
    .sort((a, b) => labelOf(a).localeCompare(labelOf(b), 'es'))
}

/** Orden aleatorio pero fijo por usuario para mostrar finalistas sin pista de liderazgo. */
export function stableShuffle<T>(items: T[], seed: string): T[] {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  const rand = () => {
    h += 0x6d2b79f5
    let t = h
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}
