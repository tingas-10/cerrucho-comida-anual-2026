// Piezas compartidas de FMO: jugadores (miembros + invitados), pestañas y selector de año.
import { useMemo } from 'react'
import { NavLink } from 'react-router-dom'
import { useCollection, useMembers } from '../../data/hooks'
import { P } from '../../data/paths'
import type { FmoGuest, FmoMatch } from '../../data/types'
import { colorFor } from '../../domain/format'

export interface FmoPlayer {
  id: string
  name: string
  guest: boolean
  color: string
}

export interface FmoPlayers {
  list: FmoPlayer[]
  byId: Record<string, FmoPlayer>
  nameOf: (id: string) => string
  loading: boolean
}

/** Jugadores posibles: todos los miembros (no suspendidos) más los invitados. */
export function useFmoPlayers(): FmoPlayers {
  const members = useMembers()
  const guests = useCollection<FmoGuest>(P.fmoGuests)
  return useMemo(() => {
    const list: FmoPlayer[] = [
      ...members.list.filter((m) => m.status !== 'suspended').map((m) => ({ id: m.id, name: m.alias, guest: false, color: m.avatarColor ?? colorFor(m.id) })),
      ...guests.rows.map((g) => ({ id: g.id, name: g.name, guest: true, color: colorFor(g.id) })),
    ].sort((a, b) => a.name.localeCompare(b.name, 'es'))
    const byId: Record<string, FmoPlayer> = {}
    for (const p of list) byId[p.id] = p
    return { list, byId, nameOf: (id: string) => byId[id]?.name ?? 'Jugador', loading: members.loading || guests.loading }
  }, [members.list, members.loading, guests.rows, guests.loading])
}

export function useFmoMatches() {
  return useCollection<FmoMatch>(P.fmoMatches)
}

const TABS = [
  { to: '/fmo', label: 'Partidos', end: true },
  { to: '/fmo/ranking', label: 'Ranking' },
  { to: '/fmo/jugadores', label: 'Jugadores' },
  { to: '/fmo/versus', label: '1 vs 1' },
]

export function FmoTabs() {
  return (
    <nav className="flex gap-1 overflow-x-auto pb-2 mb-4 -mx-1 px-1" aria-label="Secciones de FMO">
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => `nav-link whitespace-nowrap ${isActive ? 'active' : ''}`}>
          {t.label}
        </NavLink>
      ))}
    </nav>
  )
}

export function YearSelect({ value, onChange, years, allowAll }: { value: number | 'all'; onChange: (v: number | 'all') => void; years: number[]; allowAll?: boolean }) {
  return (
    <select className="input w-auto" aria-label="Año" value={String(value)} onChange={(e) => onChange(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
      {years.map((y) => (
        <option key={y} value={y}>
          {y}
        </option>
      ))}
      {allowAll ? <option value="all">Histórico</option> : null}
    </select>
  )
}
