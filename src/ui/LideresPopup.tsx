// Popup de una sola vez: los número 1 del ranking del año en FMO y en Truco.
// Sale la primera vez que alguien abre la web después de publicarlo (una vez por celular o compu)
// y no vuelve a salir. Para lanzar otro popup así más adelante, cambiar SEEN_KEY.
import { Goal, Spade, Trophy, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { computeStats, formatPoints, ranking, yearOf } from '../domain/fmo'
import { computeTrucoStats, trucoRanking } from '../domain/truco'
import { useFmoMatches, useFmoPlayers, type FmoPlayers } from '../pages/fmo/fmoShared'
import { useTrucoMatches } from '../pages/truco/trucoShared'
import { Avatar } from './components'

const SEEN_KEY = 'cerrucho-popup-numero-uno-2026-11'

function alreadySeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1'
  } catch {
    return false
  }
}

function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, '1')
  } catch {
    /* sin almacenamiento: puede volver a salir, no pasa nada */
  }
}

const plural = (n: number, one: string, many: string) => `${formatPoints(n)} ${n === 1 ? one : many}`

/** Los número 1 (pueden ser varios si empatan en todo, como una pareja de truco que sólo jugó junta). */
interface Leader {
  ids: string[]
  points: number
  detail: string
  next?: { id: string; points: number }
}

/** Separa a los que empatan con el primero en todos los criterios del ranking (no en el orden alfabético). */
function topGroup<T>(rows: T[], same: (a: T, b: T) => boolean): { top: T[]; next?: T } {
  if (!rows.length) return { top: [] }
  const top = rows.filter((r) => same(r, rows[0]))
  return { top, next: rows.find((r) => !same(r, rows[0])) }
}

function names(ids: string[], players: FmoPlayers): string {
  const n = ids.map(players.nameOf)
  if (n.length <= 3) return n.length === 1 ? n[0] : `${n.slice(0, -1).join(', ')} y ${n[n.length - 1]}`
  return `${n.slice(0, 2).join(', ')} y ${n.length - 2} más`
}

function gapText(l: Leader, players: FmoPlayers): string | null {
  if (!l.next) return null
  const many = l.ids.length > 1
  const name = players.nameOf(l.next.id)
  const diff = l.points - l.next.points
  return diff > 0 ? `${many ? 'Le sacan' : 'Le saca'} ${plural(diff, 'punto', 'puntos')} a ${name}` : `Mismos puntos que ${name}, ${many ? 'ganan' : 'gana'} por desempate`
}

function LeaderCard({ sport, icon, leader, players, to, onGo }: { sport: string; icon: ReactNode; leader: Leader; players: FmoPlayers; to: string; onGo: () => void }) {
  const shown = leader.ids.slice(0, 3)
  const size = shown.length === 1 ? 72 : shown.length === 2 ? 56 : 46
  const gap = gapText(leader, players)
  return (
    <div className="rounded-2xl bg-white/[.06] border border-white/10 px-2.5 pt-3 pb-3.5 flex flex-col items-center text-center min-w-0">
      <p className="text-[11px] uppercase tracking-[.18em] font-bold text-[#e7c877] flex items-center gap-1.5">
        {icon} {sport}
      </p>
      <div className="relative mt-6">
        <span className="absolute -top-[26px] left-1/2 -translate-x-1/2 text-[26px] leading-none drop-shadow" aria-hidden>
          👑
        </span>
        <div className="flex justify-center">
          {shown.map((id, i) => (
            <div key={id} className={`rounded-full p-[3px] ${i ? '-ml-3' : ''}`} style={{ background: 'linear-gradient(135deg, #f8e3a0, #b8862b 60%, #f1d27a)' }}>
              <div className="rounded-full p-[2px] bg-[#12141c]">
                <Avatar id={id} alias={players.nameOf(id)} size={size} color={players.byId[id]?.color} photo={players.byId[id]?.photo} />
              </div>
            </div>
          ))}
        </div>
        <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#d9b45f] text-[#191409] text-sm font-extrabold flex items-center justify-center border-2 border-[#12141c]" aria-hidden>
          1
        </span>
      </div>
      <p className="mt-3 text-lg sm:text-xl font-extrabold leading-tight break-words max-w-full">{names(leader.ids, players)}</p>
      <p className="mt-1 text-[28px] font-extrabold tabular-nums leading-none text-[#e7c877]">
        {formatPoints(leader.points)} <span className="text-sm font-bold">pts</span>
      </p>
      <p className="mt-1.5 text-xs text-white/70 leading-snug">{leader.detail}</p>
      {gap ? <p className="mt-2 text-[11px] leading-snug px-2.5 py-1 rounded-full bg-white/10 text-white/85">{gap}</p> : null}
      <Link to={to} onClick={onGo} className="mt-auto pt-3 text-sm font-semibold text-[#e7c877] hover:underline underline-offset-4">
        Ver el ranking →
      </Link>
    </div>
  )
}

export function LideresPopup() {
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState(alreadySeen)
  const { rows: fmo, loading: lf } = useFmoMatches()
  const { rows: truco, loading: lt } = useTrucoMatches()
  const players = useFmoPlayers()
  const year = yearOf(Date.now())
  const ref = useRef<HTMLDivElement>(null)

  const fmoLeader = useMemo<Leader | null>(() => {
    const { top, next } = topGroup(ranking(computeStats(fmo, year)), (x, y) => x.points === y.points && x.won === y.won && x.goals === y.goals && x.played === y.played)
    const a = top[0]
    if (!a) return null
    const many = top.length > 1
    const goles = a.goals ? ` · ${plural(a.goals, 'gol', 'goles')}${many ? ' cada uno' : ''}` : ''
    return { ids: top.map((t) => t.playerId), points: a.points, detail: `${many ? 'Ganaron' : 'Ganó'} ${a.won} de ${a.played}${goles}`, next: next ? { id: next.playerId, points: next.points } : undefined }
  }, [fmo, year])

  const trucoLeader = useMemo<Leader | null>(() => {
    const { top, next } = topGroup(trucoRanking(computeTrucoStats(truco, year)), (x, y) => x.points === y.points && x.won === y.won && x.played === y.played)
    const a = top[0]
    if (!a) return null
    return { ids: top.map((t) => t.id), points: a.points, detail: `${top.length > 1 ? 'Ganaron' : 'Ganó'} ${a.won} de ${a.played}`, next: next ? { id: next.id, points: next.points } : undefined }
  }, [truco, year])

  const ready = !lf && !lt && !players.loading
  const hasSomething = !!fmoLeader || !!trucoLeader

  // Se abre una sola vez: apenas están los datos, queda marcado como visto.
  useEffect(() => {
    if (done || open || !ready || !hasSomething) return
    markSeen()
    setOpen(true)
  }, [done, open, ready, hasSomething])

  const close = () => {
    setOpen(false)
    setDone(true)
  }

  useEffect(() => {
    if (!open) return
    ref.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open])

  if (!open) return null
  const both = !!fmoLeader && !!trucoLeader
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-[2px]" onClick={close} aria-hidden />
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={both ? 'Los número 1 de FMO y Truco' : 'El número 1'}
        className={`relative w-full ${both ? 'max-w-md sm:max-w-xl' : 'max-w-sm'} max-h-[92dvh] overflow-y-auto rounded-[22px] text-white shadow-2xl pop-in outline-none`}
        style={{ background: 'radial-gradient(120% 70% at 50% 0%, #4a3812 0%, #1a1a1f 52%, #0b0d13 100%)' }}
      >
        <button type="button" onClick={close} className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center" aria-label="Cerrar">
          <X size={18} />
        </button>
        <div className="px-5 pt-6 pb-4 text-center">
          <span className="inline-flex w-12 h-12 rounded-full items-center justify-center bg-[#d9b45f]/15 text-[#e7c877]">
            <Trophy size={24} />
          </span>
          <p className="mt-2 text-[11px] uppercase tracking-[.22em] font-bold text-[#e7c877]">Ranking {year}</p>
          <h2 className="mt-1 text-[34px] sm:text-[40px] font-extrabold leading-none tracking-tight">{both ? 'Los número 1' : 'El número 1'}</h2>
          <p className="mt-2 text-sm text-[#f2e7c8]/80">Los que mandan en la banda por ahora…</p>
        </div>
        <div className={`grid ${both ? 'grid-cols-2' : 'grid-cols-1'} gap-2.5 px-3 sm:px-5`}>
          {fmoLeader ? <LeaderCard sport="FMO" icon={<Goal size={13} />} leader={fmoLeader} players={players} to="/fmo/ranking" onGo={close} /> : null}
          {trucoLeader ? <LeaderCard sport="Truco" icon={<Spade size={13} />} leader={trucoLeader} players={players} to="/truco/ranking" onGo={close} /> : null}
        </div>
        <div className="px-5 pt-4 pb-5">
          <button type="button" onClick={close} className="btn btn-gold w-full !min-h-[48px] !text-base">
            ¡A seguir jugando!
          </button>
        </div>
      </div>
    </div>
  )
}
