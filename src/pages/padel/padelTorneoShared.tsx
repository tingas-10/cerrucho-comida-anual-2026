// Piezas de los torneos de pádel: encabezado con aire de circuito, nombres de pareja, marcador de un cruce,
// carga del resultado, el cuadro con la copa en el medio y las tablas de los grupos.
import { Trophy } from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { FORMATO_PARTIDO } from '../../content/padel'
import { useSession } from '../../data/DataContext'
import { errorText } from '../../data/actions'
import { useCollection } from '../../data/hooks'
import { P } from '../../data/paths'
import type { PadelMatch, PadelTournament } from '../../data/types'
import { formatPoints } from '../../domain/fmo'
import { BYE, fixtureTitle, resultProblem, type PFixture, type PRow, type PadelTState } from '../../domain/padelTorneo'
import { Button, ConfirmDialog, Modal, Segmented } from '../../ui/components'
import { useToast } from '../../ui/toast'
import type { FmoPlayers } from '../fmo/fmoShared'

export function usePadelTournaments() {
  return useCollection<PadelTournament>(P.padelTournaments)
}

/** Encabezado de las páginas de Pádel: banda azul noche con la raya verde pelota. */
export function PadelHeader({ eyebrow = 'Pádel · Circuito de la banda', title, intro, actions }: { eyebrow?: string; title: ReactNode; intro?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="tour-band px-5 py-6 sm:px-8 sm:py-7 mb-4">
      <p className="tour-eyebrow pr-16">{eyebrow}</p>
      <h1 className="tour-title text-[34px] sm:text-[46px] mt-1.5 pr-16">{title}</h1>
      {intro ? <p className="text-[15px] text-white/75 mt-2 max-w-2xl pr-16 leading-relaxed">{intro}</p> : null}
      {actions ? <div className="flex gap-2 flex-wrap mt-4 [&>*]:flex-1 sm:[&>*]:flex-none">{actions}</div> : null}
    </div>
  )
}

/** "Pay / Zubel". Para una pareja que todavía no se sabe, la etiqueta de dónde sale ("1° Grupo A"). */
export function pairNames(t: PadelTournament, id: string | null, players: FmoPlayers, fallback?: string | null): string {
  if (id === BYE) return 'Pase libre'
  const p = id ? t.pairs.find((x) => x.id === id) : null
  if (!p) return fallback ?? 'A definir'
  return p.players.map(players.nameOf).join(' / ')
}

export function formatLabel(f: PFixture['format']): string {
  return FORMATO_PARTIDO[f].label
}

/** Marcador de un cruce, como los de la tele: una fila por pareja con los sets y la ganadora resaltada. */
export function ScoreBox({ t, f, players, onOpen, wide, width = 'w-[200px]' }: { t: PadelTournament; f: PFixture; players: FmoPlayers; onOpen?: () => void; wide?: boolean; width?: string }) {
  const r = f.result
  const rows = [
    { id: f.a, label: f.aLabel, side: 'a' as const },
    { id: f.b, label: f.bLabel, side: 'b' as const },
  ]
  const body = (
    <div className={`tour-score ${wide ? 'w-full' : width} text-left`}>
      {rows.map(({ id, label, side }) => {
        const known = !!id && id !== BYE
        const won = !!r && r.winner === id
        return (
          <div key={side} className={`tour-score-row ${won ? 'win' : ''}`}>
            <span className={`flex-1 min-w-0 truncate text-[13px] ${known ? 'font-bold' : 'italic text-white/55'} ${r && !won && r.winner !== null ? 'text-white/60' : ''}`}>{pairNames(t, id, players, label)}</span>
            {r && !r.resultOnly
              ? r.sets.map((s, i) => (
                  <span key={i} className={`tour-set ${(side === 'a' ? s.a > s.b : s.b > s.a) ? 'won' : ''}`}>
                    {side === 'a' ? s.a : s.b}
                  </span>
                ))
              : r && r.resultOnly && won
                ? <span className="tour-set won">✓</span>
                : null}
          </div>
        )
      })}
    </div>
  )
  return (
    <div className="relative">
      {f.live ? <span className="tour-live absolute -top-2.5 right-2 z-10">En cancha</span> : null}
      {onOpen ? (
        <button type="button" onClick={onOpen} className="block rounded-[10px] focus-visible:outline-2 focus-visible:outline-[#d6f21d]" aria-label={`${pairNames(t, f.a, players, f.aLabel)} contra ${pairNames(t, f.b, players, f.bLabel)}`}>
          {body}
        </button>
      ) : (
        body
      )}
    </div>
  )
}

/** El cuadro de eliminación: la mitad de los cruces a la izquierda, la otra mitad a la derecha y la final con la copa en el medio.
 *  En el celular parado va de arriba a abajo (una mitad arriba, la copa en el medio y la otra mitad abajo).
 *  Se agranda o se achica solo para ocupar el ancho, centrado. */
export function Bracket({ t, rounds, players, champion, onFixture }: { t: PadelTournament; rounds: PFixture[][]; players: FmoPlayers; champion: string | null; onFixture?: (f: PFixture) => void }) {
  const outer = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState({ scale: 1, h: 0, ml: 0, vertical: false })
  useLayoutEffect(() => {
    const o = outer.current
    const i = inner.current
    if (!o || !i) return
    const measure = () => {
      const avail = o.clientWidth
      const vertical = avail < 640
      const w = i.scrollWidth
      const scale = Math.max(0.5, Math.min(vertical ? 1 : 1.5, (avail - 16) / w))
      setFit((cur) => {
        const next = { scale, h: i.scrollHeight * scale, ml: Math.max(0, (avail - w * scale) / 2), vertical }
        return cur.scale === next.scale && cur.h === next.h && cur.ml === next.ml && cur.vertical === next.vertical ? cur : next
      })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(o)
    ro.observe(i)
    return () => ro.disconnect()
    // Al pasar de horizontal a vertical cambia el contenido: se vuelve a medir.
  }, [rounds.length, t.id, fit.vertical])

  const R = rounds.length
  if (!R) return null
  const box = (f: PFixture, width?: string) => <ScoreBox t={t} f={f} players={players} width={width} onOpen={onFixture && f.a !== BYE && f.b !== BYE ? () => onFixture(f) : undefined} />
  const final = rounds[R - 1][0]
  const sides = Array.from({ length: R - 1 }, (_, r) => r)
  const halfOf = (r: number, which: 'left' | 'right') => {
    const list = rounds[r]
    return which === 'left' ? list.slice(0, list.length / 2) : list.slice(list.length / 2)
  }
  const cup = (
    <div className="flex flex-col items-center text-[#d6f21d]">
      <Trophy size={54} strokeWidth={1.6} />
      <span className="tour-eyebrow mt-1">{champion ? 'Campeones' : 'Final'}</span>
    </div>
  )
  const champ = champion ? <p className="text-center font-extrabold italic uppercase text-[#d6f21d] text-sm">{pairNames(t, champion, players)}</p> : null

  if (fit.vertical) {
    const joint = <span className="block w-0.5 h-4 bg-[#d6f21d]/55 mx-auto" aria-hidden />
    const row = (r: number, which: 'left' | 'right') => {
      const half = halfOf(r, which)
      const w = half.length >= 2 ? 'w-[168px]' : 'w-[260px]'
      return (
        <div key={`${which}${r}`} className="flex gap-3 justify-center">
          {half.map((f) => (
            <div key={f.key} className={f.a === BYE || f.b === BYE ? 'opacity-50' : ''}>
              {box(f, w)}
            </div>
          ))}
        </div>
      )
    }
    return (
      <div ref={outer} className="w-full overflow-x-auto overflow-y-hidden" style={{ height: fit.h || undefined }}>
        <div ref={inner} className="inline-flex flex-col items-stretch gap-0 px-2 py-5 origin-top-left" style={{ transform: `scale(${fit.scale})`, marginLeft: fit.ml, minWidth: 'max-content' }}>
          {sides.map((r) => (
            <div key={`l${r}`}>
              {row(r, 'left')}
              {joint}
            </div>
          ))}
          <div className="flex flex-col items-center gap-2 py-1">
            {cup}
            {box(final, 'w-[260px]')}
            {champ}
          </div>
          {[...sides].reverse().map((r) => (
            <div key={`r${r}`}>
              {joint}
              {row(r, 'right')}
            </div>
          ))}
        </div>
      </div>
    )
  }

  const side = (r: number, which: 'left' | 'right') => {
    const half = halfOf(r, which)
    const last = r === R - 2
    const cell = (f: PFixture) => (
      <div key={f.key} className={`bk-cell ${r > 0 ? 'bk-in' : ''} ${last ? 'bk-out' : ''} ${f.a === BYE || f.b === BYE ? 'opacity-50' : ''}`}>
        {box(f)}
      </div>
    )
    if (last) return <div className={`bk-col bk-${which}`}>{half.map(cell)}</div>
    const pairs: PFixture[][] = []
    for (let i = 0; i < half.length; i += 2) pairs.push(half.slice(i, i + 2))
    return (
      <div className={`bk-col bk-${which}`}>
        {pairs.map((p) => (
          <div key={p[0].key} className="bk-pair">
            {p.map(cell)}
          </div>
        ))}
      </div>
    )
  }
  return (
    <div ref={outer} className="w-full overflow-x-auto overflow-y-hidden" style={{ height: fit.h || undefined }}>
      <div ref={inner} className="inline-flex items-stretch gap-7 px-2 pt-24 pb-10 origin-top-left" style={{ transform: `scale(${fit.scale})`, marginLeft: fit.ml, minWidth: 'max-content' }}>
        {sides.map((r) => (
          <div key={`l${r}`} className="flex">
            {side(r, 'left')}
          </div>
        ))}
        <div className="bk-col justify-center">
          <div className="relative">
            <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-3">{cup}</div>
            <div className={R > 1 ? 'relative before:absolute before:top-1/2 before:-left-[14px] before:w-[14px] before:border-t-2 before:border-[#d6f21d]/55 after:absolute after:top-1/2 after:-right-[14px] after:w-[14px] after:border-t-2 after:border-[#d6f21d]/55' : ''}>
              {box(final)}
            </div>
            {champ ? <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 whitespace-nowrap">{champ}</div> : null}
          </div>
        </div>
        {[...sides].reverse().map((r) => (
          <div key={`r${r}`} className="flex">
            {side(r, 'right')}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Tabla de un grupo o de la liga. `dark` para la vista de pantalla completa. */
export function TourTable({ t, rows, players, qualify = 0, dark }: { t: PadelTournament; rows: PRow[]; players: FmoPlayers; qualify?: number; dark?: boolean }) {
  const line = dark ? 'border-white/10' : 'border-line'
  const head = dark ? 'text-white/55' : 'muted'
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className={`tiny ${head} text-left`}>
          <th className="py-1.5 pr-2 w-7">#</th>
          <th className="py-1.5 pr-2">Pareja</th>
          <th className="py-1.5 px-1 text-right" title="Partidos jugados">PJ</th>
          <th className="py-1.5 px-1 text-right" title="Ganados">PG</th>
          {rows.some((r) => r.pe) ? (
            <th className="py-1.5 px-1 text-right" title="Empatados">PE</th>
          ) : null}
          <th className="py-1.5 px-1 text-right" title="Perdidos">PP</th>
          <th className="py-1.5 px-1 text-right hidden sm:table-cell" title="Diferencia de games">Dif</th>
          <th className="py-1.5 pl-1 text-right" title="Puntos">Pts</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const q = i < qualify
          const dif = r.gw - r.gl
          return (
            <tr key={r.id} className={`border-t ${line}`}>
              <td className="py-2 pr-2">
                <span className={`inline-grid place-items-center w-6 h-6 rounded-md text-xs font-extrabold ${q ? 'bg-[#d6f21d] text-[#06112a]' : dark ? 'bg-white/10' : 'bg-soft'}`}>{i + 1}</span>
              </td>
              <td className="py-2 pr-2 font-semibold max-w-[150px] sm:max-w-none truncate">{pairNames(t, r.id, players)}</td>
              <td className="py-2 px-1 text-right tabular-nums">{r.pj}</td>
              <td className="py-2 px-1 text-right tabular-nums">{r.pg}</td>
              {rows.some((x) => x.pe) ? <td className="py-2 px-1 text-right tabular-nums">{r.pe}</td> : null}
              <td className="py-2 px-1 text-right tabular-nums">{r.pp}</td>
              <td className="py-2 px-1 text-right tabular-nums hidden sm:table-cell">{dif > 0 ? `+${dif}` : dif}</td>
              <td className={`py-2 pl-1 text-right tabular-nums font-extrabold ${dark ? 'text-[#d6f21d]' : 'text-accent'}`}>{formatPoints(r.pts)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

/** Carga o corrige el resultado de un cruce. Se elige tocando los games de cada pareja. */
export function ResultModal({ t, st, f, matches, players, onClose }: { t: PadelTournament; st: PadelTState; f: PFixture | null; matches: PadelMatch[]; players: FmoPlayers; onClose: () => void }) {
  const { db, memberId } = useSession()
  const toast = useToast()
  const [mode, setMode] = useState<'sets' | 'winner'>('sets')
  const [sets, setSets] = useState<Array<{ a: number; b: number }>>([])
  const [winner, setWinner] = useState<string | null>(null)
  const [draw, setDraw] = useState(false)
  const [busy, setBusy] = useState(false)
  const [delOpen, setDelOpen] = useState(false)
  const key = f?.key ?? ''

  useEffect(() => {
    if (!f) return
    const r = f.result
    setMode(r?.resultOnly ? 'winner' : 'sets')
    setSets(r && !r.resultOnly && r.sets.length ? r.sets.map((s) => ({ ...s })) : [{ a: 0, b: 0 }])
    setWinner(r?.resultOnly ? r.winner : null)
    setDraw(!!r && r.winner === null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, f?.result?.matchId])

  const fmt = f ? FORMATO_PARTIDO[f.format] : FORMATO_PARTIDO.s1
  const canDraw = !!f && f.stage === 'rr' && fmt.bestOf === 3
  const shown = useMemo(() => {
    // Mejor de 3: se ven 2 sets y el tercero aparece si van 1 a 1 (salvo que haya terminado empatado).
    if (fmt.bestOf === 1) return sets.slice(0, 1)
    const base = sets.slice(0, 2)
    while (base.length < 2) base.push({ a: 0, b: 0 })
    const oneAll = (base[0].a > base[0].b) !== (base[1].a > base[1].b) && base[0].a !== base[0].b && base[1].a !== base[1].b
    if (oneAll && !draw) return [...base, sets[2] ?? { a: 0, b: 0 }]
    return base
  }, [sets, fmt.bestOf, draw])

  if (!f || !f.a || !f.b) return null
  const a = f.a
  const b = f.b
  const pa = t.pairs.find((p) => p.id === a)
  const pb = t.pairs.find((p) => p.id === b)
  const max = fmt.games === 4 ? 4 : 7
  const problem = mode === 'winner' ? (winner ? null : 'Marcá qué pareja ganó.') : resultProblem(shown, f.format, canDraw && draw)
  const existingId = f.result?.matchId ?? f.openMatchId
  const existing = existingId ? matches.find((m) => m.id === existingId) : undefined

  function setGame(i: number, side: 'a' | 'b', v: number) {
    const next = shown.map((x) => ({ ...x }))
    next[i] = { ...next[i], [side]: v }
    setSets(next)
  }

  async function save() {
    if (!memberId || !pa || !pb || problem) return
    setBusy(true)
    try {
      const now = Date.now()
      const id = existingId ?? db.newId()
      const resultOnly = mode === 'winner'
      const isDraw = !resultOnly && canDraw && draw
      const m: PadelMatch = {
        id,
        playedAt: existing?.status === 'PLAYED' ? existing.playedAt : now,
        bestOf: fmt.bestOf,
        games: fmt.games,
        pairA: pa.players,
        pairB: pb.players,
        sets: resultOnly ? [] : shown,
        status: 'PLAYED',
        resultOnly,
        winner: resultOnly ? (winner === a ? 'A' : 'B') : null,
        draw: isDraw,
        tournamentId: t.id,
        fixtureId: f!.key,
        entrantA: a,
        entrantB: b,
        notes: existing?.notes ?? '',
        createdBy: existing?.createdBy ?? memberId,
        updatedBy: memberId,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        revision: (existing?.revision ?? 0) + 1,
      }
      await db.setDoc(P.padelMatch(id), m)
      toast.ok('Resultado guardado. Ya se ve en el torneo y suma al ranking.')
      onClose()
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  const nameA = pairNames(t, a, players)
  const nameB = pairNames(t, b, players)
  const chips = (i: number, side: 'a' | 'b', value: number, label: string) => (
    <div>
      <p className="small font-semibold truncate mb-1.5">{label}</p>
      <div className="grid gap-1 max-w-[380px]" style={{ gridTemplateColumns: `repeat(${max + 1}, minmax(0, 1fr))` }} role="group" aria-label={`Set ${i + 1}, games de ${label}`}>
        {Array.from({ length: max + 1 }, (_, n) => (
          <button
            key={n}
            type="button"
            aria-pressed={value === n}
            onClick={() => setGame(i, side, n)}
            className={`h-11 rounded-lg font-extrabold tabular-nums border text-base ${value === n ? 'bg-[#06112a] text-[#d6f21d] border-[#06112a]' : 'border-line bg-bg'}`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <Modal open={!!f} onClose={onClose} title={fixtureTitle(f, st)}>
      <p className="small muted -mt-1 mb-3">
        {fmt.label}
        {fmt.games === 4 ? ' · en 3-3 hay tie-break y termina 4-3' : ''}
        {t.deuce === 'oro' ? ' · punto de oro' : ' · con ventaja'}
      </p>
      <Segmented
        ariaLabel="Cómo se carga"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'sets', label: 'Con los games' },
          { value: 'winner', label: 'Sólo sé quién ganó' },
        ]}
      />
      {mode === 'winner' ? (
        <div className="grid gap-2 mt-4">
          {[
            { id: a, name: nameA },
            { id: b, name: nameB },
          ].map((x) => (
            <button key={x.id} type="button" aria-pressed={winner === x.id} onClick={() => setWinner(x.id)} className={`btn justify-start ${winner === x.id ? 'btn-gold' : 'btn-line'}`}>
              Ganó {x.name}
            </button>
          ))}
          <p className="tiny muted">Cuenta para la tabla del torneo y el ranking, pero no suma games.</p>
        </div>
      ) : (
        <div className="grid gap-4 mt-4">
          {shown.map((s, i) => (
            <div key={i} className="grid gap-3 rounded-xl border border-line p-3">
              {fmt.bestOf > 1 ? <p className="tiny muted font-bold uppercase tracking-wide">Set {i + 1}</p> : null}
              {chips(i, 'a', s.a, nameA)}
              {chips(i, 'b', s.b, nameB)}
            </div>
          ))}
          {canDraw && shown.length >= 2 && (shown[0].a > shown[0].b) !== (shown[1].a > shown[1].b) ? (
            <label className="flex items-center gap-2 small min-h-[40px]">
              <input type="checkbox" checked={draw} onChange={(e) => setDraw(e.target.checked)} className="w-5 h-5" />
              Terminó empatado, no jugaron el tercer set
            </label>
          ) : null}
        </div>
      )}
      {mode === 'sets' && shown.every((x) => x.a === 0 && x.b === 0) ? (
        <p className="small mt-3 muted">Tocá los games que hizo cada pareja.</p>
      ) : (
        <p className={`small mt-3 ${problem ? 'text-danger' : 'text-ok font-semibold'}`}>{problem ?? 'Listo para guardar.'}</p>
      )}
      <div className="flex gap-2 justify-end flex-wrap mt-4">
        {f.result ? (
          <Button variant="line" onClick={() => setDelOpen(true)}>
            Borrar resultado
          </Button>
        ) : null}
        <Button variant="lime" onClick={() => void save()} loading={busy} disabled={!!problem}>
          Guardar resultado
        </Button>
      </div>
      <ConfirmDialog
        open={delOpen}
        onClose={() => setDelOpen(false)}
        title="Borrar el resultado"
        text="El cruce queda sin jugar y deja de contar en la tabla y en el ranking."
        danger
        confirmLabel="Borrar"
        onConfirm={async () => {
          try {
            if (f.result) await db.deleteDoc(P.padelMatch(f.result.matchId))
            setDelOpen(false)
            onClose()
          } catch (e) {
            toast.error(errorText(e))
          }
        }}
      />
    </Modal>
  )
}

/** Marca un cruce como "en cancha" (se está jugando) o lo saca. Crea un partido sin resultado. */
export function useLiveToggle(t: PadelTournament) {
  const { db, memberId } = useSession()
  const toast = useToast()
  return async (f: PFixture, on: boolean) => {
    if (!memberId || !f.a || !f.b) return
    try {
      if (!on) {
        if (f.openMatchId) await db.deleteDoc(P.padelMatch(f.openMatchId))
        return
      }
      const pa = t.pairs.find((p) => p.id === f.a)!
      const pb = t.pairs.find((p) => p.id === f.b)!
      const fmt = FORMATO_PARTIDO[f.format]
      const id = db.newId()
      const now = Date.now()
      const m: PadelMatch = {
        id,
        playedAt: now,
        bestOf: fmt.bestOf,
        games: fmt.games,
        pairA: pa.players,
        pairB: pb.players,
        sets: [],
        status: 'LIVE',
        resultOnly: false,
        winner: null,
        draw: false,
        tournamentId: t.id,
        fixtureId: f.key,
        entrantA: f.a,
        entrantB: f.b,
        notes: '',
        createdBy: memberId,
        updatedBy: memberId,
        createdAt: now,
        updatedAt: now,
        revision: 1,
      }
      await db.setDoc(P.padelMatch(id), m)
      toast.ok('Marcado en cancha: todos lo ven en vivo.')
    } catch (e) {
      toast.error(errorText(e))
    }
  }
}
