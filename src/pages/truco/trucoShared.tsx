// Piezas compartidas de Truco: partidos, torneos, pestañas, nombres de equipo y el dibujo de los fósforos.
import { NavLink } from 'react-router-dom'
import { useCollection } from '../../data/hooks'
import { P } from '../../data/paths'
import type { TrucoMatch, TrucoTournament } from '../../data/types'
import type { Side } from '../../domain/truco'
import type { FmoPlayers } from '../fmo/fmoShared'

export function useTrucoMatches() {
  return useCollection<TrucoMatch>(P.trucoMatches)
}

export function useTrucoTournaments() {
  return useCollection<TrucoTournament>(P.trucoTournaments)
}

const TABS = [
  { to: '/truco', label: 'Partidos', end: true },
  { to: '/truco/ranking', label: 'Ranking' },
  { to: '/truco/torneos', label: 'Torneos' },
  { to: '/truco/versus', label: '1 vs 1' },
  { to: '/truco/reglas', label: 'Cómo se juega' },
]

export function TrucoTabs() {
  return (
    <nav className="flex gap-1 overflow-x-auto pb-2 mb-4 -mx-1 px-1" aria-label="Secciones de Truco">
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => `nav-link whitespace-nowrap ${isActive ? 'active' : ''}`}>
          {t.label}
        </NavLink>
      ))}
    </nav>
  )
}

/** Quiénes juegan en un equipo: "Pato / Yayo" (o el nombre del equipo si todavía no hay nadie). */
export function teamPlayers(m: TrucoMatch, side: Side, players: FmoPlayers): string {
  const ids = (side === 'A' ? m.teamA : m.teamB).filter(Boolean)
  return ids.length ? ids.map(players.nameOf).join(' / ') : side === 'A' ? m.nameA : m.nameB
}

/** Nombre del equipo para mostrar: en 1 vs 1, el jugador; si no, el nombre del equipo. */
export function teamLabel(m: TrucoMatch, side: Side, players: FmoPlayers): string {
  if (m.size === 1) return teamPlayers(m, side, players)
  return side === 'A' ? m.nameA : m.nameB
}

// ---------- Fósforos ----------
// Como en el anotador de papel: cada cuadrado son 5 puntos (4 lados y la diagonal).
const STICKS: Array<{ x1: number; y1: number; x2: number; y2: number }> = [
  { x1: 9, y1: 47, x2: 9, y2: 9 }, // izquierda (cabeza arriba)
  { x1: 9, y1: 9, x2: 47, y2: 9 }, // arriba (cabeza a la derecha)
  { x1: 47, y1: 9, x2: 47, y2: 47 }, // derecha (cabeza abajo)
  { x1: 47, y1: 47, x2: 9, y2: 47 }, // abajo (cabeza a la izquierda)
  { x1: 12, y1: 44, x2: 44, y2: 12 }, // diagonal
]

function Square({ count, size, lastIndex }: { count: number; size: number; lastIndex: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" aria-hidden className="block">
      <rect x="3" y="3" width="50" height="50" rx="8" className="fill-[var(--soft)] opacity-40" />
      {STICKS.slice(0, count).map((s, i) => {
        // La madera va del extremo 1 a la cabeza (extremo 2); la cabeza queda un poco más gruesa.
        const dx = s.x2 - s.x1
        const dy = s.y2 - s.y1
        const len = Math.hypot(dx, dy)
        const hx = s.x2 - (dx / len) * 3
        const hy = s.y2 - (dy / len) * 3
        return (
          <g key={i} className={i === lastIndex ? 'fosforo-nuevo' : undefined}>
            <line x1={s.x1} y1={s.y1} x2={hx} y2={hy} stroke="#d8a65c" strokeWidth="4.5" strokeLinecap="round" />
            <line x1={s.x1} y1={s.y1} x2={hx} y2={hy} stroke="#b9853f" strokeWidth="1.2" strokeLinecap="round" opacity=".6" />
            <circle cx={hx} cy={hy} r="4" fill="#b3261e" />
            <circle cx={hx - 1} cy={hy - 1} r="1.3" fill="#e2675e" />
          </g>
        )
      })}
    </svg>
  )
}

/** Los fósforos de un equipo. A 30: las malas (3 cuadrados) y al lado las buenas (otros 3). */
export function Fosforos({ score, target, size = 52, animate = true }: { score: number; target: number; size?: number; animate?: boolean }) {
  const filled = Math.max(0, Math.min(score, target))
  const groups = Math.ceil(target / 5)
  const last = animate ? filled - 1 : -1
  const squares = Array.from({ length: groups }, (_, g) => {
    const count = Math.max(0, Math.min(5, filled - g * 5))
    return <Square key={g} count={count} size={size} lastIndex={last >= g * 5 && last < g * 5 + 5 ? last - g * 5 : -1} />
  })
  if (target !== 30) return <div className="flex flex-col items-center gap-1">{squares}</div>
  return (
    <div className="grid grid-cols-2 gap-1.5">
      <div className="flex flex-col items-center gap-1">
        <span className="text-[11px] muted uppercase tracking-wide">Malas</span>
        {squares.slice(0, 3)}
      </div>
      <div className="flex flex-col items-center gap-1 border-l-2 border-dashed border-[var(--border)] pl-1.5">
        <span className="text-[11px] muted uppercase tracking-wide">Buenas</span>
        {squares.slice(3)}
      </div>
    </div>
  )
}
