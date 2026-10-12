// Piezas compartidas de Golf: datos, pestañas, nombres de participantes y tarjeta.
import { useMemo } from 'react'
import { NavLink } from 'react-router-dom'
import { GOLF, GOLF_MODOS } from '../../content/golf'
import { useCollection, useDoc } from '../../data/hooks'
import { P } from '../../data/paths'
import type { GolfChallenge, GolfConfig, GolfCourse, GolfEntrant, GolfPlayerDoc, GolfProposal, GolfRound } from '../../data/types'
import type { FmoPlayers } from '../fmo/fmoShared'

export function useGolfRounds() {
  return useCollection<GolfRound>(P.golfRounds)
}
export function useGolfCourses() {
  const c = useCollection<GolfCourse>(P.golfCourses)
  const active = useMemo(() => c.rows.filter((x) => !x.archived).sort((a, b) => a.name.localeCompare(b.name, 'es')), [c.rows])
  return { ...c, active }
}
export function useGolfConfig() {
  const d = useDoc<GolfConfig>(P.golfConfig)
  return { ...d, points: d.data?.points ?? { participation: GOLF.puntosIniciales.participation, positions: [...GOLF.puntosIniciales.positions], byField: { '2': [...GOLF.puntosIniciales.byField['2']], '3': [...GOLF.puntosIniciales.byField['3']] } } }
}
export function useGolfChallenges() {
  return useCollection<GolfChallenge>(P.golfChallenges)
}
export function useGolfProposals() {
  return useCollection<GolfProposal>(P.golfProposals)
}
/** Hándicap cargado de cada jugador (miembros e invitados). */
export function useGolfHcps() {
  const c = useCollection<GolfPlayerDoc>(P.golfPlayers)
  const byId = useMemo(() => Object.fromEntries(c.rows.map((r) => [r.id, r])) as Record<string, GolfPlayerDoc & { id: string }>, [c.rows])
  return { ...c, byId, hcpOf: (id: string) => byId[id]?.hcp ?? null }
}

const TABS = [
  { to: '/golf', label: 'Partidos', end: true },
  { to: '/golf/ranking', label: 'Ranking' },
  { to: '/golf/jugadores', label: 'Jugadores' },
  { to: '/golf/modalidades', label: 'Modalidades' },
  { to: '/golf/canchas', label: 'Canchas' },
  { to: '/golf/comision', label: 'Comisión' },
]

export function GolfTabs() {
  return (
    <nav className="flex gap-1 overflow-x-auto pb-2 mb-4 -mx-1 px-1" aria-label="Secciones de Golf">
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => `nav-link whitespace-nowrap ${isActive ? 'active' : ''}`}>
          {t.label}
        </NavLink>
      ))}
    </nav>
  )
}

export function entrantName(e: GolfEntrant, players: FmoPlayers): string {
  return e.players.length ? e.players.map(players.nameOf).join(' / ') : 'Equipo sin jugadores'
}

export function modeLabel(r: Pick<GolfRound, 'mode' | 'useHcp'>): string {
  return `${GOLF_MODOS[r.mode].corto}${r.useHcp ? '' : ' · sin hándicap'}`
}

export function formatHcp(h: number | null | undefined): string {
  if (h === null || h === undefined) return '—'
  const s = Number.isInteger(h) ? String(h) : h.toFixed(1).replace('.', ',')
  return h < 0 ? `+${s.slice(1)}` : s
}

/** Opciones de cancha agrupadas por club ("Jockey Club Argentino · Colorada" → grupo "Jockey Club Argentino"). */
export function courseGroups(courses: GolfCourse[]): Array<{ club: string; items: GolfCourse[] }> {
  const groups = new Map<string, GolfCourse[]>()
  for (const c of courses) {
    const club = c.name.split(' · ')[0]
    groups.set(club, [...(groups.get(club) ?? []), c])
  }
  return [...groups.entries()].map(([club, items]) => ({ club, items }))
}

