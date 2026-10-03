// ============================================================
// CONTENIDO EDITABLE · FMO (fútbol de la banda)
// Puntajes del ranking, tamaños de equipo y nombres por defecto.
// ============================================================

export const FMO = {
  nombre: 'FMO',
  // Puntos del ranking anual.
  puntos: {
    ganado: 2,
    empatado: 1, // Agus definió ganado, gol y perdido; el empate queda en 1 (cambiar acá si no).
    perdido: 0,
    gol: 0.5,
  },
  // Jugadores por equipo permitidos (5 vs 5 hasta 8 vs 8).
  tamanios: [5, 6, 7, 8],
  tamanioDefault: 5,
  equipoA: 'Claros',
  equipoB: 'Oscuros',
} as const
