// Pádel · Un torneo: tablas, fechas, cuadro, reglas y la carga de cada resultado.
// Todo se calcula de los partidos: si se corrige un resultado, la tabla y el cuadro se acomodan solos.
import { Maximize2, Pencil, Trash2, Trophy } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { FORMATO_PARTIDO, FORMATO_TORNEO } from '../../content/padel'
import { useSession } from '../../data/DataContext'
import { errorText } from '../../data/actions'
import { useDoc } from '../../data/hooks'
import { P } from '../../data/paths'
import type { PadelFormat, PadelTournament } from '../../data/types'
import { formatPoints } from '../../domain/fmo'
import { fmtDayLong, localToMs, msToLocalParts } from '../../domain/format'
import { allFixtures, fixtureTitle, koTies, playable, roundTitle, tournamentState, type PFixture, type PadelTState } from '../../domain/padelTorneo'
import { Button, Card, ConfirmDialog, Field, Input, Loading, Modal, Notice, Pill, Section, Segmented } from '../../ui/components'
import { useToast } from '../../ui/toast'
import { useFmoPlayers, type FmoPlayers } from '../fmo/fmoShared'
import { PlayerPicker } from '../truco/trucoShared'
import { PadelTabs, usePadelMatches } from './padelShared'
import { ResultModal, TourTable, formatLabel, pairNames, useLiveToggle } from './padelTorneoShared'

export function PadelTorneo() {
  const { id } = useParams()
  const { db, isAdmin, memberId, isMember } = useSession()
  const toast = useToast()
  const navigate = useNavigate()
  const doc = useDoc<PadelTournament>(id ? P.padelTournament(id) : null)
  const { rows: matches, loading } = usePadelMatches()
  const players = useFmoPlayers()
  const [open, setOpen] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [pairsOpen, setPairsOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const t = doc.data
  const st = useMemo(() => (t ? tournamentState(t, matches) : null), [t, matches])

  if (doc.loading || loading || players.loading) return <Loading />
  if (!t || !st) return <Notice tone="warn">Ese torneo no existe (capaz lo borraron). <Link className="underline" to="/padel/torneos">Volver a Torneos</Link></Notice>

  const fixtures = allFixtures(st)
  const current = open ? (fixtures.find((f) => f.key === open) ?? null) : null
  const live = fixtures.filter((f) => f.live)
  const k = t.advance === 'all' ? Infinity : (t.advance ?? 0)
  const meta = [FORMATO_TORNEO[t.format].label, t.date ? fmtDayLong(t.date) : null, t.place].filter(Boolean).join(' · ')

  return (
    <div>
      <Link to="/padel/torneos" className="back-link">
        ← Torneos
      </Link>
      <div className="tour-band px-5 py-6 sm:px-8 sm:py-7 mb-4">
        <p className="tour-eyebrow pr-16">{meta}</p>
        <h1 className="tour-title text-[38px] sm:text-[54px] mt-1.5 pr-16">{t.name}</h1>
        <p className="small text-white/75 mt-2">
          {st.played} de {st.total} partidos jugados · {t.pairs.length} parejas
        </p>
        {st.champion ? (
          <p className="mt-3 flex items-center gap-2 font-extrabold italic uppercase text-[#d6f21d] text-lg pr-16">
            <Trophy size={22} /> Campeones: {pairNames(t, st.champion, players)}
          </p>
        ) : null}
        <div className="flex gap-2 flex-wrap mt-4 [&>*]:flex-1 sm:[&>*]:flex-none">
          <Link to={`/padel/torneo/${t.id}/cuadro`} className="btn btn-lime">
            <Maximize2 size={18} /> Ver torneo completo
          </Link>
        </div>
      </div>
      <PadelTabs />

      {live.length ? (
        <Card className="mb-4">
          <p className="h3 mb-1 flex items-center gap-2">
            <span className="tour-live">En vivo</span> En cancha ahora
          </p>
          {live.map((f) => (
            <FixtureRow key={f.key} t={t} st={st} f={f} players={players} onOpen={() => setOpen(f.key)} showTitle />
          ))}
        </Card>
      ) : null}

      {st.groups ? (
        <div className="grid md:grid-cols-2 gap-4 items-start">
          {st.groups.map((g) => (
            <Card key={g.name}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="tour-title text-2xl">{g.name}</p>
                {g.done ? <Pill tone="ok">Terminado</Pill> : null}
              </div>
              <TourTable t={t} rows={g.table} players={players} qualify={k} />
              {Array.from({ length: g.rounds }, (_, r) => (
                <div key={r} className="mt-3">
                  <p className="tiny muted font-bold uppercase tracking-wide">Fecha {r + 1}</p>
                  {g.fixtures
                    .filter((f) => f.round === r)
                    .map((f) => (
                      <FixtureRow key={f.key} t={t} st={st} f={f} players={players} onOpen={() => setOpen(f.key)} />
                    ))}
                </div>
              ))}
            </Card>
          ))}
        </div>
      ) : null}

      {st.league ? (
        <div className="grid lg:grid-cols-[minmax(0,460px)_1fr] gap-4 items-start">
          <Card>
            <p className="tour-title text-2xl mb-2">Tabla</p>
            <TourTable t={t} rows={st.league.table} players={players} />
          </Card>
          <Card>
            {Array.from({ length: st.league.rounds }, (_, r) => (
              <div key={r} className={r ? 'mt-3' : ''}>
                <p className="tiny muted font-bold uppercase tracking-wide">Fecha {r + 1}</p>
                {st
                  .league!.fixtures.filter((f) => f.round === r)
                  .map((f) => (
                    <FixtureRow key={f.key} t={t} st={st} f={f} players={players} onOpen={() => setOpen(f.key)} />
                  ))}
              </div>
            ))}
          </Card>
        </div>
      ) : null}

      {st.knockout && st.knockout.length ? (
        <Section title="Cuadro">
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
            {st.knockout.map((r, i) => (
              <Card key={i}>
                <p className="tour-title text-xl">{roundTitle(r.length)}</p>
                <p className="tiny muted mb-1">{formatLabel(r[0].format)}</p>
                {r.map((f) => (
                  <FixtureRow key={f.key} t={t} st={st} f={f} players={players} onOpen={() => setOpen(f.key)} showTitle={r.length > 1} />
                ))}
              </Card>
            ))}
          </div>
        </Section>
      ) : null}

      <Section title="Reglas del torneo">
        <Card>
          <RulesList t={t} />
          {isMember ? (
            <div className="flex gap-2 flex-wrap mt-4">
              <Button variant="line" onClick={() => setEditOpen(true)}>
                <Pencil size={16} /> Cambiar reglas
              </Button>
              <Button variant="line" onClick={() => setPairsOpen(true)}>
                <Pencil size={16} /> Cambiar jugadores
              </Button>
            </div>
          ) : null}
        </Card>
      </Section>

      {isAdmin || t.createdBy === memberId ? (
        <div className="mt-6">
          <Button variant="line" onClick={() => setDeleteOpen(true)}>
            <Trash2 size={16} /> Eliminar torneo
          </Button>
        </div>
      ) : null}

      <ResultModal t={t} st={st} f={current} matches={matches} players={players} onClose={() => setOpen(null)} />
      <EditRules open={editOpen} onClose={() => setEditOpen(false)} t={t} />
      <EditPairs open={pairsOpen} onClose={() => setPairsOpen(false)} t={t} players={players} />
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Eliminar el torneo"
        text="Se borra el torneo con sus cruces. Los partidos que ya se jugaron quedan en el historial y en el ranking."
        danger
        confirmLabel="Eliminar"
        onConfirm={async () => {
          try {
            await db.deleteDoc(P.padelTournament(t.id))
            navigate('/padel/torneos')
          } catch (e) {
            toast.error(errorText(e))
          }
        }}
      />
    </div>
  )
}

function RulesList({ t }: { t: PadelTournament }) {
  const ties = Object.keys(t.formats.ko)
    .map(Number)
    .sort((a, b) => b - a)
  const pasan =
    t.advance === 'all' ? 'Pasan todos al cuadro, según la posición.' : t.advance === 1 ? 'Pasa el 1° de cada grupo.' : `Pasan los ${t.advance} primeros de cada grupo.`
  const cross = t.format === 'groups' && t.advance === 2 && (t.groups?.length ?? 0) % 2 === 0 ? ' El 1° de un grupo juega contra el 2° del otro.' : ''
  return (
    <ul className="grid gap-2 small">
      {t.format !== 'knockout' ? (
        <li>
          <b>{t.format === 'league' ? 'Liga' : 'Grupos'}:</b> {FORMATO_PARTIDO[t.formats.rr].label.toLowerCase()}. Ganado {formatPoints(t.points.win)}, empatado {formatPoints(t.points.draw)}, perdido {formatPoints(t.points.loss)}.
        </li>
      ) : null}
      {t.format === 'groups' ? (
        <li>
          {pasan}
          {cross}
        </li>
      ) : null}
      {ties.map((x) => (
        <li key={x}>
          <b>{roundTitle(x)}:</b> {FORMATO_PARTIDO[t.formats.ko[String(x)]].label.toLowerCase()}.
        </li>
      ))}
      <li>
        <b>40 iguales:</b> {t.deuce === 'oro' ? 'punto de oro, el que gana ese punto se lleva el game.' : 'con ventaja, hay que ganar por dos.'}
      </li>
      {t.format !== 'knockout' ? <li className="muted">Desempate: si son dos, el partido entre ellos; después diferencia de sets, de games y games a favor.</li> : null}
      <li className="muted">Cada partido suma también al ranking general de pádel.</li>
    </ul>
  )
}

/** Un cruce: las parejas, el resultado y, para los de la banda, cargar el resultado o marcar que están en cancha. */
function FixtureRow({ t, st, f, players, onOpen, showTitle }: { t: PadelTournament; st: PadelTState; f: PFixture; players: FmoPlayers; onOpen: () => void; showTitle?: boolean }) {
  const { isMember } = useSession()
  const toggleLive = useLiveToggle(t)
  const [busy, setBusy] = useState(false)
  const r = f.result
  const can = playable(f)
  if (!can && (f.a === '__libre' || f.b === '__libre')) {
    const who = f.a === '__libre' ? f.b : f.a
    if (!who || who === '__libre') return null
    return (
      <div className="py-2 border-t border-line small muted">
        <b className="text-[var(--text)]">{pairNames(t, who, players, f.a === '__libre' ? f.bLabel : f.aLabel)}</b> pasa directo
      </div>
    )
  }
  const line = (id: string | null, label: string | null) => {
    const won = !!r && r.winner === id
    const lost = !!r && r.winner !== null && !won
    return <p className={`truncate ${won ? 'font-extrabold' : lost ? 'muted' : id ? 'font-semibold' : 'italic muted'}`}>{pairNames(t, id, players, label)}</p>
  }
  const score = r ? (
    r.resultOnly ? (
      <span className="tiny muted shrink-0">Sin games</span>
    ) : (
      <span className="flex gap-2 shrink-0 tabular-nums">
        {r.sets.map((s, i) => (
          <span key={i} className="grid text-center leading-tight">
            <span className={s.a > s.b ? 'font-extrabold' : 'muted'}>{s.a}</span>
            <span className={s.b > s.a ? 'font-extrabold' : 'muted'}>{s.b}</span>
          </span>
        ))}
        {r.winner === null ? <span className="tiny muted self-center">Empate</span> : null}
      </span>
    )
  ) : f.live ? (
    <span className="tour-live shrink-0">En cancha</span>
  ) : null

  async function live(on: boolean) {
    setBusy(true)
    await toggleLive(f, on)
    setBusy(false)
  }

  return (
    <div className="py-2.5 border-t border-line">
      {showTitle ? <p className="tiny muted mb-0.5">{fixtureTitle(f, st)}</p> : null}
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0 small">
          {line(f.a, f.aLabel)}
          {line(f.b, f.bLabel)}
        </div>
        {score}
      </div>
      {isMember && can ? (
        r ? (
          <button type="button" className="text-link small" onClick={onOpen}>
            Corregir
          </button>
        ) : (
          <div className="flex gap-2 mt-2 flex-wrap">
            <Button size="sm" variant="lime" onClick={onOpen}>
              Cargar resultado
            </Button>
            <Button size="sm" variant="line" onClick={() => void live(!f.live)} loading={busy}>
              {f.live ? 'Ya no están jugando' : 'Están jugando'}
            </Button>
          </div>
        )
      ) : !can && !r ? (
        <p className="tiny muted mt-1">Se define cuando terminen los partidos de antes.</p>
      ) : null}
    </div>
  )
}

const MATCH_OPTIONS = (Object.keys(FORMATO_PARTIDO) as PadelFormat[]).map((k) => ({ value: k, label: FORMATO_PARTIDO[k].corto }))

/** Cambiar nombre, día, lugar, formato de los partidos por etapa, puntos y punto de oro. */
function EditRules({ open, onClose, t }: { open: boolean; onClose: () => void; t: PadelTournament }) {
  const { db, memberId } = useSession()
  const toast = useToast()
  const [name, setName] = useState(t.name)
  const [date, setDate] = useState(msToLocalParts(t.date).date)
  const [place, setPlace] = useState(t.place ?? '')
  const [rr, setRr] = useState(t.formats.rr)
  const [ko, setKo] = useState(t.formats.ko)
  const [points, setPoints] = useState(t.points)
  const [deuce, setDeuce] = useState(t.deuce)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!open) return
    setName(t.name)
    setDate(msToLocalParts(t.date).date)
    setPlace(t.place ?? '')
    setRr(t.formats.rr)
    setKo(t.formats.ko)
    setPoints(t.points)
    setDeuce(t.deuce)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  const ties = Object.keys(t.formats.ko).length
    ? Object.keys(t.formats.ko)
        .map(Number)
        .sort((a, b) => b - a)
    : koTies(t.pairs.length)

  async function save() {
    if (!memberId || name.trim().length < 2) return
    setBusy(true)
    try {
      await db.updateDoc(P.padelTournament(t.id), {
        name: name.trim(),
        date: date ? localToMs(date, '10:00') : null,
        place: place.trim() || null,
        formats: { rr, ko },
        points,
        deuce,
        updatedBy: memberId,
        updatedAt: Date.now(),
      })
      toast.ok('Reglas guardadas')
      onClose()
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  const num = (v: number, set: (x: number) => void, label: string) => (
    <Field label={label} id={`er-${label}`}>
      <Input id={`er-${label}`} type="number" inputMode="decimal" step="0.5" value={v} onFocus={(e) => e.target.select()} onChange={(e) => set(Number(e.target.value) || 0)} />
    </Field>
  )

  return (
    <Modal open={open} onClose={onClose} title="Cambiar reglas">
      <div className="grid gap-3">
        <Field label="Nombre" id="er-name">
          <Input id="er-name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Día" id="er-date">
            <Input id="er-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Dónde" id="er-place">
            <Input id="er-place" value={place} maxLength={60} onChange={(e) => setPlace(e.target.value)} />
          </Field>
        </div>
        <p className="small font-semibold mt-1">Partidos</p>
        {t.format !== 'knockout' ? (
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="small">{t.format === 'league' ? 'Liga' : 'Grupos'}</span>
            <Segmented ariaLabel="Formato de la liga o los grupos" value={rr} onChange={setRr} options={MATCH_OPTIONS} />
          </div>
        ) : null}
        {t.format !== 'league'
          ? ties.map((x) => (
              <div key={x} className="flex items-center justify-between gap-2 flex-wrap">
                <span className="small">{roundTitle(x)}</span>
                <Segmented ariaLabel={`Formato de ${roundTitle(x)}`} value={ko[String(x)] ?? 's1'} onChange={(v) => setKo((c) => ({ ...c, [String(x)]: v }))} options={MATCH_OPTIONS} />
              </div>
            ))
          : null}
        <p className="tiny muted">Los partidos que ya se jugaron quedan con el formato con el que se jugaron.</p>
        {t.format !== 'knockout' ? (
          <>
            <p className="small font-semibold mt-1">Puntos de la tabla</p>
            <div className="grid grid-cols-3 gap-2">
              {num(points.win, (x) => setPoints((p) => ({ ...p, win: x })), 'Ganado')}
              {num(points.draw, (x) => setPoints((p) => ({ ...p, draw: x })), 'Empatado')}
              {num(points.loss, (x) => setPoints((p) => ({ ...p, loss: x })), 'Perdido')}
            </div>
          </>
        ) : null}
        <p className="small font-semibold mt-1">En 40 iguales</p>
        <Segmented
          ariaLabel="En 40 iguales"
          value={deuce}
          onChange={setDeuce}
          options={[
            { value: 'oro', label: 'Punto de oro' },
            { value: 'ventaja', label: 'Ventaja' },
          ]}
        />
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <Button variant="line" onClick={onClose}>
          Cancelar
        </Button>
        <Button variant="lime" onClick={() => void save()} loading={busy}>
          Guardar
        </Button>
      </div>
    </Modal>
  )
}

/** Cambiar quién juega en cada pareja (por ejemplo, cuando se sabe quiénes son los invitados). */
function EditPairs({ open, onClose, t, players }: { open: boolean; onClose: () => void; t: PadelTournament; players: FmoPlayers }) {
  const { db, memberId } = useSession()
  const toast = useToast()
  const [pairs, setPairs] = useState(t.pairs)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (open) setPairs(t.pairs)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  const used = pairs.flatMap((p) => p.players).filter(Boolean)
  const repeated = new Set(used).size !== used.length
  const incomplete = pairs.some((p) => !p.players[0] || !p.players[1])

  async function save() {
    if (!memberId || repeated || incomplete) return
    setBusy(true)
    try {
      await db.updateDoc(P.padelTournament(t.id), { pairs, updatedBy: memberId, updatedAt: Date.now() })
      toast.ok('Parejas guardadas. Los partidos que vienen ya salen con estos jugadores.')
      onClose()
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Cambiar jugadores">
      <p className="small muted mb-3">Cambia quién juega en cada pareja para los partidos que faltan. Los ya jugados quedan con los que jugaron.</p>
      <div className="grid gap-3">
        {pairs.map((p, i) => (
          <div key={p.id} className="rounded-xl border border-line p-3">
            <p className="small font-bold mb-2">Pareja {i + 1}</p>
            <div className="grid sm:grid-cols-2 gap-2">
              {([0, 1] as const).map((slot) => (
                <PlayerPicker
                  key={slot}
                  label={`Pareja ${i + 1}, jugador ${slot + 1}`}
                  value={p.players[slot]}
                  players={players}
                  exclude={used}
                  onChange={(id) => setPairs((cur) => cur.map((x, j) => (j === i ? { ...x, players: (slot === 0 ? [id, x.players[1]] : [x.players[0], id]) as [string, string] } : x)))}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      {repeated ? <p className="small text-danger mt-3">Hay alguien en dos parejas.</p> : null}
      <div className="flex justify-end gap-2 mt-5">
        <Button variant="line" onClick={onClose}>
          Cancelar
        </Button>
        <Button variant="lime" onClick={() => void save()} loading={busy} disabled={repeated || incomplete}>
          Guardar
        </Button>
      </div>
    </Modal>
  )
}
