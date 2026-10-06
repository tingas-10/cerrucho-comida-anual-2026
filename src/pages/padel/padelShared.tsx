// Piezas compartidas de Pádel: partidos, pestañas, nombres de pareja y la cancha azul.
import { Plus } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useCollection } from '../../data/hooks'
import { P } from '../../data/paths'
import type { PadelMatch } from '../../data/types'
import { initials } from '../../domain/format'
import type { Pair } from '../../domain/padel'
import type { FmoPlayers } from '../fmo/fmoShared'

export function usePadelMatches() {
  return useCollection<PadelMatch>(P.padelMatches)
}

const TABS = [
  { to: '/padel', label: 'Partidos', end: true },
  { to: '/padel/ranking', label: 'Ranking' },
  { to: '/padel/parejas', label: 'Parejas' },
  { to: '/padel/jugadores', label: 'Jugadores' },
  { to: '/padel/versus', label: '1 vs 1' },
]

export function PadelTabs() {
  return (
    <nav className="flex gap-1 overflow-x-auto pb-2 mb-4 -mx-1 px-1" aria-label="Secciones de Pádel">
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => `nav-link whitespace-nowrap ${isActive ? 'active' : ''}`}>
          {t.label}
        </NavLink>
      ))}
    </nav>
  )
}

export function pairName(m: PadelMatch, pair: Pair, players: FmoPlayers): string {
  const ids = (pair === 'A' ? m.pairA : m.pairB).filter(Boolean)
  return ids.length ? ids.map(players.nameOf).join(' / ') : pair === 'A' ? 'Pareja de arriba' : 'Pareja de abajo'
}

export const POSITION_LABEL = ['Drive', 'Revés'] as const

/** Lugar de cada jugador en la cancha. Arriba miran hacia abajo, así que su drive queda a la izquierda de la pantalla. */
function slotXY(pair: Pair, idx: 0 | 1): { x: number; y: number } {
  const left = 27
  const right = 73
  if (pair === 'A') return { x: idx === 0 ? left : right, y: 27 }
  return { x: idx === 0 ? right : left, y: 73 }
}

export function PadelCourt({ match, players, onSlot, readOnly }: { match: PadelMatch; players: FmoPlayers; onSlot?: (pair: Pair, idx: 0 | 1) => void; readOnly?: boolean }) {
  const slots: Array<{ pair: Pair; idx: 0 | 1; id: string }> = [
    { pair: 'A', idx: 0, id: match.pairA[0] },
    { pair: 'A', idx: 1, id: match.pairA[1] },
    { pair: 'B', idx: 0, id: match.pairB[0] },
    { pair: 'B', idx: 1, id: match.pairB[1] },
  ]
  const line = 'rgba(255,255,255,.9)'
  return (
    <div
      className="relative w-full mx-auto rounded-2xl overflow-hidden select-none shadow-lg"
      style={{ aspectRatio: '1 / 2', maxWidth: 'min(360px, max(230px, calc((100dvh - 230px) / 2)))', background: '#0b2547', border: '3px solid rgba(170,205,255,.45)' }}
      aria-label="Cancha de pádel"
    >
      {/* Superficie azul */}
      <div className="absolute inset-[5%] rounded-sm" style={{ background: 'linear-gradient(180deg, #2364b8, #1d58a5)', border: `2px solid ${line}` }}>
        <div className="absolute left-0 right-0" style={{ top: '15.25%', borderTop: `2px solid ${line}` }} />
        <div className="absolute left-0 right-0" style={{ top: '84.75%', borderTop: `2px solid ${line}` }} />
        <div className="absolute" style={{ left: '50%', top: '15.25%', bottom: '15.25%', borderLeft: `2px solid ${line}` }} />
      </div>
      {/* Red */}
      <div
        className="absolute left-[2%] right-[2%] top-1/2 -translate-y-1/2 pointer-events-none"
        style={{ height: 8, borderTop: '2px solid #fff', background: 'repeating-linear-gradient(90deg, rgba(255,255,255,.75) 0 1px, rgba(10,20,40,.75) 1px 5px)' }}
      />
      <span className="absolute left-[7%] top-[6.5%] text-[11px] font-bold text-white/90 pointer-events-none max-w-[80%] truncate">{pairNameShort(match, 'A', players)}</span>
      <span className="absolute left-[7%] bottom-[6.5%] text-[11px] font-bold text-white/90 pointer-events-none max-w-[80%] truncate">{pairNameShort(match, 'B', players)}</span>

      {slots.map(({ pair, idx, id }) => {
        const { x, y } = slotXY(pair, idx)
        const p = id ? players.byId[id] : null
        const name = id ? players.nameOf(id) : ''
        const ring = pair === 'A' ? '#ffffff' : '#d9b45f'
        const content = id ? (
          <>
            <span className="grid place-items-center rounded-full font-extrabold text-[14px] shadow-md overflow-hidden" style={{ width: 52, height: 52, background: p?.color ?? '#fff', color: '#191409', border: `3px solid ${ring}` }}>
              {p?.photo ? <img src={p.photo} alt="" className="w-full h-full object-cover" draggable={false} /> : initials(name)}
            </span>
            <span className="text-[11px] font-bold text-white px-1.5 rounded bg-black/45 max-w-[96px] truncate">{name}</span>
          </>
        ) : (
          <>
            <span className="grid place-items-center rounded-full text-white/90" style={{ width: 52, height: 52, border: '2px dashed rgba(255,255,255,.8)', background: 'rgba(255,255,255,.08)' }}>
              {readOnly ? null : <Plus size={20} />}
            </span>
            <span className="text-[10px] font-bold text-white/80">{POSITION_LABEL[idx]}</span>
          </>
        )
        const style = { left: `${x}%`, top: `${y}%` }
        const label = `${pair === 'A' ? 'Pareja de arriba' : 'Pareja de abajo'}, ${POSITION_LABEL[idx]}: ${name || 'vacío'}`
        return readOnly || !onSlot ? (
          <div key={pair + idx} className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5" style={style} aria-label={label}>
            {content}
          </div>
        ) : (
          <button key={pair + idx} type="button" onClick={() => onSlot(pair, idx)} className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5" style={style} aria-label={`${label}. Tocá para cambiar.`}>
            {content}
          </button>
        )
      })}
    </div>
  )
}

function pairNameShort(m: PadelMatch, pair: Pair, players: FmoPlayers): string {
  const ids = (pair === 'A' ? m.pairA : m.pairB).filter(Boolean)
  return ids.length === 2 ? ids.map(players.nameOf).join(' / ') : ''
}
