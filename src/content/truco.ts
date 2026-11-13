// ============================================================
// CONTENIDO EDITABLE · Truco de la banda
// Puntos del ranking, formatos, a cuántos se juega y nombres por defecto.
// ============================================================

export const TRUCO = {
  nombre: 'Truco',
  // Ranking: el que gana suma, el que pierde resta (cada jugador del equipo).
  puntos: { gana: 1.5, pierde: -1 },
  // Jugadores por equipo: 1 vs 1, 2 vs 2 y 3 vs 3.
  formatos: [1, 2, 3] as const,
  // A cuántos puntos: 30 (15 malas y 15 buenas) o 15 (sin malas ni buenas).
  aCuanto: [30, 15] as const,
  aCuantoDefault: 30 as 15 | 30,
  equipoA: 'Nosotros',
  equipoB: 'Ellos',
} as const

export function formatoTruco(size: number): string {
  return `${size} vs ${size}`
}

export function aCuantoLabel(target: number): string {
  return target === 30 ? 'A 30 (malas y buenas)' : `A ${target}`
}
