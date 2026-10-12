// ============================================================
// CONTENIDO EDITABLE · Golf de la banda
// Modalidades, comisión inicial, puntos iniciales del ranking y plazo para corregir.
// El sistema de puntos vigente lo cambia la comisión (2 aprobaciones) y vive en Firestore (config/golf).
// ============================================================

import type { GolfMode } from '../data/types'

export const GOLF_MODOS: Record<GolfMode, { label: string; corto: string; desc: string; equipos: boolean; soloTotal: boolean }> = {
  medal: { label: 'Medal (golpes)', corto: 'Medal', desc: 'Gana el que hace menos golpes. Con hándicap se compara el neto (golpes menos hándicap).', equipos: false, soloTotal: true },
  stableford: { label: 'Stableford', corto: 'Stableford', desc: 'Puntos por hoyo: 2 por el par, 3 por birdie, 1 por bogey, 0 si te pasás más. Con hándicap cuentan los golpes que recibís en cada hoyo. Gana el que suma más.', equipos: false, soloTotal: false },
  match: { label: 'Match play 1 vs 1', corto: 'Match play', desc: 'Dos jugadores, hoyo por hoyo: gana el hoyo el que hace menos. Con hándicap, el de más hándicap recibe la diferencia en los hoyos más difíciles. Gana el que gana más hoyos.', equipos: false, soloTotal: false },
  fourball: { label: 'Parejas · mejor pelota', corto: 'Mejor pelota', desc: 'Parejas de 2: cada uno juega su pelota y en cada hoyo cuenta el mejor de la pareja. Gana la pareja con menos golpes en total.', equipos: true, soloTotal: false },
  scramble: { label: 'Scramble por equipos', corto: 'Scramble', desc: 'Equipos de 2 o más: todos tiran, eligen el mejor tiro y siguen desde ahí. Una tarjeta por equipo. Gana el equipo con menos golpes.', equipos: true, soloTotal: true },
}

export const GOLF = {
  nombre: 'Golf',
  modoDefault: 'stableford' as GolfMode,
  horaDefault: '09:00',
  // Comisión de golf inicial (se cambia desde Administración → Miembros): Pato, Morron, Yayo y Orrito.
  comisionInicial: ['m-pato', 'm-saimon', 'm-agus', 'm-tomi'],
  aprobacionesNecesarias: 2,
  // Puntos iniciales del ranking (pedido de Agus, 12/10): 1 por jugar y, por puesto, según cuántos juegan
  // (jugadores o equipos): 2 → 5/0 · 3 → 7/3/0 · 4 o más → 10/6/4. El último nunca suma por puesto. Los cambia la comisión.
  puntosIniciales: { participation: 1, positions: [10, 6, 4], byField: { '2': [5, 0], '3': [7, 3, 0] } },
  // Después de guardar una ronda jugada, los jugadores la pueden corregir durante este plazo; después, la comisión.
  horasParaCorregir: 48,
  parDefault: 4,
} as const
