// ============================================================
// CONTENIDO EDITABLE · Pádel de la banda
// Formatos de partido, puntos del ranking y cupo de invitados.
// ============================================================

import type { PadelFormat } from '../data/types'

export const PADEL = {
  nombre: 'Pádel',
  // Sets del partido: a 1 set, al mejor de 3 o al mejor de 5.
  formatos: [1, 3, 5] as const,
  formatoDefault: 3 as 1 | 3 | 5,
  // Puntos para cada jugador de la pareja ganadora (la que pierde suma 0).
  puntos: { 1: 1, 3: 2, 5: 3 } as Record<number, number>,
  // Un partido a 4 games (set corto) suma medio punto (pedido de Agus, 26/11/2026).
  puntosCorto: 0.5,
  // Un partido es entre 4: al menos 3 de la banda y hasta 1 invitado.
  maxInvitados: 1,
} as const

export function formatoLabel(bestOf: number): string {
  return bestOf === 1 ? 'A 1 set' : `Al mejor de ${bestOf}`
}

// ---------- Torneos ----------

export const FORMATO_PARTIDO: Record<PadelFormat, { label: string; corto: string; bestOf: 1 | 3; games: 4 | 6 }> = {
  g4: { label: 'A 4 games', corto: '4 games', bestOf: 1, games: 4 },
  s1: { label: 'A 1 set', corto: '1 set', bestOf: 1, games: 6 },
  bo3: { label: 'Al mejor de 3 sets', corto: 'Mejor de 3', bestOf: 3, games: 6 },
}

export const PADEL_TORNEO = {
  // Puntos de la tabla del torneo (liga o grupos), si no se cambian al crearlo.
  puntos: { win: 3, draw: 1, loss: 0 },
  formatoTabla: 'g4' as PadelFormat,
  formatoLlave: 's1' as PadelFormat,
}

export const FORMATO_TORNEO = {
  league: { label: 'Liga', text: 'Todos contra todos. Gana el que más puntos suma en la tabla.' },
  knockout: { label: 'Eliminación directa', text: 'Cuadro de cruces: el que pierde queda afuera.' },
  groups: { label: 'Grupos + eliminación', text: 'Todos contra todos en cada grupo y los mejores pasan al cuadro.' },
} as const
