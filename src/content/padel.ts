// ============================================================
// CONTENIDO EDITABLE · Pádel de la banda
// Formatos de partido, puntos del ranking y cupo de invitados.
// ============================================================

export const PADEL = {
  nombre: 'Pádel',
  // Sets del partido: a 1 set, al mejor de 3 o al mejor de 5.
  formatos: [1, 3, 5] as const,
  formatoDefault: 3 as 1 | 3 | 5,
  // Puntos para cada jugador de la pareja ganadora (la que pierde suma 0).
  puntos: { 1: 1, 3: 2, 5: 3 } as Record<number, number>,
  // Un partido es entre 4: al menos 3 de la banda y hasta 1 invitado.
  maxInvitados: 1,
} as const

export function formatoLabel(bestOf: number): string {
  return bestOf === 1 ? 'A 1 set' : `Al mejor de ${bestOf}`
}
