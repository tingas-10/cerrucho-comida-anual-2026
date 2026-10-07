// FMO · Un partido: cancha con fichas arrastrables, suplentes, banco, invitados, goles y guardado.
// Se guarda "por jugarse" (armado, con día y hora, sin resultado) o "jugado" (con goles, cuenta para el ranking).
import { ArrowDown, ArrowUp, Minus, Plus, Share2, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { FMO } from '../../content/fmo'
import { useSession } from '../../data/DataContext'
import { errorText } from '../../data/actions'
import { useDoc } from '../../data/hooks'
import { P } from '../../data/paths'
import type { FmoGuest, FmoMatch } from '../../data/types'
import { defaultPosition, scoreOf, startersOf, subsOf, teamOf, type Team } from '../../domain/fmo'
import { fmtDayLong, fmtTime, initials, localToMs, msToLocalParts } from '../../domain/format'
import { Avatar, Button, Card, ConfirmDialog, Field, Input, Loading, LoginPrompt, Notice, Pill, Segmented } from '../../ui/components'
import { useToast } from '../../ui/toast'
import { FmoStoryModal } from './FmoStory'
import { useFmoPlayers, type FmoPlayers } from './fmoShared'

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

export function FmoPartido() {
  const { id } = useParams()
  const { db, memberId, isMember } = useSession()
  const toast = useToast()
  const navigate = useNavigate()
  const remote = useDoc<FmoMatch>(id ? P.fmoMatch(id) : null)
  const players = useFmoPlayers()
  const [m, setM] = useState<FmoMatch | null>(null)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [guestName, setGuestName] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [storyOpen, setStoryOpen] = useState(false)
  const [entryAs, setEntryAs] = useState<'starter' | 'sub'>('starter')

  useEffect(() => {
    if (remote.data && !dirty) setM(remote.data)
  }, [remote.data, dirty])

  if (remote.loading || players.loading) return <Loading />
  if (!m) return <Notice tone="warn">Ese partido no existe (capaz lo borraron). <Link className="underline" to="/fmo">Volver a Partidos</Link></Notice>

  const played = m.status === 'PLAYED'
  const score = scoreOf(m)
  const teamA = teamOf(m, 'A')
  const teamB = teamOf(m, 'B')
  const teamName = (t: Team) => (t === 'A' ? m.nameA : m.nameB)
  const bench = players.list.filter((p) => !m.players[p.id] && (!filter || p.name.toLowerCase().includes(filter.toLowerCase())))
  const when = `${fmtDayLong(m.playedAt)} · ${fmtTime(m.playedAt)} h`
  const title = played ? (
    <>
      {m.nameA} <span className="tabular-nums">{score.a} – {score.b}</span> {m.nameB}
    </>
  ) : (
    <>
      {m.nameA} <span className="muted">vs</span> {m.nameB}
    </>
  )

  function change(patch: Partial<FmoMatch>) {
    setDirty(true)
    setM((cur) => (cur ? { ...cur, ...patch } : cur))
  }
  function changePlayer(pid: string, patch: Partial<FmoMatch['players'][string]> | null) {
    setDirty(true)
    setM((cur) => {
      if (!cur) return cur
      const next = { ...cur.players }
      if (patch === null) delete next[pid]
      else next[pid] = { ...next[pid], ...patch }
      return { ...cur, players: next }
    })
  }
  /** Suma a alguien al equipo: de titular si hay lugar (o si se eligió suplente, al banco del equipo). */
  function add(pid: string, team: Team) {
    const starters = startersOf(m!, team).length
    if (entryAs === 'sub') {
      changePlayer(pid, { team, ...defaultPosition(team, starters), goals: 0, sub: true })
      return
    }
    if (starters >= m!.size) {
      changePlayer(pid, { team, ...defaultPosition(team, starters), goals: 0, sub: true })
      toast.ok(`${teamName(team)} ya tiene ${m!.size} titulares: ${players.nameOf(pid)} entra de suplente.`)
      return
    }
    changePlayer(pid, { team, ...defaultPosition(team, starters), goals: 0, sub: false })
  }
  function toPitch(pid: string) {
    const team = m!.players[pid].team
    const starters = startersOf(m!, team).length
    if (starters >= m!.size) {
      toast.error(`${teamName(team)} ya tiene ${m!.size} en la cancha. Mandá a alguien al banco primero.`)
      return
    }
    changePlayer(pid, { sub: false, ...defaultPosition(team, starters) })
  }
  function move(pid: string, x: number, y: number) {
    changePlayer(pid, { x, y, team: y < 50 ? 'A' : 'B' })
  }

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
      toast.ok(`${name} ya está en la lista`)
    } catch (e) {
      toast.error(errorText(e))
    }
  }

  async function save(status: FmoMatch['status']) {
    if (!memberId || !m) return
    if (status === 'PLAYED' && (startersOf(m, 'A').length === 0 || startersOf(m, 'B').length === 0)) {
      toast.error('Poné al menos un titular en cada equipo.')
      return
    }
    setBusy(true)
    try {
      const next: FmoMatch = { ...m, status, updatedBy: memberId, updatedAt: Date.now(), revision: (m.revision ?? 0) + 1 }
      await db.setDoc(P.fmoMatch(m.id), next)
      setM(next)
      setDirty(false)
      toast.ok(status === 'PLAYED' ? 'Partido guardado. Ya cuenta para el ranking.' : 'Guardado como por jugarse.')
      if (status === 'PLAYED') setStoryOpen(true)
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  const sel = isMember && selected && m.players[selected] ? selected : null

  if (!isMember) {
    return (
      <div>
        <Link to="/fmo" className="tiny underline muted">
          ← Partidos
        </Link>
        <h1 className="h1 mt-1 mb-1">{title}</h1>
        <p className="small muted mb-4">{played ? fmtDayLong(m.playedAt) : `Por jugarse · ${when}`}</p>
        {played ? (
          <Button variant="gold" className="mb-4" onClick={() => setStoryOpen(true)}>
            <Share2 size={16} /> Historia para Instagram
          </Button>
        ) : null}
        <div className="grid lg:grid-cols-[minmax(0,520px)_1fr] gap-4 items-start">
          <div>
            <Pitch match={m} players={players} selected={null} onSelect={() => undefined} onMove={() => undefined} readOnly />
            <SubsBench match={m} players={players} selected={null} onSelect={() => undefined} />
          </div>
          <Card>
            {(['A', 'B'] as const).map((t) => (
              <div key={t} className="mb-3 last:mb-0">
                <p className="font-bold mb-1">
                  {teamName(t)} {played ? <span className="text-accent tabular-nums">{t === 'A' ? score.a : score.b}</span> : null}
                </p>
                {(t === 'A' ? teamA : teamB).map((pid) => (
                  <div key={pid} className="flex justify-between small py-1 border-b border-line last:border-0">
                    <span>
                      {players.nameOf(pid)} {m.players[pid].sub ? <span className="tiny muted">(suplente)</span> : null}
                    </span>
                    <span>{m.players[pid].goals ? `⚽ ${m.players[pid].goals}` : ''}</span>
                  </div>
                ))}
              </div>
            ))}
          </Card>
        </div>
        <div className="mt-4">
          <LoginPrompt text="Entrá para armar o editar partidos." />
        </div>
        <FmoStoryModal open={storyOpen} onClose={() => setStoryOpen(false)} match={m} players={players} />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div>
          <Link to="/fmo" className="tiny underline muted">
            ← Partidos
          </Link>
          <h1 className="h1 mt-1">{title}</h1>
          {!played ? <p className="small muted">{when}</p> : null}
        </div>
        <span className="flex items-center gap-2 flex-wrap">
          {played ? <Pill tone="ok">Jugado</Pill> : <Pill tone="warn">Por jugarse</Pill>}
          {dirty ? <Pill tone="danger">Cambios sin guardar</Pill> : null}
          {played && !dirty ? (
            <Button size="sm" variant="gold" onClick={() => setStoryOpen(true)}>
              <Share2 size={14} /> Historia
            </Button>
          ) : null}
        </span>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,520px)_1fr] gap-4 items-start">
        <div>
          <Pitch match={m} players={players} selected={sel} onSelect={setSelected} onMove={move} />
          <p className="tiny muted mt-2 text-center">Arrastrá las fichas. La mitad de arriba es {m.nameA}, la de abajo {m.nameB}. Tocá una ficha para cargarle goles, mandarla al banco o sacarla.</p>
          <SubsBench match={m} players={players} selected={sel} onSelect={setSelected} />
          {sel ? (
            <Card className="mt-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="font-bold">
                  {players.nameOf(sel)}{' '}
                  <span className="tiny muted font-normal">
                    · {teamName(m.players[sel].team)} · {m.players[sel].sub ? 'suplente' : 'titular'}
                  </span>
                </p>
                <span className="flex items-center gap-2 flex-wrap">
                  <Stepper label={`Goles de ${players.nameOf(sel)}`} value={m.players[sel].goals} onChange={(v) => changePlayer(sel, { goals: v })} />
                  {m.players[sel].sub ? (
                    <Button size="sm" variant="line" onClick={() => toPitch(sel)}>
                      <ArrowUp size={14} /> A la cancha
                    </Button>
                  ) : (
                    <Button size="sm" variant="line" onClick={() => changePlayer(sel, { sub: true })}>
                      <ArrowDown size={14} /> Al banco
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="line"
                    onClick={() => {
                      changePlayer(sel, null)
                      setSelected(null)
                    }}
                  >
                    Sacar
                  </Button>
                </span>
              </div>
            </Card>
          ) : null}
        </div>

        <div className="grid gap-4">
          <Card>
            <p className="h3 mb-3">Datos del partido</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label={played ? 'Día que se jugó' : 'Día'} id="fmo-date">
                <Input id="fmo-date" type="date" value={msToLocalParts(m.playedAt).date} onChange={(e) => change({ playedAt: localToMs(e.target.value, msToLocalParts(m.playedAt).time) ?? m.playedAt })} />
              </Field>
              <Field label="Hora" id="fmo-time">
                <Input id="fmo-time" type="time" value={msToLocalParts(m.playedAt).time} onChange={(e) => change({ playedAt: localToMs(msToLocalParts(m.playedAt).date, e.target.value) ?? m.playedAt })} />
              </Field>
              <Field label="Titulares por equipo" id="fmo-size">
                <select id="fmo-size" className="input" value={m.size} onChange={(e) => change({ size: Number(e.target.value) })}>
                  {FMO.tamanios.map((n) => (
                    <option key={n} value={n}>
                      {n} vs {n}
                    </option>
                  ))}
                </select>
              </Field>
              <span />
              <Field label="Equipo de arriba" id="fmo-a">
                <Input id="fmo-a" value={m.nameA} maxLength={20} onChange={(e) => change({ nameA: e.target.value })} />
              </Field>
              <Field label="Equipo de abajo" id="fmo-b">
                <Input id="fmo-b" value={m.nameB} maxLength={20} onChange={(e) => change({ nameB: e.target.value })} />
              </Field>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
              <p className="h3">Jugadores</p>
              <span className="tiny muted">
                {startersOf(m, 'A').length} vs {startersOf(m, 'B').length} en cancha · {subsOf(m, 'A').length + subsOf(m, 'B').length} suplentes
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="tiny muted">Entran como</span>
              <Segmented
                ariaLabel="Entran como"
                value={entryAs}
                onChange={setEntryAs}
                options={[
                  { value: 'starter', label: 'Titular' },
                  { value: 'sub', label: 'Suplente' },
                ]}
              />
            </div>
            <input className="input mb-2" placeholder="Buscar jugador" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Buscar jugador" />
            <div className="max-h-72 overflow-y-auto overscroll-contain">
              {bench.length === 0 ? <p className="small muted py-2">No queda nadie para sumar.</p> : null}
              {bench.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-line last:border-0">
                  <span className="small font-semibold min-w-0 truncate">
                    {p.name} {p.guest ? <Pill tone="muted" className="ml-1">Invitado</Pill> : null}
                  </span>
                  <span className="flex gap-1 shrink-0">
                    <Button size="sm" variant="line" onClick={() => add(p.id, 'A')}>
                      {m.nameA || 'A'}
                    </Button>
                    <Button size="sm" onClick={() => add(p.id, 'B')}>
                      {m.nameB || 'B'}
                    </Button>
                  </span>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-3">
              <input className="input" placeholder="Nombre de un invitado" value={guestName} maxLength={30} onChange={(e) => setGuestName(e.target.value)} aria-label="Nombre de un invitado" />
              <Button variant="line" onClick={() => void addGuest()}>
                Sumar
              </Button>
            </div>
            <p className="tiny muted mt-1">Suplentes, los que quieran: no ocupan lugar en la cancha, pero juegan y suman en las estadísticas. Los invitados no entran a la web.</p>
          </Card>

          <Card>
            <p className="h3 mb-1">Goles</p>
            {!played ? <p className="tiny muted mb-2">Si todavía no se jugó, dejalo en 0 y guardalo como por jugarse.</p> : null}
            <div className="grid sm:grid-cols-2 gap-4">
              {(['A', 'B'] as const).map((t) => {
                const ids = [...startersOf(m, t), ...subsOf(m, t)]
                return (
                  <div key={t}>
                    <p className="font-bold mb-1">
                      {teamName(t)} <span className="text-accent tabular-nums">{t === 'A' ? score.a : score.b}</span>
                    </p>
                    {ids.length === 0 ? <p className="small muted">Sin jugadores.</p> : null}
                    {ids.map((pid) => (
                      <div key={pid} className="flex items-center justify-between gap-2 py-1.5 border-b border-line">
                        <span className="small">
                          {players.nameOf(pid)} {m.players[pid].sub ? <span className="tiny muted">(sup.)</span> : null}
                        </span>
                        <Stepper label={`Goles de ${players.nameOf(pid)}`} value={m.players[pid].goals} onChange={(v) => changePlayer(pid, { goals: v })} />
                      </div>
                    ))}
                    <div className="flex items-center justify-between gap-2 py-1.5">
                      <span className="small muted">En contra o sin dueño</span>
                      <Stepper label="Otros goles" value={t === 'A' ? m.otherA : m.otherB} onChange={(v) => change(t === 'A' ? { otherA: v } : { otherB: v })} />
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

          <div className="sticky bottom-[calc(76px+env(safe-area-inset-bottom))] md:static z-10 flex gap-2 flex-wrap items-center rounded-xl border border-line bg-card p-2 shadow-lg md:border-0 md:bg-transparent md:p-0 md:shadow-none">
            {played ? (
              <Button variant="gold" onClick={() => void save('PLAYED')} loading={busy}>
                Guardar cambios
              </Button>
            ) : (
              <>
                <Button variant="gold" onClick={() => void save('DRAFT')} loading={busy}>
                  Guardar por jugarse
                </Button>
                <Button variant="line" onClick={() => void save('PLAYED')} loading={busy}>
                  Ya se jugó: guardar resultado
                </Button>
              </>
            )}
            <Button variant="line" onClick={() => setDeleteOpen(true)} aria-label="Eliminar partido">
              <Trash2 size={16} /> Eliminar
            </Button>
          </div>
          <p className="tiny muted">
            {played
              ? 'Está en el historial y cuenta para estadísticas y ranking.'
              : '"Por jugarse" lo deja armado en Partidos, sin resultado. Cuando se juegue, cargá los goles y tocá "Ya se jugó".'}
          </p>
        </div>
      </div>

      <FmoStoryModal open={storyOpen} onClose={() => setStoryOpen(false)} match={m} players={players} />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Eliminar partido"
        text="Se borra el partido con sus goles y deja de contar en las estadísticas."
        danger
        confirmLabel="Eliminar"
        onConfirm={async () => {
          try {
            await db.deleteDoc(P.fmoMatch(m.id))
            navigate('/fmo')
          } catch (e) {
            toast.error(errorText(e))
          }
        }}
      />
    </div>
  )
}

function Stepper({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <span className="inline-flex items-center gap-1" role="group" aria-label={label}>
      <button type="button" className="btn btn-line btn-sm px-3" aria-label="Restar" onClick={() => onChange(Math.max(0, value - 1))}>
        <Minus size={14} />
      </button>
      <span className="w-7 text-center font-bold tabular-nums">{value}</span>
      <button type="button" className="btn btn-line btn-sm px-3" aria-label="Sumar" onClick={() => onChange(Math.min(30, value + 1))}>
        <Plus size={14} />
      </button>
    </span>
  )
}

/** Banco de suplentes de cada equipo, debajo de la cancha. */
function SubsBench({ match, players, selected, onSelect }: { match: FmoMatch; players: FmoPlayers; selected: string | null; onSelect: (id: string | null) => void }) {
  const a = subsOf(match, 'A')
  const b = subsOf(match, 'B')
  if (!a.length && !b.length) return null
  return (
    <Card className="mt-3 !p-3">
      <p className="tiny muted font-semibold mb-2">SUPLENTES</p>
      <div className="grid grid-cols-2 gap-3">
        {(['A', 'B'] as const).map((t) => (
          <div key={t} className="min-w-0">
            <p className="small font-bold mb-1 truncate">{t === 'A' ? match.nameA : match.nameB}</p>
            {(t === 'A' ? a : b).length === 0 ? <p className="tiny muted">Sin suplentes</p> : null}
            <div className="flex flex-col gap-1">
              {(t === 'A' ? a : b).map((id) => {
                const p = players.byId[id]
                const goals = match.players[id].goals
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onSelect(selected === id ? null : id)}
                    className={`flex items-center gap-2 rounded-lg px-1.5 py-1 text-left min-w-0 ${selected === id ? 'bg-soft outline outline-2 outline-[#d9b45f]' : 'hover:bg-soft/60'}`}
                    aria-pressed={selected === id}
                  >
                    <Avatar id={id} alias={players.nameOf(id)} size={26} color={p?.color} photo={p?.photo} />
                    <span className="small truncate">{players.nameOf(id)}</span>
                    {goals ? <span className="tiny font-bold text-accent shrink-0">⚽{goals}</span> : null}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

function Pitch({ match, players, selected, onSelect, onMove, readOnly }: { match: FmoMatch; players: FmoPlayers; selected: string | null; onSelect: (id: string | null) => void; onMove: (id: string, x: number, y: number) => void; readOnly?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef<{ id: string; sx: number; sy: number; moved: boolean } | null>(null)

  function onDown(e: React.PointerEvent, id: string) {
    if (readOnly) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { id, sx: e.clientX, sy: e.clientY, moved: false }
  }
  function onMoveEv(e: React.PointerEvent, id: string) {
    const d = drag.current
    if (!d || d.id !== id || !ref.current) return
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 6) return
    d.moved = true
    const r = ref.current.getBoundingClientRect()
    onMove(id, clamp(((e.clientX - r.left) / r.width) * 100, 6, 94), clamp(((e.clientY - r.top) / r.height) * 100, 4, 96))
  }
  function onUp(id: string) {
    const d = drag.current
    drag.current = null
    if (d && !d.moved) onSelect(selected === id ? null : id)
  }

  return (
    <div
      ref={ref}
      className="relative w-full mx-auto rounded-2xl overflow-hidden select-none shadow-lg"
      style={{ aspectRatio: '2 / 3', maxWidth: 520, background: 'repeating-linear-gradient(0deg, #2f8f4e 0 10%, #2a8346 10% 20%)' }}
      aria-label="Cancha"
    >
      {/* Líneas */}
      <div className="absolute inset-[3%] border-2 border-white/70 rounded-md pointer-events-none" />
      <div className="absolute left-[3%] right-[3%] top-1/2 border-t-2 border-white/70 pointer-events-none" />
      <div className="absolute left-1/2 top-1/2 w-[26%] aspect-square -translate-x-1/2 -translate-y-1/2 border-2 border-white/70 rounded-full pointer-events-none" />
      <div className="absolute left-1/2 -translate-x-1/2 top-[3%] w-[44%] h-[12%] border-2 border-t-0 border-white/70 pointer-events-none" />
      <div className="absolute left-1/2 -translate-x-1/2 bottom-[3%] w-[44%] h-[12%] border-2 border-b-0 border-white/70 pointer-events-none" />
      <span className="absolute left-[5%] top-[4.5%] text-[11px] font-bold text-white/90 pointer-events-none">{match.nameA}</span>
      <span className="absolute left-[5%] bottom-[4.5%] text-[11px] font-bold text-white/90 pointer-events-none">{match.nameB}</span>

      {Object.entries(match.players)
        .filter(([, p]) => !p.sub)
        .map(([id, p]) => {
          const name = players.nameOf(id)
          const photo = players.byId[id]?.photo
          const isSel = selected === id
          return (
            <button
              key={id}
              type="button"
              onPointerDown={(e) => onDown(e, id)}
              onPointerMove={(e) => onMoveEv(e, id)}
              onPointerUp={() => onUp(id)}
              onPointerCancel={() => (drag.current = null)}
              className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5 cursor-grab active:cursor-grabbing"
              style={{ left: `${p.x}%`, top: `${p.y}%`, touchAction: 'none', zIndex: isSel ? 5 : 1 }}
              aria-label={`${name}, ${p.team === 'A' ? match.nameA : match.nameB}${p.goals ? `, ${p.goals} goles` : ''}`}
              aria-pressed={isSel}
            >
              <span
                className="relative grid place-items-center rounded-full font-extrabold text-[12px] shadow-md"
                style={{
                  width: 42,
                  height: 42,
                  background: p.team === 'A' ? '#ffffff' : '#0e1119',
                  color: p.team === 'A' ? '#0e1119' : '#ffffff',
                  border: `3px solid ${p.team === 'A' ? '#ffffff' : '#0e1119'}`,
                  outline: isSel ? '3px solid #d9b45f' : '1px solid rgba(0,0,0,.35)',
                }}
              >
                {photo ? <img src={photo} alt="" className="w-full h-full rounded-full object-cover pointer-events-none" draggable={false} /> : initials(name)}
                {p.goals > 0 ? (
                  <span className="absolute -top-1.5 -right-2 rounded-full bg-[#d9b45f] text-[#191409] text-[10px] font-extrabold px-1.5 py-0.5 leading-none">{p.goals}</span>
                ) : null}
              </span>
              <span className="text-[11px] font-bold text-white px-1.5 rounded bg-black/45 max-w-[84px] truncate">{name}</span>
            </button>
          )
        })}
    </div>
  )
}
