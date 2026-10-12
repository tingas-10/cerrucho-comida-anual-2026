// Golf · Un partido: cancha, modalidad, jugadores o equipos, tarjeta y posiciones.
// Se guarda "por jugarse" o jugado. Jugado, lo corrigen los jugadores durante 48 horas; después, la comisión.
import { Plus, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { GOLF, GOLF_MODOS } from '../../content/golf'
import { useSession } from '../../data/DataContext'
import { errorText } from '../../data/actions'
import { proposeGolf } from '../../data/golf'
import { useDoc, useNow } from '../../data/hooks'
import { P } from '../../data/paths'
import type { FmoGuest, GolfCard, GolfMode, GolfRound } from '../../data/types'
import { fmtDayLong, fmtTime, localToMs, msToLocalParts } from '../../domain/format'
import { allPlayers, allowsTotal, calcCard, cardIds, emptyCard, isTeamMode, parTotal, regroup, roundResult, usesTotal, validateRound } from '../../domain/golf'
import { Button, Card, ConfirmDialog, Field, Input, Loading, LoginPrompt, Notice, Pill } from '../../ui/components'
import { useToast } from '../../ui/toast'
import { useFmoPlayers, type FmoPlayers } from '../fmo/fmoShared'
import { entrantName, formatHcp, modeLabel, useGolfCourses, useGolfHcps } from './golfShared'

const MANUAL = '__manual'
const HOURS = GOLF.horasParaCorregir * 3600000

export function GolfPartido() {
  const { id } = useParams()
  const { db, memberId, isMember, isGolfComm, golfPreview } = useSession()
  const toast = useToast()
  const navigate = useNavigate()
  const now = useNow(30000)
  const remote = useDoc<GolfRound>(id ? P.golfRound(id) : null)
  const players = useFmoPlayers()
  const courses = useGolfCourses()
  const hcps = useGolfHcps()
  const [m, setM] = useState<GolfRound | null>(null)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [fixMode, setFixMode] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [voidOpen, setVoidOpen] = useState(false)
  const [guestName, setGuestName] = useState('')

  useEffect(() => {
    if (remote.data && !dirty) setM(remote.data)
  }, [remote.data, dirty])

  if (remote.loading || players.loading || courses.loading) return <Loading />
  if (!m) return <Notice tone="warn">Ese partido no existe (capaz lo borraron). <Link className="underline" to="/golf">Volver a Partidos</Link></Notice>

  const played = m.status === 'PLAYED'
  const locked = played && (!!m.voided || !m.editableUntil || now > m.editableUntil)
  const canEdit = isMember && !locked
  const canPropose = (isGolfComm || golfPreview) && locked && !m.voided
  const cardsEditable = canEdit || (isGolfComm && canPropose && fixMode)
  const n = m.course.holes.length
  const res = roundResult(m)
  const inRound = new Set(allPlayers(m))
  const available = players.list.filter((p) => !inRound.has(p.id))
  const team = isTeamMode(m.mode)

  /** Deja una tarjeta por cada jugador (o equipo) y saca las que sobran. */
  function withCards(r: GolfRound): GolfRound {
    const ids = cardIds(r)
    const cards: Record<string, GolfCard> = {}
    for (const cid of ids) {
      const prev = r.cards[cid]
      cards[cid] = prev && prev.strokes.length === r.course.holes.length ? prev : emptyCard(r.course.holes.length, r.mode === 'scramble' ? 0 : (hcps.hcpOf(cid) ?? 0))
    }
    return { ...r, cards }
  }
  function change(fn: (r: GolfRound) => GolfRound) {
    setDirty(true)
    setM((cur) => (cur ? withCards(fn(cur)) : cur))
  }

  function setCourse(value: string) {
    change((r) => {
      if (value === MANUAL) return { ...r, courseId: null, course: { name: r.courseId ? 'Otra cancha' : r.course.name, holes: r.course.holes } }
      const c = courses.active.find((x) => x.id === value)
      if (!c) return r
      return { ...r, courseId: c.id, course: { name: c.name, holes: c.holes }, cards: {} }
    })
  }
  function setHolesCount(count: number) {
    change((r) => ({ ...r, course: { ...r.course, holes: Array.from({ length: count }, (_, i) => r.course.holes[i] ?? { par: GOLF.parDefault, si: i + 1 }).map((h, i) => ({ ...h, si: i + 1 })) }, cards: {} }))
  }
  function setPar(i: number, par: number) {
    change((r) => ({ ...r, course: { ...r.course, holes: r.course.holes.map((h, j) => (j === i ? { ...h, par } : h)) } }))
  }
  function setMode(mode: GolfMode) {
    change((r) => ({ ...r, mode, entrants: regroup(allPlayers(r), mode), cards: isTeamMode(mode) !== isTeamMode(r.mode) || mode === 'scramble' || r.mode === 'scramble' ? {} : r.cards }))
  }
  function addPlayer(pid: string, entrantId?: string) {
    if (!pid) return
    change((r) => {
      if (!isTeamMode(r.mode)) return { ...r, entrants: [...r.entrants, { id: pid, players: [pid] }] }
      return { ...r, entrants: r.entrants.map((e) => (e.id === entrantId ? { ...e, players: [...e.players, pid] } : e)) }
    })
  }
  function removePlayer(pid: string) {
    change((r) => ({ ...r, entrants: isTeamMode(r.mode) ? r.entrants.map((e) => ({ ...e, players: e.players.filter((x) => x !== pid) })) : r.entrants.filter((e) => e.id !== pid) }))
  }
  function addTeam() {
    change((r) => {
      let k = r.entrants.length + 1
      while (r.entrants.some((e) => e.id === `t${k}`)) k++
      return { ...r, entrants: [...r.entrants, { id: `t${k}`, players: [] }] }
    })
  }
  function removeTeam(tid: string) {
    change((r) => ({ ...r, entrants: r.entrants.filter((e) => e.id !== tid) }))
  }
  function setCard(cid: string, patch: Partial<GolfCard>) {
    change((r) => ({ ...r, cards: { ...r.cards, [cid]: { ...r.cards[cid], ...patch } } }))
  }

  async function addGuest(entrantId?: string) {
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
      addPlayer(gid, entrantId)
    } catch (e) {
      toast.error(errorText(e))
    }
  }

  async function save(status: GolfRound['status']) {
    if (!memberId || !m) return
    if (status === 'PLAYED') {
      const err = validateRound(m)
      if (err) return toast.error(err)
    }
    setBusy(true)
    try {
      const t = Date.now()
      const editableUntil = status === 'PLAYED' ? (played ? m.editableUntil : t + HOURS) : null
      const next: GolfRound = { ...m, status, editableUntil, updatedBy: memberId, updatedAt: t, revision: (m.revision ?? 0) + 1 }
      await db.setDoc(P.golfRound(m.id), next)
      setM(next)
      setDirty(false)
      toast.ok(status === 'PLAYED' ? `Partido guardado. Lo pueden corregir hasta el ${fmtDayLong(editableUntil!)} a las ${fmtTime(editableUntil!)}.` : 'Guardada como por jugarse.')
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  async function proposeFix() {
    if (!memberId || !m) return
    const err = validateRound(m)
    if (err) return toast.error(err)
    setBusy(true)
    try {
      await proposeGolf(db, memberId, `Corregir la tarjeta del partido del ${fmtDayLong(m.playedAt)} en ${m.course.name}`, { type: 'round_fix', roundId: m.id, cards: m.cards })
      setDirty(false)
      setFixMode(false)
      toast.ok('Propuesta enviada. Se aplica cuando otro de la comisión la apruebe.')
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  const header = (
    <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
      <div className="min-w-0">
        <Link to="/golf" className="tiny underline muted">
          ← Partidos
        </Link>
        <h1 className="h1 mt-1">{m.course.name}</h1>
        <p className="small muted">
          {fmtDayLong(m.playedAt)} · {fmtTime(m.playedAt)} h · {modeLabel(m)} · {n} hoyos, par {parTotal(m.course.holes)}
        </p>
      </div>
      <span className="flex items-center gap-2 flex-wrap">
        {m.voided ? <Pill tone="danger">Anulada</Pill> : played ? <Pill tone="ok">Jugada</Pill> : <Pill tone="warn">Por jugarse</Pill>}
        {dirty ? <Pill tone="danger">Cambios sin guardar</Pill> : null}
      </span>
    </div>
  )

  const standings = (
    <Card>
      <p className="h3 mb-2">Posiciones</p>
      {!res.complete ? (
        <p className="small muted">{validateRound(m) ?? 'Cargá las tarjetas para ver la tabla.'}</p>
      ) : (
        <>
          {res.standings.map((s) => {
            const e = m.entrants.find((x) => x.id === s.entrantId)!
            return (
              <div key={s.entrantId} className="flex justify-between gap-3 py-1.5 border-b border-line last:border-0">
                <span className={`truncate ${s.position === 1 ? 'font-bold' : ''}`}>
                  {s.position === 1 ? '🥇' : s.position === 2 ? '🥈' : s.position === 3 ? '🥉' : `${s.position}º`} {entrantName(e, players)}
                </span>
                <span className="tabular-nums shrink-0">{s.label}</span>
              </div>
            )
          })}
          {res.match ? (
            <p className="tiny muted mt-2">
              {res.match.aHoles === res.match.bHoles ? 'Empate' : `Ganó ${players.nameOf((res.match.aHoles > res.match.bHoles ? res.match.aId : res.match.bId) as string)}`} · {res.match.halved} hoyos empatados
            </p>
          ) : null}
        </>
      )}
    </Card>
  )

  if (!isMember) {
    return (
      <div>
        {header}
        <div className="grid lg:grid-cols-[1fr_320px] gap-4 items-start">
          <Scorecard round={m} players={players} editable={false} onCard={() => undefined} />
          {standings}
        </div>
        <div className="mt-4">
          <LoginPrompt text="Entrá para armar partidos o cargar tu tarjeta." />
        </div>
      </div>
    )
  }

  return (
    <div>
      {header}
      {played && !locked && m.editableUntil ? (
        <Notice>
          Los jugadores lo pueden corregir hasta el {fmtDayLong(m.editableUntil)} a las {fmtTime(m.editableUntil)}. Después, sólo la comisión (con 2 aprobaciones).
        </Notice>
      ) : null}
      {locked && !m.voided ? (
        <Notice tone="warn">
          Ya pasó el plazo para corregirlo. {isGolfComm ? 'Como sos de la comisión, podés proponer una corrección o anularlo: se aplica cuando otro comisionado la apruebe.' : 'Si hay un error, avisale a la comisión de golf.'}
        </Notice>
      ) : null}

      <div className="grid gap-4 mt-4">
        {canEdit ? (
          <Card>
            <p className="h3 mb-3">Datos del partido</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Día" id="g-date">
                <Input id="g-date" type="date" value={msToLocalParts(m.playedAt).date} onChange={(e) => change((r) => ({ ...r, playedAt: localToMs(e.target.value, msToLocalParts(r.playedAt).time) ?? r.playedAt }))} />
              </Field>
              <Field label="Hora" id="g-time">
                <Input id="g-time" type="time" value={msToLocalParts(m.playedAt).time} onChange={(e) => change((r) => ({ ...r, playedAt: localToMs(msToLocalParts(r.playedAt).date, e.target.value) ?? r.playedAt }))} />
              </Field>
            </div>
            <Field label="Cancha" id="g-course" hint={courses.active.length ? undefined : 'Todavía no hay canchas cargadas por la comisión: cargá el par a mano.'}>
              <select id="g-course" className="input" value={m.courseId ?? MANUAL} onChange={(e) => setCourse(e.target.value)}>
                {courses.active.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.holes.length} hoyos, par {parTotal(c.holes)}
                  </option>
                ))}
                <option value={MANUAL}>Otra cancha (cargar el par a mano)</option>
              </select>
            </Field>
            {m.courseId === null ? (
              <div className="rounded-xl border border-line p-3 mb-3">
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <Field label="Nombre de la cancha" id="g-cname">
                    <Input id="g-cname" value={m.course.name} maxLength={40} onChange={(e) => change((r) => ({ ...r, course: { ...r.course, name: e.target.value } }))} />
                  </Field>
                  <Field label="Hoyos" id="g-holes">
                    <select id="g-holes" className="input" value={n} onChange={(e) => setHolesCount(Number(e.target.value))}>
                      <option value={9}>9</option>
                      <option value={18}>18</option>
                    </select>
                  </Field>
                </div>
                <p className="label">Par de cada hoyo</p>
                <div className="grid grid-cols-6 sm:grid-cols-9 gap-1">
                  {m.course.holes.map((h, i) => (
                    <label key={i} className="flex flex-col items-center text-[11px] muted">
                      {i + 1}
                      <select className="input !px-1 text-center" value={h.par} onChange={(e) => setPar(i, Number(e.target.value))} aria-label={`Par del hoyo ${i + 1}`}>
                        {[3, 4, 5, 6].map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
                <p className="tiny muted mt-2">Par {parTotal(m.course.holes)}. Para que quede guardada para siempre, pedile a la comisión que la cargue en Canchas.</p>
              </div>
            ) : null}
            <Field label="Modalidad" id="g-mode" hint={GOLF_MODOS[m.mode].desc}>
              <select id="g-mode" className="input" value={m.mode} onChange={(e) => setMode(e.target.value as GolfMode)}>
                {(Object.keys(GOLF_MODOS) as GolfMode[]).map((k) => (
                  <option key={k} value={k}>
                    {GOLF_MODOS[k].label}
                  </option>
                ))}
              </select>
            </Field>
            <label className="flex items-center gap-2 small font-semibold min-h-[40px]">
              <input type="checkbox" className="w-5 h-5" checked={m.useHcp} onChange={(e) => change((r) => ({ ...r, useHcp: e.target.checked }))} />
              Con hándicap
            </label>
          </Card>
        ) : null}

        {canEdit ? (
          <Card>
            <p className="h3 mb-2">{team ? (m.mode === 'fourball' ? 'Parejas' : 'Equipos') : 'Jugadores'}</p>
            {!team ? (
              <>
                <div className="flex flex-wrap gap-2 mb-3">
                  {m.entrants.length === 0 ? <p className="small muted">Todavía no hay nadie.</p> : null}
                  {m.entrants.map((e) => (
                    <span key={e.id} className="pill flex items-center gap-1">
                      {players.nameOf(e.players[0])}
                      <button type="button" aria-label={`Sacar a ${players.nameOf(e.players[0])}`} onClick={() => removePlayer(e.players[0])} className="ml-1">
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                </div>
                {m.mode === 'match' && m.entrants.length >= 2 ? null : <PlayerSelect available={available} onPick={(pid) => addPlayer(pid)} />}
              </>
            ) : (
              <div className="grid gap-3">
                {m.entrants.map((e, i) => (
                  <div key={e.id} className="rounded-xl border border-line p-3">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <p className="font-bold">{m.mode === 'fourball' ? 'Pareja' : 'Equipo'} {i + 1}</p>
                      <button type="button" className="btn btn-line btn-sm" onClick={() => removeTeam(e.id)} aria-label={`Sacar ${m.mode === 'fourball' ? 'pareja' : 'equipo'} ${i + 1}`}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {e.players.map((p) => (
                        <span key={p} className="pill flex items-center gap-1">
                          {players.nameOf(p)}
                          <button type="button" aria-label={`Sacar a ${players.nameOf(p)}`} onClick={() => removePlayer(p)} className="ml-1">
                            <X size={14} />
                          </button>
                        </span>
                      ))}
                    </div>
                    {m.mode === 'fourball' && e.players.length >= 2 ? null : <PlayerSelect available={available} onPick={(pid) => addPlayer(pid, e.id)} />}
                  </div>
                ))}
                <Button variant="line" onClick={addTeam}>
                  <Plus size={16} /> {m.mode === 'fourball' ? 'Sumar pareja' : 'Sumar equipo'}
                </Button>
              </div>
            )}
            <div className="flex gap-2 mt-3">
              <input className="input" placeholder="Invitado nuevo" value={guestName} maxLength={30} onChange={(e) => setGuestName(e.target.value)} aria-label="Nombre de un invitado" />
              <Button variant="line" onClick={() => void addGuest(team ? m.entrants.find((e) => m.mode !== 'fourball' || e.players.length < 2)?.id : undefined)}>
                Sumar
              </Button>
            </div>
            <p className="tiny muted mt-1">Los invitados son los mismos de FMO y Pádel. {team ? 'El invitado nuevo entra en el primer equipo con lugar.' : ''}</p>
          </Card>
        ) : null}

        <div className="grid lg:grid-cols-[1fr_320px] gap-4 items-start">
          <Scorecard round={m} players={players} editable={cardsEditable} onCard={setCard} />
          {standings}
        </div>

        {canEdit ? (
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
                <Button variant="line" onClick={() => setDeleteOpen(true)} aria-label="Eliminar partido">
                  <Trash2 size={16} /> Eliminar
                </Button>
              </>
            )}
          </div>
        ) : null}

        {canPropose ? (
          <Card>
            <p className="h3 mb-1">Comisión de golf</p>
            <p className="tiny muted mb-3">{golfPreview ? 'Vista de administrador: así lo ven los comisionados. Los botones están desactivados.' : 'Los cambios se aplican cuando los aprueban 2 comisionados (vos ya contás como uno).'}</p>
            <div className="flex gap-2 flex-wrap">
              {fixMode ? (
                <>
                  <Button variant="gold" onClick={() => void proposeFix()} loading={busy} disabled={!dirty}>
                    Proponer esta corrección
                  </Button>
                  <Button
                    variant="line"
                    onClick={() => {
                      setFixMode(false)
                      setDirty(false)
                      setM(remote.data)
                    }}
                  >
                    Cancelar
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="line" disabled={!isGolfComm} onClick={() => setFixMode(true)}>
                    Corregir la tarjeta
                  </Button>
                  <Button variant="line" disabled={!isGolfComm} onClick={() => setVoidOpen(true)}>
                    Proponer anularlo
                  </Button>
                </>
              )}
            </div>
          </Card>
        ) : null}
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Eliminar partido"
        text="Se borra el partido por jugarse."
        danger
        confirmLabel="Eliminar"
        onConfirm={async () => {
          try {
            await db.deleteDoc(P.golfRound(m.id))
            navigate('/golf')
          } catch (e) {
            toast.error(errorText(e))
          }
        }}
      />
      <ConfirmDialog
        open={voidOpen}
        onClose={() => setVoidOpen(false)}
        title="Proponer anular el partido"
        text="Si otro comisionado lo aprueba, el partido deja de contar para el ranking y las estadísticas."
        confirmLabel="Proponer"
        onConfirm={async () => {
          try {
            await proposeGolf(db, memberId!, `Anular el partido del ${fmtDayLong(m.playedAt)} en ${m.course.name}`, { type: 'round_void', roundId: m.id })
            toast.ok('Propuesta enviada a la comisión.')
          } catch (e) {
            toast.error(errorText(e))
          }
        }}
      />
    </div>
  )
}

function PlayerSelect({ available, onPick }: { available: FmoPlayers['list']; onPick: (id: string) => void }) {
  return (
    <select className="input" value="" onChange={(e) => onPick(e.target.value)} aria-label="Sumar jugador">
      <option value="">+ Sumar jugador…</option>
      {available.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
          {p.guest ? ' (invitado)' : ''}
        </option>
      ))}
    </select>
  )
}

/** Tarjeta: hoyos en filas y jugadores (o equipos) en columnas. */
function Scorecard({ round, players, editable, onCard }: { round: GolfRound; players: FmoPlayers; editable: boolean; onCard: (cid: string, patch: Partial<GolfCard>) => void }) {
  const ids = cardIds(round)
  const holes = round.course.holes
  const nameOf = (cid: string) => (round.mode === 'scramble' ? entrantName(round.entrants.find((e) => e.id === cid)!, players) : players.nameOf(cid))
  if (!ids.length) {
    return (
      <Card>
        <p className="h3 mb-1">Tarjeta</p>
        <p className="small muted">Sumá jugadores para cargar la tarjeta.</p>
      </Card>
    )
  }
  const calcs = Object.fromEntries(ids.map((cid) => [cid, calcCard(round, round.cards[cid])]))
  const num = (v: string) => (v === '' ? null : Math.max(1, Math.min(20, Math.floor(Number(v)) || 1)))
  return (
    <Card className="!p-3 sm:!p-5">
      <p className="h3 mb-1">Tarjeta</p>
      <p className="tiny muted mb-2">{allowsTotal(round.mode) ? 'Cargá golpes por hoyo o tocá "Sólo total".' : 'Cargá los golpes de cada hoyo.'}</p>
      <div className="overflow-x-auto -mx-1 px-1">
        <table className="text-sm border-separate border-spacing-0" style={{ minWidth: 70 + ids.length * 74 }}>
          <thead>
            <tr>
              <th className="sticky left-0 bg-card text-left tiny muted font-semibold py-1 pr-2 w-[70px]">Hoyo</th>
              {ids.map((cid) => (
                <th key={cid} className="px-1 py-1 align-bottom" style={{ minWidth: 74 }}>
                  <span className="block small font-bold truncate max-w-[110px] mx-auto">{nameOf(cid)}</span>
                  {editable ? (
                    <label className="flex items-center justify-center gap-1 tiny muted font-normal mt-1">
                      hcp
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.1"
                        className="input !w-16 !min-h-[36px] !py-1 text-center"
                        value={round.cards[cid]?.hcp ?? 0}
                        onChange={(e) => onCard(cid, { hcp: Math.max(-10, Math.min(54, Number(e.target.value) || 0)) })}
                        aria-label={`Hándicap de ${nameOf(cid)} en este partido`}
                      />
                    </label>
                  ) : round.useHcp ? (
                    <span className="block tiny muted font-normal">hcp {formatHcp(round.cards[cid]?.hcp)}</span>
                  ) : null}
                  {editable && allowsTotal(round.mode) ? (
                    <label className="flex items-center justify-center gap-1 tiny font-normal mt-1">
                      <input
                        type="checkbox"
                        checked={usesTotal(round.cards[cid], round.mode) || (round.cards[cid]?.total !== null && round.cards[cid]?.total !== undefined)}
                        onChange={(e) =>
                          onCard(cid, e.target.checked ? { strokes: holes.map(() => null), total: calcs[cid].gross ?? 0 } : { total: null })
                        }
                      />
                      Sólo total
                    </label>
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {holes.map((h, i) => (
              <tr key={i}>
                <td className="sticky left-0 bg-card py-0.5 pr-2 border-t border-line">
                  <span className="font-bold">{i + 1}</span> <span className="tiny muted">par {h.par}</span>
                </td>
                {ids.map((cid) => {
                  const card = round.cards[cid]
                  const totalMode = card?.total !== null && card?.total !== undefined
                  const s = card?.strokes[i] ?? null
                  const tone = s === null ? '' : s === 1 ? 'text-accent font-extrabold' : s <= h.par - 1 ? 'text-ok font-bold' : s >= h.par + 2 ? 'text-danger' : ''
                  return (
                    <td key={cid} className="px-1 py-0.5 border-t border-line text-center">
                      {totalMode ? (
                        <span className="muted">—</span>
                      ) : editable ? (
                        <input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={20}
                          className={`input !w-16 !min-h-[40px] !py-1 text-center tabular-nums ${tone}`}
                          value={s ?? ''}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => onCard(cid, { strokes: card.strokes.map((x, j) => (j === i ? num(e.target.value) : x)) })}
                          aria-label={`Hoyo ${i + 1}, golpes de ${nameOf(cid)}`}
                        />
                      ) : (
                        <span className={`tabular-nums ${tone}`}>{s ?? '·'}</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="sticky left-0 bg-card py-1.5 pr-2 border-t-2 border-line font-bold">Total</td>
              {ids.map((cid) => {
                const card = round.cards[cid]
                const totalMode = card?.total !== null && card?.total !== undefined
                return (
                  <td key={cid} className="px-1 py-1.5 border-t-2 border-line text-center font-bold tabular-nums">
                    {totalMode && editable ? (
                      <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        className="input !w-16 !min-h-[40px] !py-1 text-center"
                        value={card.total ?? ''}
                        onChange={(e) => onCard(cid, { total: e.target.value === '' ? 0 : Math.max(0, Math.floor(Number(e.target.value)) || 0) })}
                        aria-label={`Total de golpes de ${nameOf(cid)}`}
                      />
                    ) : (
                      (calcs[cid].gross ?? '—')
                    )}
                  </td>
                )
              })}
            </tr>
            {round.useHcp && round.mode !== 'stableford' && round.mode !== 'match' ? (
              <tr>
                <td className="sticky left-0 bg-card py-1 pr-2 tiny muted">Neto</td>
                {ids.map((cid) => (
                  <td key={cid} className="px-1 py-1 text-center tiny muted tabular-nums">
                    {calcs[cid].net ?? '—'}
                  </td>
                ))}
              </tr>
            ) : null}
            {round.mode === 'stableford' ? (
              <tr>
                <td className="sticky left-0 bg-card py-1 pr-2 tiny font-bold text-accent">Puntos</td>
                {ids.map((cid) => (
                  <td key={cid} className="px-1 py-1 text-center font-bold text-accent tabular-nums">
                    {calcs[cid].stableford ?? '—'}
                  </td>
                ))}
              </tr>
            ) : null}
          </tfoot>
        </table>
      </div>
    </Card>
  )
}
