// Truco · Un partido: armado (1 vs 1, 2 vs 2 o 3 vs 3, a 15 o a 30), anotador en vivo con fósforos
// (malas y buenas, +1/+2/+3/+4, sacar y deshacer) y resultado. También "sólo sé quién ganó".
// Cada punto que se anota se guarda en el momento: los que miran desde otro celular lo ven en vivo.
import { Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { TRUCO, aCuantoLabel, formatoTruco } from '../../content/truco'
import { useSession } from '../../data/DataContext'
import { errorText } from '../../data/actions'
import { useDoc } from '../../data/hooks'
import { P } from '../../data/paths'
import type { TrucoMatch, TrucoTournament } from '../../data/types'
import { formatPoints } from '../../domain/fmo'
import { fmtDayLong, localToMs, msToLocalParts } from '../../domain/format'
import { malasBuenas, validateMatch, validateTeams, winnerOf, type Side } from '../../domain/truco'
import { Avatar, Button, Card, ConfirmDialog, Field, Input, Loading, LoginPrompt, Notice, Pill, Segmented } from '../../ui/components'
import { useToast } from '../../ui/toast'
import { useFmoPlayers, type FmoPlayers } from '../fmo/fmoShared'
import { Fosforos, PlayerPicker, teamLabel, teamPlayers } from './trucoShared'

export function TrucoPartido() {
  const { id } = useParams()
  const { db, memberId, isMember } = useSession()
  const toast = useToast()
  const navigate = useNavigate()
  const remote = useDoc<TrucoMatch>(id ? P.trucoMatch(id) : null)
  const players = useFmoPlayers()
  const [m, setM] = useState<TrucoMatch | null>(null)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [manualA, setManualA] = useState('')
  const [manualB, setManualB] = useState('')
  const tournament = useDoc<TrucoTournament>(m?.tournamentId ? P.trucoTournament(m.tournamentId) : null)

  useEffect(() => {
    if (remote.data && !dirty) setM(remote.data)
  }, [remote.data, dirty])

  if (remote.loading || players.loading) return <Loading />
  if (!m) return <Notice tone="warn">Ese partido no existe (capaz lo borraron). <Link className="underline" to="/truco">Volver a Partidos</Link></Notice>

  const winner = winnerOf(m)
  const inTournament = !!m.tournamentId
  const back = inTournament ? { to: `/truco/torneo/${m.tournamentId}`, label: `← ${tournament.data?.name ?? 'Torneo'}` } : { to: '/truco', label: '← Partidos' }

  function change(patch: Partial<TrucoMatch>) {
    setDirty(true)
    setM((cur) => (cur ? { ...cur, ...patch } : cur))
  }

  async function save(next: TrucoMatch, ok?: string) {
    if (!memberId) return false
    setBusy(true)
    try {
      const doc: TrucoMatch = { ...next, updatedBy: memberId, updatedAt: Date.now(), revision: (next.revision ?? 0) + 1 }
      await db.setDoc(P.trucoMatch(doc.id), doc)
      setM(doc)
      setDirty(false)
      if (ok) toast.ok(ok)
      return true
    } catch (e) {
      toast.error(errorText(e))
      return false
    } finally {
      setBusy(false)
    }
  }

  /** Anota (o saca) puntos y lo guarda en el momento. */
  async function tap(side: Side, n: number) {
    if (!m || !memberId) return
    if (n > 0 && winner) return
    const cur = side === 'A' ? m.scoreA : m.scoreB
    const value = Math.max(0, Math.min(m.target, cur + n))
    const delta = value - cur
    if (!delta) return
    if (navigator.vibrate) navigator.vibrate(15)
    const log = [...(m.log ?? []), { t: side, n: delta, at: Date.now() }].slice(-300)
    const patch = { scoreA: side === 'A' ? value : m.scoreA, scoreB: side === 'B' ? value : m.scoreB, log, updatedBy: memberId, updatedAt: Date.now() }
    setM({ ...m, ...patch })
    try {
      await db.updateDoc(P.trucoMatch(m.id), patch)
    } catch (e) {
      toast.error('No se guardó el punto: ' + errorText(e))
    }
  }

  async function startLive() {
    const err = validateTeams(m!)
    if (err) return toast.error(err)
    await save({ ...m!, status: 'LIVE', resultOnly: false }, '¡A jugar! Cada punto que anotes se guarda solo.')
  }

  async function finish() {
    const err = validateMatch(m!)
    if (err) return toast.error(err)
    const w = winnerOf(m!)!
    await save({ ...m!, status: 'PLAYED' }, `¡Ganó ${teamLabel(m!, w, players)}! Ya cuenta para el ranking.`)
  }

  function setSize(size: 1 | 2 | 3) {
    const fit = (team: string[]) => Array.from({ length: size }, (_, i) => team[i] ?? '')
    change({ size, teamA: fit(m!.teamA), teamB: fit(m!.teamB) })
  }

  function setSlot(side: Side, idx: number, pid: string) {
    const team = [...(side === 'A' ? m!.teamA : m!.teamB)]
    team[idx] = pid
    change(side === 'A' ? { teamA: team } : { teamB: team })
  }

  const header = (
    <div className="mb-4">
      <Link to={back.to} className="back-link">
        {back.label}
      </Link>
      <div className="flex items-start justify-between gap-3 flex-wrap mt-1">
        <div className="min-w-0">
          <h1 className="h1">
            {teamLabel(m, 'A', players)} <span className="muted">vs</span> {teamLabel(m, 'B', players)}
          </h1>
          <p className="small muted">
            {fmtDayLong(m.playedAt)} · {formatoTruco(m.size)} · {aCuantoLabel(m.target)}
            {inTournament && tournament.data ? ` · ${tournament.data.name}` : ''}
          </p>
        </div>
        <span className="flex items-center gap-2 flex-wrap">
          {m.status === 'PLAYED' ? <Pill tone="ok">Jugado</Pill> : m.status === 'LIVE' ? <Pill tone="ok">● En vivo</Pill> : <Pill tone="warn">Sin jugar</Pill>}
          {dirty ? <Pill tone="danger">Cambios sin guardar</Pill> : null}
        </span>
      </div>
    </div>
  )

  // ---------- Terminado ----------
  if (m.status === 'PLAYED') {
    return (
      <div>
        {header}
        <Result m={m} players={players} />
        {isMember ? (
          <div className="flex gap-2 flex-wrap mt-4">
            <Button variant="line" onClick={() => void save({ ...m, status: m.resultOnly ? 'DRAFT' : 'LIVE' }, 'Corregilo y volvé a guardarlo. Mientras tanto no cuenta para el ranking.')} loading={busy}>
              Corregir
            </Button>
            <Button variant="line" onClick={() => setDeleteOpen(true)} aria-label="Eliminar partido">
              <Trash2 size={16} /> Eliminar
            </Button>
          </div>
        ) : (
          <div className="mt-4">
            <LoginPrompt text="Entrá para anotar partidos." />
          </div>
        )}
        <DeleteDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} m={m} onDone={() => navigate(back.to)} />
      </div>
    )
  }

  // ---------- En vivo ----------
  if (m.status === 'LIVE') {
    return (
      <div>
        {header}
        {winner ? (
          <Card className="mb-4 text-center bg-ok-soft/40">
            <p className="h2">¡Ganó {teamLabel(m, winner, players)}! 🏆</p>
            {isMember ? (
              <Button variant="gold" className="mt-3 w-full sm:w-auto" onClick={() => void finish()} loading={busy}>
                Guardar el partido
              </Button>
            ) : null}
            {isMember ? <p className="tiny muted mt-2">Si fue un error, restá con el − de abajo.</p> : null}
          </Card>
        ) : null}
        <Anotador m={m} players={players} editable={isMember} onTap={(s, n) => void tap(s, n)} />
        {isMember ? (
          <div className="grid gap-3 mt-4">
            <details className="card p-3">
              <summary className="small font-semibold cursor-pointer min-h-[40px] flex items-center">Cargar el resultado a mano</summary>
              <p className="tiny muted mb-2">Si lo anotaron en papel, poné cómo terminó.</p>
              <div className="grid grid-cols-[1fr_auto_1fr_auto] gap-2 items-end">
                <Field label={teamLabel(m, 'A', players)} id="tm-a">
                  <Input id="tm-a" type="number" inputMode="numeric" min={0} max={m.target} value={manualA} placeholder={String(m.scoreA)} onChange={(e) => setManualA(e.target.value)} />
                </Field>
                <span className="pb-3 muted">a</span>
                <Field label={teamLabel(m, 'B', players)} id="tm-b">
                  <Input id="tm-b" type="number" inputMode="numeric" min={0} max={m.target} value={manualB} placeholder={String(m.scoreB)} onChange={(e) => setManualB(e.target.value)} />
                </Field>
                <Button
                  variant="line"
                  className="mb-3"
                  onClick={() => {
                    const a = manualA === '' ? m.scoreA : Math.max(0, Math.min(m.target, Math.round(Number(manualA))))
                    const b = manualB === '' ? m.scoreB : Math.max(0, Math.min(m.target, Math.round(Number(manualB))))
                    if (Number.isNaN(a) || Number.isNaN(b)) return toast.error('Poné números.')
                    const log = [...(m.log ?? [])]
                    if (a !== m.scoreA) log.push({ t: 'A', n: a - m.scoreA, at: Date.now() })
                    if (b !== m.scoreB) log.push({ t: 'B', n: b - m.scoreB, at: Date.now() })
                    setManualA('')
                    setManualB('')
                    void save({ ...m, scoreA: a, scoreB: b, log }, 'Resultado cargado')
                  }}
                >
                  Usar
                </Button>
              </div>
            </details>
            <div className="flex gap-2 flex-wrap">
              {!inTournament || m.scoreA + m.scoreB === 0 ? (
                <Button variant="line" onClick={() => void save({ ...m, status: 'DRAFT' })} loading={busy}>
                  Volver a armar
                </Button>
              ) : null}
              <Button variant="line" onClick={() => setDeleteOpen(true)} aria-label="Eliminar partido">
                <Trash2 size={16} /> Eliminar
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <LoginPrompt text="Entrá para anotar." />
          </div>
        )}
        <DeleteDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} m={m} onDone={() => navigate(back.to)} />
      </div>
    )
  }

  // ---------- Armado ----------
  if (!isMember) {
    return (
      <div>
        {header}
        <div className="grid sm:grid-cols-2 gap-3">
          {(['A', 'B'] as const).map((s) => (
            <Card key={s}>
              <p className="font-bold">{s === 'A' ? m.nameA : m.nameB}</p>
              <p className="small muted">{teamPlayers(m, s, players)}</p>
            </Card>
          ))}
        </div>
        <div className="mt-4">
          <LoginPrompt text="Entrá para armar y anotar partidos." />
        </div>
      </div>
    )
  }

  const taken = new Set([...m.teamA, ...m.teamB].filter(Boolean))
  const teamErr = validateTeams(m)
  return (
    <div>
      {header}
      <div className="grid gap-4 lg:grid-cols-2 items-start">
        <Card>
          <p className="h3 mb-3">Partido</p>
          {inTournament ? (
            <p className="small mb-3">
              Es un partido del torneo <b>{tournament.data?.name ?? ''}</b>: los equipos ya están armados.
            </p>
          ) : (
            <>
              <p className="label">Formato</p>
              <Segmented ariaLabel="Formato" value={String(m.size) as '1' | '2' | '3'} onChange={(v) => setSize(Number(v) as 1 | 2 | 3)} options={TRUCO.formatos.map((n) => ({ value: String(n) as '1' | '2' | '3', label: formatoTruco(n) }))} />
              <p className="label mt-3">A cuántos</p>
              <Segmented ariaLabel="A cuántos" value={String(m.target) as '15' | '30'} onChange={(v) => change({ target: Number(v) as 15 | 30 })} options={TRUCO.aCuanto.map((n) => ({ value: String(n) as '15' | '30', label: n === 30 ? 'A 30 (malas y buenas)' : 'A 15' }))} />
            </>
          )}
          <Field label="Día" id="tr-date">
            <Input id="tr-date" type="date" value={msToLocalParts(m.playedAt).date} onChange={(e) => change({ playedAt: localToMs(e.target.value, msToLocalParts(m.playedAt).time) ?? m.playedAt })} />
          </Field>
        </Card>

        <Card>
          <p className="h3 mb-3">{m.size === 1 ? 'Quiénes juegan' : 'Equipos'}</p>
          <div className="grid gap-4">
            {(['A', 'B'] as const).map((s) => (
              <div key={s}>
                {m.size > 1 && !inTournament ? (
                  <Input value={s === 'A' ? m.nameA : m.nameB} maxLength={20} onChange={(e) => change(s === 'A' ? { nameA: e.target.value } : { nameB: e.target.value })} aria-label={`Nombre del equipo ${s === 'A' ? 1 : 2}`} className="font-bold mb-2" />
                ) : (
                  <p className="font-bold mb-1">{m.size === 1 ? (s === 'A' ? 'Jugador 1' : 'Jugador 2') : s === 'A' ? m.nameA : m.nameB}</p>
                )}
                <div className="grid gap-2">
                  {(s === 'A' ? m.teamA : m.teamB).map((pid, i) =>
                    inTournament ? (
                      <p key={i} className="small">
                        {players.nameOf(pid)}
                      </p>
                    ) : (
                      <PlayerPicker key={i} value={pid} onChange={(v) => setSlot(s, i, v)} players={players} exclude={[...taken]} label={`${s === 'A' ? 'Equipo 1' : 'Equipo 2'}, jugador ${i + 1}`} />
                    ),
                  )}
                </div>
              </div>
            ))}
          </div>
          {!inTournament ? <p className="tiny muted mt-3">¿Juega alguien que no es de la banda? En el desplegable, «+ Otro que no es de la banda…» y escribís su nombre.</p> : null}
        </Card>

        <Card className="lg:col-span-2">
          <p className="h3 mb-2">¿Cómo lo anotan?</p>
          <Segmented
            ariaLabel="Cómo se anota"
            value={m.resultOnly ? 'winner' : 'live'}
            onChange={(v) => change(v === 'winner' ? { resultOnly: true } : { resultOnly: false })}
            options={[
              { value: 'live', label: 'Anotar en vivo' },
              { value: 'winner', label: 'Sólo sé quién ganó' },
            ]}
          />
          {m.resultOnly ? (
            <div className="mt-3">
              <p className="small mb-2">¿Quién ganó?</p>
              <div className="grid sm:grid-cols-2 gap-2">
                {(['A', 'B'] as const).map((s) => (
                  <button key={s} type="button" aria-pressed={m.winner === s} onClick={() => change({ winner: s })} className={`btn justify-start ${m.winner === s ? 'btn-gold' : 'btn-line'}`}>
                    {teamLabel(m, s, players)}
                  </button>
                ))}
              </div>
              <p className="tiny muted mt-2">
                Suma al ranking ({formatPoints(TRUCO.puntos.gana)} al que gana, {formatPoints(TRUCO.puntos.pierde)} al que pierde), pero sin tantos.
              </p>
              <Button
                variant="gold"
                className="mt-3 w-full sm:w-auto"
                loading={busy}
                onClick={() => {
                  const err = validateMatch(m)
                  if (err) return toast.error(err)
                  void save({ ...m, status: 'PLAYED' }, `¡Ganó ${teamLabel(m, m.winner!, players)}! Ya cuenta para el ranking.`)
                }}
              >
                Guardar el partido
              </Button>
            </div>
          ) : (
            <div className="mt-3">
              <p className="small mb-3">Se abre el anotador: tocás el lado de cada equipo y suma un fósforo, como en las apps de truco. {teamErr ? <span className="text-warn">{teamErr}</span> : null}</p>
              <Button variant="gold" className="w-full sm:w-auto" onClick={() => void startLive()} loading={busy}>
                Empezar a anotar
              </Button>
            </div>
          )}
        </Card>
      </div>
      <div className="flex gap-2 flex-wrap mt-4">
        {dirty ? (
          <Button variant="line" onClick={() => void save(m, 'Guardado')} loading={busy}>
            Guardar para después
          </Button>
        ) : null}
        <Button variant="line" onClick={() => setDeleteOpen(true)} aria-label="Eliminar partido">
          <Trash2 size={16} /> Eliminar
        </Button>
      </div>
      <DeleteDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} m={m} onDone={() => navigate(back.to)} />
    </div>
  )
}

/** El anotador, como en las apps de truco: dos lados (Nosotros y Ellos, o el nombre de cada equipo).
 *  Tocar en cualquier parte de un lado suma un fósforo; el − de abajo de cada lado resta uno.
 *  Los fósforos arman cuadrados de 5 (4 lados y la diagonal), con las malas arriba y las buenas abajo. */
export function Anotador({ m, players, editable, onTap, size }: { m: TrucoMatch; players: FmoPlayers; editable: boolean; onTap?: (side: Side, n: number) => void; size?: number }) {
  const winner = winnerOf(m)
  // En la compu, fósforos más grandes.
  const wide = typeof window !== 'undefined' && window.matchMedia?.('(min-width: 768px)').matches
  const sq = size ?? (wide ? 64 : 56)
  const canTap = editable && !!onTap
  return (
    <div className="grid grid-cols-2 max-w-3xl rounded-2xl border border-line bg-card overflow-hidden select-none shadow-sm">
      {(['A', 'B'] as const).map((s) => {
        const score = s === 'A' ? m.scoreA : m.scoreB
        const mb = malasBuenas(score, m.target)
        const won = winner === s
        const name = teamLabel(m, s, players)
        const content = (
          <>
            <p className="font-extrabold text-lg truncate max-w-full">{name}</p>
            {m.size > 1 ? <p className="tiny muted truncate max-w-full">{teamPlayers(m, s, players)}</p> : null}
            <p className="text-4xl font-extrabold tabular-nums leading-none mt-2">{Math.min(score, m.target)}</p>
            <p className="tiny muted mt-1 mb-3">{won ? '¡Ganó!' : mb.part ? `${mb.inPart} en las ${mb.part}` : `de ${m.target}`}</p>
            <Fosforos score={score} target={m.target} size={sq} stacked />
            {canTap && !winner ? <p className="tiny muted mt-3">Tocá para sumar</p> : null}
          </>
        )
        return (
          <div key={s} className={`flex flex-col min-w-0 ${s === 'A' ? 'border-r-2 border-[var(--border)]' : ''} ${won ? 'bg-ok-soft/40' : ''}`}>
            {canTap ? (
              <button
                type="button"
                className="flex-1 flex flex-col items-center text-center px-2 pt-4 pb-4 transition-colors active:bg-soft/80 hover:bg-soft/30"
                style={{ touchAction: 'manipulation' }}
                onClick={() => !winner && onTap!(s, 1)}
                aria-label={`Sumar un fósforo a ${name} (va ${Math.min(score, m.target)})`}
              >
                {content}
              </button>
            ) : (
              <div className="flex-1 flex flex-col items-center text-center px-2 pt-4 pb-4">{content}</div>
            )}
            {canTap ? (
              <div className="p-2 border-t border-line">
                <button
                  type="button"
                  className="btn btn-line w-full !text-3xl !font-extrabold !min-h-[52px] leading-none"
                  style={{ touchAction: 'manipulation' }}
                  disabled={score === 0}
                  onClick={() => onTap!(s, -1)}
                  aria-label={`Restar un fósforo a ${name}`}
                >
                  −
                </button>
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

/** Cómo terminó: marcador, fósforos y lo que sumó cada uno para el ranking. */
function Result({ m, players }: { m: TrucoMatch; players: FmoPlayers }) {
  const w = winnerOf(m)
  return (
    <div className="grid gap-4">
      <Card className="text-center">
        {m.resultOnly ? (
          <>
            <p className="h2">Ganó {w ? teamLabel(m, w, players) : '—'}</p>
            <p className="tiny muted mt-1">Se cargó sólo quién ganó, sin los tantos.</p>
          </>
        ) : (
          <p className="text-4xl font-extrabold tabular-nums">
            {Math.min(m.scoreA, m.target)} <span className="muted">a</span> {Math.min(m.scoreB, m.target)}
          </p>
        )}
      </Card>
      {!m.resultOnly ? <Anotador m={m} players={players} editable={false} /> : null}
      <Card>
        <p className="h3 mb-2">Para el ranking</p>
        {(['A', 'B'] as const).map((s) =>
          (s === 'A' ? m.teamA : m.teamB).filter(Boolean).map((pid) => (
            <div key={pid} className="row small">
              <span className="flex items-center gap-2 min-w-0">
                <Avatar id={pid} alias={players.nameOf(pid)} size={26} color={players.byId[pid]?.color} photo={players.byId[pid]?.photo} />
                <span className="truncate">{players.nameOf(pid)}</span>
              </span>
              {w === s ? <Pill tone="ok">+{formatPoints(TRUCO.puntos.gana)}</Pill> : <Pill tone="danger">{formatPoints(TRUCO.puntos.pierde)}</Pill>}
            </div>
          )),
        )}
      </Card>
    </div>
  )
}

function DeleteDialog({ open, onClose, m, onDone }: { open: boolean; onClose: () => void; m: TrucoMatch; onDone: () => void }) {
  const { db } = useSession()
  const toast = useToast()
  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      title="Eliminar partido"
      text="Se borra el partido y deja de contar para el ranking (y para el torneo, si era de uno)."
      danger
      confirmLabel="Eliminar"
      onConfirm={async () => {
        try {
          await db.deleteDoc(P.trucoMatch(m.id))
          onDone()
        } catch (e) {
          toast.error(errorText(e))
        }
      }}
    />
  )
}
