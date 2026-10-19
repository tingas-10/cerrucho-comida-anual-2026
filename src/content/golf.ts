// ============================================================
// CONTENIDO EDITABLE · Golf de la banda
// Modalidades, comisión inicial, puntos iniciales del ranking y plazo para corregir.
// El sistema de puntos vigente lo cambia la comisión (2 aprobaciones) y vive en Firestore (config/golf).
// ============================================================

import type { GolfMode } from '../data/types'

// Modalidades (pedido de Pato, 12/10): 1 vs 1, Four ball y Laguneada por equipos. Cada una tiene su ranking
// y además suman al ranking general. Medal y stableford quedan sólo para partidos viejos (ya no se eligen).
// "solo" es la vuelta individual: no suma puntos, pero cuenta para el historial del jugador y de la cancha.
export const GOLF_MODOS: Record<GolfMode, { label: string; corto: string; desc: string; equipos: boolean; soloTotal: boolean }> = {
  match: { label: '1 vs 1 (match play)', corto: '1 vs 1', desc: 'Dos jugadores, hoyo por hoyo: gana el hoyo el que hace menos golpes. Con hándicap, el de más hándicap recibe la diferencia en los hoyos más difíciles. Gana el que gana más hoyos.', equipos: false, soloTotal: false },
  fourball: { label: 'Four ball (mejor pelota)', corto: 'Four ball', desc: 'Parejas de 2: cada uno juega su pelota y en cada hoyo cuenta el mejor de la pareja. Gana la pareja con menos golpes en total.', equipos: true, soloTotal: false },
  sixes: {
    label: 'Partidito de a tres · 4, 2, 0',
    corto: 'Partidito de a 3',
    desc: 'Tres jugadores. En cada hoyo: el que gana suma 4, el segundo 2 y el tercero 0. Si empatan los dos primeros, 3 y 3; si empatan los dos segundos, 4 para el primero y 1 y 1. Se netea para que el último siempre quede en 0 y gana el que más puntos tiene al final (en inglés le dicen "Sixes").',
    equipos: false,
    soloTotal: false,
  },
  scramble: { label: 'Laguneada por equipos', corto: 'Laguneada', desc: 'Equipos de 2 o más: tiran todos, eligen el mejor tiro y siguen desde ahí. Una tarjeta por equipo. Gana el equipo con menos golpes.', equipos: true, soloTotal: true },
  solo: { label: 'Vuelta individual', corto: 'Vuelta individual', desc: 'Una vuelta tuya, sola o sin competir. No suma puntos, pero cuenta para tu historial y el de la cancha.', equipos: false, soloTotal: true },
  medal: { label: 'Medal (golpes)', corto: 'Medal', desc: 'Gana el que hace menos golpes. Con hándicap se compara el neto.', equipos: false, soloTotal: true },
  stableford: { label: 'Stableford', corto: 'Stableford', desc: 'Puntos por hoyo según el par y el hándicap. Gana el que suma más.', equipos: false, soloTotal: false },
}

/** Las que se eligen al armar un partido (cada una con su ranking). */
export const MODOS_ACTIVOS: GolfMode[] = ['match', 'fourball', 'scramble', 'sixes']

export const GOLF = {
  nombre: 'Golf',
  modoDefault: 'match' as GolfMode,
  jugadoresPorLinea: 4,
  horaDefault: '09:00',
  // Comisión de golf inicial (se cambia desde Administración → Miembros): Pato, Morron, Yayo y Orrito.
  comisionInicial: ['m-pato', 'm-saimon', 'm-agus', 'm-tomi'],
  aprobacionesNecesarias: 2,
  // Puntos iniciales del ranking (pedido de Agus, 12/10): 1 por jugar y, por puesto, según cuántos juegan
  // (jugadores o equipos): 2 → 5/0 · 3 → 7/3/0 · 4 o más → 10/6/4. El último nunca suma por puesto. Los cambia la comisión.
  puntosIniciales: { participation: 1, positions: [10, 6, 4], byField: { '2': [5, 0], '3': [7, 3, 0] } },
  // Después de guardar un partido jugado, los jugadores la pueden corregir durante este plazo; después, la comisión.
  horasParaCorregir: 48,
  parDefault: 4,
} as const
