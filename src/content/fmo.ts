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

// Historia para Instagram que se genera al guardar un partido (1080 x 1920).
// Las imágenes viven en public/fmo-historia/. `foco` es dónde está la cara (0 = arriba, 1 = abajo).
export const FMO_HISTORIA = {
  frase: 'Te bailo tácticamente',
  imagenes: [
    { src: 'fmo-historia/azzaro-1.png', foco: 0.38 },
    { src: 'fmo-historia/azzaro-2.png', foco: 0.4 },
  ],
  web: 'tingas-10.github.io/cerrucho-comida-anual-2026',
}

