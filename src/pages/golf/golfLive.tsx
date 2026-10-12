// Golf · Partido en vivo: cada línea (grupo que sale junto) carga sus golpes hoyo por hoyo
// y todos ven cómo viene cada línea al mismo tiempo. Cada tarjeta se guarda sola, sin pisar las otras.
import { Minus, Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSession } from '../../data/DataContext'
import { errorText } from '../../data/actions'
import { saveLiveCard } from '../../data/golf'
import type { GolfLine, GolfRound } from '../../data/types'
import { cardIds, defaultLines, liveBoard } from '../../domain/golf'
import { Card, Pill } from '../../ui/components'
import { useToast } from '../../ui/toast'
import type { FmoPlayers } from '../fmo/fmoShared'
import { entrantName } from './golfShared'

export function linesOf(r: GolfRound): GolfLine[] {
  return r.lines?.length ? r.lines : defaultLines(r)
}

/** Tarjetas que carga una línea: las de sus jugadores (o las de sus equipos en la laguneada). */
function lineCards(r: GolfRound, line: GolfLine): string[] {
  if (r.mode === 'scramble') return r.entrants.filter((e) => e.players.some((p) => line.players.includes(p))).map((e) => e.id)
  return cardIds(r).filter((cid) => line.players.includes(cid))
}

export function LiveEntry({ round, players }: { round: GolfRound; players: FmoPlayers }) {
  const { db, memberId } = useSession()
  const toast = useToast()
  const lines = linesOf(round)
  const mine = lines.find((l) => memberId && l.players.includes(memberId))
  const [lineId, setLineId] = useState(mine?.id ?? lines[0]?.id ?? '')
  const line = lines.find((l) => l.id === lineId) ?? lines[0]
  const cids = line ? lineCards(round, line) : []
  const holes = round.course.holes
  // Hoyo por defecto: el primero que a la línea le falta cargar.
  const firstOpen = useMemo(() => {
    const i = holes.findIndex((_, i2) => cids.some((cid) => round.cards[cid]?.strokes[i2] == null))
    return i === -1 ? holes.length - 1 : i
  }, [holes, cids, round.cards])
  const [hole, setHole] = useState(firstOpen)
  const [touched, setTouched] = useState(false)
  useEffect(() => {
    if (!touched) setHole(firstOpen)
  }, [firstOpen, touched])
  const nameOf = (cid: string) => (round.mode === 'scramble' ? entrantName(round.entrants.find((e) => e.id === cid)!, players) : players.nameOf(cid))

  async function set(cid: string, value: number | null) {
    const card = round.cards[cid]
    if (!card || !memberId) return
    const strokes = card.strokes.map((s, i) => (i === hole ? value : s))
    try {
      await saveLiveCard(db, round.id, cid, { ...card, strokes, total: null }, memberId)
    } catch (e) {
      toast.error(errorText(e))
    }
  }

  if (!line) return null
  const par = holes[hole]?.par ?? 4
  return (
    <Card>
      <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
        <p className="h3">Cargar golpes</p>
        {lines.length > 1 ? (
          <select className="input w-auto" value={line.id} onChange={(e) => setLineId(e.target.value)} aria-label="Línea">
            {lines.map((l, i) => (
              <option key={l.id} value={l.id}>
                Línea {i + 1}
                {memberId && l.players.includes(memberId) ? ' (la tuya)' : ''}
              </option>
            ))}
          </select>
        ) : null}
      </div>
      <div className="flex gap-1 overflow-x-auto pb-2 -mx-1 px-1" role="tablist" aria-label="Hoyo">
        {holes.map((_, i) => {
          const done = cids.every((cid) => round.cards[cid]?.strokes[i] != null)
          return (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === hole}
              onClick={() => {
                setTouched(true)
                setHole(i)
              }}
              className={`shrink-0 w-11 h-11 rounded-lg border text-sm font-bold ${i === hole ? 'bg-[#d9b45f] text-[#191409] border-[#d9b45f]' : done ? 'bg-soft border-line' : 'border-line'}`}
            >
              {i + 1}
            </button>
          )
        })}
      </div>
      <p className="small muted mb-2">
        Hoyo {hole + 1} · par {par}
        {holes[hole]?.yards ? ` · ${holes[hole].yards} yd` : ''}
      </p>
      <div className="grid gap-2">
        {cids.map((cid) => {
          const v = round.cards[cid]?.strokes[hole] ?? null
          const tone = v === null ? '' : v < par ? 'text-ok' : v > par + 1 ? 'text-danger' : ''
          return (
            <div key={cid} className="flex items-center justify-between gap-3 rounded-xl border border-line p-2">
              <span className="font-semibold truncate">{nameOf(cid)}</span>
              <span className="flex items-center gap-2 shrink-0">
                <button type="button" className="btn btn-line !w-12 !h-12 !p-0" aria-label={`Un golpe menos a ${nameOf(cid)}`} onClick={() => void set(cid, v === null ? par - 1 : Math.max(1, v - 1))}>
                  <Minus size={18} />
                </button>
                <button type="button" className={`w-12 h-12 rounded-xl border-2 border-line text-xl font-extrabold tabular-nums ${tone}`} onClick={() => v === null && void set(cid, par)} aria-label={v === null ? `Poner par a ${nameOf(cid)}` : `${nameOf(cid)}: ${v} golpes`}>
                  {v ?? '–'}
                </button>
                <button type="button" className="btn btn-line !w-12 !h-12 !p-0" aria-label={`Un golpe más a ${nameOf(cid)}`} onClick={() => void set(cid, v === null ? par + 1 : Math.min(20, v + 1))}>
                  <Plus size={18} />
                </button>
              </span>
            </div>
          )
        })}
      </div>
      <p className="tiny muted mt-2">Tocá el número para poner el par; con + y − lo ajustás. Se guarda solo y lo ven todos.</p>
    </Card>
  )
}

/** Cómo viene cada línea, en vivo. */
export function LiveBoard({ round, players }: { round: GolfRound; players: FmoPlayers }) {
  const lines = linesOf(round)
  const board = liveBoard(round)
  const byEntrant = Object.fromEntries(board.map((b, i) => [b.entrantId, { ...b, order: i + 1 }]))
  return (
    <Card>
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="h3">En vivo</p>
        <Pill tone="ok">● En juego</Pill>
      </div>
      <div className="grid gap-1 mb-3">
        {board.map((b, i) => (
          <div key={b.entrantId} className="flex justify-between gap-3 py-1 border-b border-line last:border-0">
            <span className={`truncate ${i === 0 ? 'font-bold' : ''}`}>
              {i + 1}º {entrantName(round.entrants.find((e) => e.id === b.entrantId)!, players)}
            </span>
            <span className="tabular-nums shrink-0">{b.label}</span>
          </div>
        ))}
      </div>
      {lines.length > 1 ? (
        <div className="grid sm:grid-cols-2 gap-2">
          {lines.map((l, i) => {
            const entrants = round.entrants.filter((e) => e.players.some((p) => l.players.includes(p)))
            const thru = Math.max(0, ...entrants.map((e) => byEntrant[e.id]?.thru ?? 0))
            return (
              <div key={l.id} className="rounded-xl border border-line p-2">
                <p className="small font-bold">
                  Línea {i + 1} <span className="tiny muted font-normal">· {thru ? `va por el hoyo ${thru}` : 'sin empezar'}</span>
                </p>
                <p className="tiny muted">{l.players.map(players.nameOf).join(', ')}</p>
              </div>
            )
          })}
        </div>
      ) : null}
    </Card>
  )
}

/** Armar las líneas: quién sale con quién (por defecto, de a 4). */
export function LinesEditor({ round, players, onChange }: { round: GolfRound; players: FmoPlayers; onChange: (lines: GolfLine[]) => void }) {
  const lines = linesOf(round)
  const all = round.entrants.flatMap((e) => e.players)
  if (all.length < 2) return null
  const lineOfPlayer = (p: string) => lines.findIndex((l) => l.players.includes(p))
  function move(p: string, to: number) {
    const next = lines.map((l) => ({ ...l, players: l.players.filter((x) => x !== p) }))
    if (to >= next.length) next.push({ id: `l${Date.now().toString(36)}`, players: [] })
    next[to].players.push(p)
    onChange(next.filter((l) => l.players.length))
  }
  return (
    <Card>
      <p className="h3 mb-1">Líneas</p>
      <p className="tiny muted mb-2">Quién sale con quién. Cada línea carga sus golpes en vivo (de a 4 por defecto).</p>
      <div className="grid gap-1">
        {all.map((p) => (
          <div key={p} className="flex items-center justify-between gap-2 py-1 border-b border-line last:border-0">
            <span className="small font-semibold truncate">{players.nameOf(p)}</span>
            <select className="input w-auto" value={Math.max(0, lineOfPlayer(p))} onChange={(e) => move(p, Number(e.target.value))} aria-label={`Línea de ${players.nameOf(p)}`}>
              {lines.map((_, i) => (
                <option key={i} value={i}>
                  Línea {i + 1}
                </option>
              ))}
              <option value={lines.length}>Línea nueva</option>
            </select>
          </div>
        ))}
      </div>
    </Card>
  )
}
