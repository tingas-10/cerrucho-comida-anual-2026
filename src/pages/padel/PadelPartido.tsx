// Pádel · Un partido: cancha azul con las dos parejas, formato, sets y guardado.
import { Plus, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PADEL, formatoLabel } from '../../content/padel'
import { useSession } from '../../data/DataContext'
import { errorText } from '../../data/actions'
import { useDoc } from '../../data/hooks'
import { P } from '../../data/paths'
import type { FmoGuest, PadelMatch } from '../../data/types'
import { fmtDayLong, localToMs, msToLocalParts } from '../../domain/format'
import { formatPoints } from '../../domain/fmo'
import { setsToWin, tally, validateMatch, winnerOf, type Pair } from '../../domain/padel'
import { Avatar, Button, Card, ConfirmDialog, Field, Input, Loading, LoginPrompt, Modal, Notice, Pill } from '../../ui/components'
import { useToast } from '../../ui/toast'
import { useFmoPlayers } from '../fmo/fmoShared'
import { POSITION_LABEL, PadelCourt, pairName } from './padelShared'

export function PadelPartido() {
  const { id } = useParams()
  const { db, memberId, isMember } = useSession()
  const toast = useToast()
  const navigate = useNavigate()
  const remote = useDoc<PadelMatch>(id ? P.padelMatch(id) : null)
  const players = useFmoPlayers()
  const [m, setM] = useState<PadelMatch | null>(null)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [slot, setSlot] = useState<{ pair: Pair; idx: 0 | 1 } | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)

  useEffect(() => {
    if (remote.data && !dirty) setM(remote.data)
  }, [remote.data, dirty])

  const isGuest = useMemo(() => (pid: string) => players.byId[pid]?.guest ?? false, [players.byId])

  if (remote.loading || players.loading) return <Loading />
  if (!m) return <Notice tone="warn">Ese partido no existe (capaz lo borraron). <Link className="underline" to="/padel">Volver a Partidos</Link></Notice>

  const t = tally(m)
  const winner = winnerOf(m)
  const validation = validateMatch(m, isGuest)
  const title = (
    <>
      {pairName(m, 'A', players)} <span className="tabular-nums text-accent">{t.a} – {t.b}</span> {pairName(m, 'B', players)}
    </>
  )

  function change(patch: Partial<PadelMatch>) {
    setDirty(true)
    setM((cur) => (cur ? { ...cur, ...patch } : cur))
  }

  /** Pone a alguien en un lugar. Si ya estaba en la cancha, intercambia con quien ocupaba ese lugar. */
  function assign(pair: Pair, idx: 0 | 1, pid: string) {
    if (!m) return
    const a: [string, string] = [...m.pairA]
    const b: [string, string] = [...m.pairB]
    const target = pair === 'A' ? a : b
    const current = target[idx]
    if (pid) {
      if (a.includes(pid)) a[a.indexOf(pid)] = current
      else if (b.includes(pid)) b[b.indexOf(pid)] = current
    }
    target[idx] = pid
    const guests = [...a, ...b].filter((x) => x && isGuest(x)).length
    if (guests > PADEL.maxInvitados) {
      toast.error(`Puede jugar hasta ${PADEL.maxInvitados} invitado por partido.`)
      return
    }
    change({ pairA: a, pairB: b })
    setSlot(null)
  }

  function setSet(i: number, side: 'a' | 'b', value: string) {
    const v = Math.max(0, Math.min(99, Math.floor(Number(value) || 0)))
    change({ sets: m!.sets.map((s, j) => (j === i ? { ...s, [side]: v } : s)) })
  }

  async function save(status: PadelMatch['status']) {
    if (!memberId || !m) return
    if (status === 'PLAYED' && validation) {
      toast.error(validation)
      return
    }
    setBusy(true)
    try {
      const next: PadelMatch = { ...m, status, updatedBy: memberId, updatedAt: Date.now(), revision: (m.revision ?? 0) + 1 }
      await db.setDoc(P.padelMatch(m.id), next)
      setM(next)
      setDirty(false)
      toast.ok(status === 'PLAYED' ? 'Partido guardado. Ya cuenta para el ranking.' : 'Armado guardado')
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  const canAddSet = m.sets.length < m.bestOf && !winner
  const result = winner ? (
    <Notice tone="ok">
      Gana <b>{pairName(m, winner, players)}</b> {winner === 'A' ? `${t.a}–${t.b}` : `${t.b}–${t.a}`}: suma {formatPoints(PADEL.puntos[m.bestOf] ?? 0)} {PADEL.puntos[m.bestOf] === 1 ? 'punto' : 'puntos'} cada uno.
    </Notice>
  ) : null

  if (!isMember) {
    return (
      <div>
        <Link to="/padel" className="tiny underline muted">
          ← Partidos
        </Link>
        <h1 className="h2 mt-1 mb-1">{title}</h1>
        <p className="small muted mb-4">
          {m.status === 'PLAYED' ? fmtDayLong(m.playedAt) : 'Todavía no se jugó'} · {formatoLabel(m.bestOf)}
        </p>
        <div className="grid lg:grid-cols-[minmax(0,360px)_1fr] gap-4 items-start">
          <PadelCourt match={m} players={players} readOnly />
          <Card>
            <SetsTable m={m} players={players} />
            {result ? <div className="mt-3">{result}</div> : null}
          </Card>
        </div>
        <div className="mt-4">
          <LoginPrompt text="Entrá para armar o editar partidos." />
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div className="min-w-0">
          <Link to="/padel" className="tiny underline muted">
            ← Partidos
          </Link>
          <h1 className="h2 mt-1">{title}</h1>
        </div>
        <span className="flex items-center gap-2">
          {m.status === 'PLAYED' ? <Pill tone="ok">Jugado</Pill> : <Pill tone="warn">Sin jugar</Pill>}
          {dirty ? <Pill tone="danger">Cambios sin guardar</Pill> : null}
        </span>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,360px)_1fr] gap-4 items-start">
        <div>
          <PadelCourt match={m} players={players} onSlot={(pair, idx) => setSlot({ pair, idx })} />
          <p className="tiny muted mt-2 text-center">Tocá cada lugar para elegir quién juega. Son 4: al menos 3 de la banda y hasta 1 invitado.</p>
        </div>

        <div className="grid gap-4">
          <Card>
            <p className="h3 mb-3">Datos del partido</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Día que se jugó" id="pd-date">
                <Input id="pd-date" type="date" value={msToLocalParts(m.playedAt).date} onChange={(e) => change({ playedAt: localToMs(e.target.value, '21:00') ?? m.playedAt })} />
              </Field>
              <Field label="Formato" id="pd-format">
                <select
                  id="pd-format"
                  className="input"
                  value={m.bestOf}
                  onChange={(e) => {
                    const bestOf = Number(e.target.value) as PadelMatch['bestOf']
                    change({ bestOf, sets: m.sets.slice(0, bestOf) })
                  }}
                >
                  {PADEL.formatos.map((n) => (
                    <option key={n} value={n}>
                      {formatoLabel(n)} · {PADEL.puntos[n]} pt{PADEL.puntos[n] === 1 ? '' : 's'}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="h3">Sets</p>
              <span className="tiny muted">{m.bestOf === 1 ? 'Gana el set' : `Gana el primero en ganar ${setsToWin(m.bestOf)}`}</span>
            </div>
            <div className="grid grid-cols-[3.5rem_1fr_auto_1fr_2.5rem] items-center gap-2 tiny muted py-1">
              <span />
              <span className="text-center truncate">{pairName(m, 'A', players)}</span>
              <span />
              <span className="text-center truncate">{pairName(m, 'B', players)}</span>
              <span />
            </div>
            {m.sets.map((s, i) => (
              <div key={i} className="grid grid-cols-[3.5rem_1fr_auto_1fr_2.5rem] items-center gap-2 py-1.5 border-t border-line">
                <span className="small font-semibold">Set {i + 1}</span>
                <input className="input text-center tabular-nums" type="number" inputMode="numeric" min={0} max={99} value={s.a} onFocus={(e) => e.target.select()} onChange={(e) => setSet(i, 'a', e.target.value)} aria-label={`Set ${i + 1}, games de ${pairName(m, 'A', players)}`} />
                <span className="muted">–</span>
                <input className="input text-center tabular-nums" type="number" inputMode="numeric" min={0} max={99} value={s.b} onFocus={(e) => e.target.select()} onChange={(e) => setSet(i, 'b', e.target.value)} aria-label={`Set ${i + 1}, games de ${pairName(m, 'B', players)}`} />
                {i === m.sets.length - 1 ? (
                  <button type="button" className="btn btn-line btn-sm px-2" aria-label={`Borrar set ${i + 1}`} onClick={() => change({ sets: m.sets.slice(0, -1) })}>
                    <X size={14} />
                  </button>
                ) : (
                  <span />
                )}
              </div>
            ))}
            <Button size="sm" variant="line" className="mt-2" disabled={!canAddSet} onClick={() => change({ sets: [...m.sets, { a: 0, b: 0 }] })}>
              <Plus size={14} /> {m.sets.length ? 'Agregar set' : 'Cargar el primer set'}
            </Button>
            <div className="mt-3">{result ?? (m.sets.length ? <p className="tiny muted">{validation}</p> : null)}</div>
          </Card>

          <div className="sticky bottom-[calc(76px+env(safe-area-inset-bottom))] md:static z-10 flex gap-2 flex-wrap items-center rounded-xl border border-line bg-card p-2 shadow-lg md:border-0 md:bg-transparent md:p-0 md:shadow-none">
            <Button variant="gold" onClick={() => void save('PLAYED')} loading={busy}>
              {m.status === 'PLAYED' ? 'Guardar cambios' : 'Guardar partido'}
            </Button>
            {m.status !== 'PLAYED' ? (
              <Button variant="line" onClick={() => void save('DRAFT')} loading={busy}>
                Guardar armado
              </Button>
            ) : null}
            <Button variant="line" onClick={() => setDeleteOpen(true)} aria-label="Eliminar partido">
              <Trash2 size={16} /> Eliminar
            </Button>
          </div>
          <p className="tiny muted">"Guardar partido" lo deja en el historial y suma al ranking. Se puede editar después.</p>
        </div>
      </div>

      <SlotPicker
        open={slot !== null}
        slot={slot}
        match={m}
        onClose={() => setSlot(null)}
        onPick={(pid) => slot && assign(slot.pair, slot.idx, pid)}
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Eliminar partido"
        text="Se borra el partido y deja de contar en el ranking."
        danger
        confirmLabel="Eliminar"
        onConfirm={async () => {
          try {
            await db.deleteDoc(P.padelMatch(m.id))
            navigate('/padel')
          } catch (e) {
            toast.error(errorText(e))
          }
        }}
      />
    </div>
  )
}

function SetsTable({ m, players }: { m: PadelMatch; players: ReturnType<typeof useFmoPlayers> }) {
  if (!m.sets.length) return <p className="small muted">Sin sets cargados.</p>
  return (
    <div>
      {(['A', 'B'] as const).map((pair) => (
        <div key={pair} className="flex items-center justify-between gap-3 py-2 border-b border-line last:border-0">
          <span className={`small truncate ${winnerOf(m) === pair ? 'font-bold' : ''}`}>{pairName(m, pair, players)}</span>
          <span className="flex gap-3 tabular-nums font-bold">
            {m.sets.map((s, i) => (
              <span key={i} className={(pair === 'A' ? s.a > s.b : s.b > s.a) ? '' : 'muted'}>
                {pair === 'A' ? s.a : s.b}
              </span>
            ))}
          </span>
        </div>
      ))}
    </div>
  )
}

function SlotPicker({ open, slot, match, onClose, onPick }: { open: boolean; slot: { pair: Pair; idx: 0 | 1 } | null; match: PadelMatch; onClose: () => void; onPick: (id: string) => void }) {
  const { db, memberId } = useSession()
  const toast = useToast()
  const players = useFmoPlayers()
  const [filter, setFilter] = useState('')
  const [guestName, setGuestName] = useState('')
  useEffect(() => {
    if (open) setFilter('')
  }, [open])
  if (!slot) return null
  const current = (slot.pair === 'A' ? match.pairA : match.pairB)[slot.idx]
  const onCourt = new Set([...match.pairA, ...match.pairB].filter(Boolean))
  const list = players.list.filter((p) => p.id !== current && (!filter || p.name.toLowerCase().includes(filter.toLowerCase())))

  async function addGuest() {
    const name = guestName.trim()
    if (name.length < 2 || !memberId) {
      toast.error('Poné el nombre del invitado.')
      return
    }
    try {
      const gid = 'g-' + db.newId().slice(0, 10).toLowerCase()
      const g: FmoGuest = { id: gid, name, createdBy: memberId, createdAt: Date.now(), updatedAt: Date.now() }
      await db.setDoc(P.fmoGuest(gid), g)
      setGuestName('')
      onPick(gid)
    } catch (e) {
      toast.error(errorText(e))
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`${slot.pair === 'A' ? 'Pareja de arriba' : 'Pareja de abajo'} · ${POSITION_LABEL[slot.idx]}`}>
      <input className="input mb-2" placeholder="Buscar" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Buscar jugador" />
      <div className="max-h-[50dvh] overflow-y-auto overscroll-contain -mx-1 px-1">
        {list.map((p) => (
          <button key={p.id} type="button" className="row w-full text-left" onClick={() => onPick(p.id)}>
            <span className="flex items-center gap-2 min-w-0">
              <Avatar id={p.id} alias={p.name} size={32} color={p.color} photo={p.photo} />
              <span className="font-semibold truncate">{p.name}</span>
              {p.guest ? <Pill tone="muted">Invitado</Pill> : null}
            </span>
            {onCourt.has(p.id) ? <span className="tiny muted shrink-0">En cancha · cambia de lugar</span> : null}
          </button>
        ))}
        {list.length === 0 ? <p className="small muted py-2">No hay nadie con ese nombre.</p> : null}
      </div>
      <div className="flex gap-2 mt-3">
        <input className="input" placeholder="Invitado nuevo" value={guestName} maxLength={30} onChange={(e) => setGuestName(e.target.value)} aria-label="Nombre de un invitado nuevo" />
        <Button variant="line" onClick={() => void addGuest()}>
          Sumar
        </Button>
      </div>
      {current ? (
        <Button variant="line" className="mt-3 w-full" onClick={() => onPick('')}>
          Dejar este lugar vacío
        </Button>
      ) : null}
    </Modal>
  )
}
