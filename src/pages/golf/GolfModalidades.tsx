// Golf · Modalidades (pedido de Pato): 1 vs 1, Four ball y Laguneada por equipos.
// Cada una con su ranking, sus últimos partidos y, en 1 vs 1 y four ball, partidos por desafíos.
import { Swords } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { GOLF_MODOS } from '../../content/golf'
import { useSession } from '../../data/DataContext'
import { errorText } from '../../data/actions'
import { answerChallenge, cancelChallenge, createChallenge } from '../../data/golf'
import type { GolfChallenge } from '../../data/types'
import { yearOf } from '../../domain/fmo'
import { fmtDayLong, fmtTime, localToMs } from '../../domain/format'
import { meritTable, roundResult } from '../../domain/golf'
import { Button, Card, Field, Input, Loading, Modal, PageHeader, Pill, Section, Segmented } from '../../ui/components'
import { useToast } from '../../ui/toast'
import { useFmoPlayers, type FmoPlayers } from '../fmo/fmoShared'
import { VersusPanel } from './GolfVersus'
import { GolfTabs, courseGroups, entrantName, useGolfChallenges, useGolfConfig, useGolfCourses, useGolfHcps, useGolfRounds } from './golfShared'

type Tab = 'match' | 'fourball' | 'scramble'

export function GolfModalidades() {
  const [params, setParams] = useSearchParams()
  const tab = (['match', 'fourball', 'scramble'].includes(params.get('m') ?? '') ? params.get('m') : 'match') as Tab
  const { rows: rounds, loading } = useGolfRounds()
  const cfg = useGolfConfig()
  const players = useFmoPlayers()
  const year = yearOf(Date.now())
  const table = useMemo(() => meritTable(rounds, cfg.points, year, tab).slice(0, 10), [rounds, cfg.points, year, tab])
  const recent = useMemo(() => rounds.filter((r) => r.status === 'PLAYED' && !r.voided && r.mode === tab).sort((a, b) => b.playedAt - a.playedAt).slice(0, 5), [rounds, tab])

  if (loading || cfg.loading || players.loading) return <Loading />
  return (
    <div>
      <PageHeader eyebrow="Golf" title="Modalidades" intro="Cada modalidad tiene su propio ranking del año y además suma al ranking general." />
      <GolfTabs />
      <div className="mb-4 overflow-x-auto">
        <Segmented
          ariaLabel="Modalidad"
          value={tab}
          onChange={(v) => setParams({ m: v }, { replace: true })}
          options={[
            { value: 'match', label: '1 vs 1' },
            { value: 'fourball', label: 'Four ball' },
            { value: 'scramble', label: 'Laguneada' },
          ]}
        />
      </div>
      <p className="italic small muted mb-4 text-center sm:text-left">{GOLF_MODOS[tab].desc}</p>

      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <Card>
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="h3">Ranking {GOLF_MODOS[tab].corto} {year}</p>
            <Link to={`/golf/ranking?m=${tab}`} className="text-link">
              Ver completo
            </Link>
          </div>
          {table.length === 0 ? <p className="small muted">Todavía no hay partidos de esta modalidad este año.</p> : null}
          {table.map((r, i) => (
            <div key={r.playerId} className="flex justify-between gap-3 py-1.5 border-b border-line last:border-0">
              <span className={`truncate ${i < 3 ? 'font-semibold' : ''}`}>
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}º`} {players.nameOf(r.playerId)}
              </span>
              <span className="tabular-nums shrink-0 small">
                <b className="text-accent">{r.points}</b> pts · {r.rounds} PJ · {r.wins} G
              </span>
            </div>
          ))}
        </Card>
        <Card>
          <p className="h3 mb-2">Últimos partidos</p>
          {recent.length === 0 ? <p className="small muted">Todavía no se jugó ninguno.</p> : null}
          {recent.map((r) => {
            const res = roundResult(r)
            const w = res.standings[0]
            return (
              <Link key={r.id} to={`/golf/partido/${r.id}`} className="row">
                <span className="small min-w-0">
                  <span className="tiny muted block">
                    {fmtDayLong(r.playedAt)} · {r.course.name}
                  </span>
                  <span className="block truncate">{r.entrants.map((e) => entrantName(e, players)).join(' vs ')}</span>
                </span>
                {w ? <span className="small shrink-0">🏆 {entrantName(r.entrants.find((e) => e.id === w.entrantId)!, players)}</span> : null}
              </Link>
            )
          })}
        </Card>
      </div>

      {tab !== 'scramble' ? <Challenges mode={tab} players={players} /> : null}

      {tab === 'match' ? (
        <Section title="Cara a cara">
          <VersusPanel />
        </Section>
      ) : null}
    </div>
  )
}

const STATUS: Record<GolfChallenge['status'], { label: string; tone: 'ok' | 'warn' | 'danger' | 'muted' }> = {
  PENDING: { label: 'Esperando respuesta', tone: 'warn' },
  ACCEPTED: { label: 'Aceptado', tone: 'ok' },
  DECLINED: { label: 'Rechazado', tone: 'danger' },
  CANCELLED: { label: 'Cancelado', tone: 'muted' },
}

function Challenges({ mode, players }: { mode: 'match' | 'fourball'; players: FmoPlayers }) {
  const { db, memberId, isMember } = useSession()
  const toast = useToast()
  const navigate = useNavigate()
  const { rows } = useGolfChallenges()
  const courses = useGolfCourses()
  const hcps = useGolfHcps()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const list = rows.filter((c) => c.mode === mode).sort((a, b) => (a.status === 'PENDING' ? -1 : 0) - (b.status === 'PENDING' ? -1 : 0) || b.createdAt - a.createdAt)
  const pending = list.filter((c) => c.status === 'PENDING')
  const closed = list.filter((c) => c.status !== 'PENDING').slice(0, 6)
  const side = (ids: string[]) => ids.map(players.nameOf).join(' / ')

  async function answer(c: GolfChallenge, accept: boolean) {
    if (!memberId) return
    setBusy(c.id)
    try {
      const course = courses.active.find((x) => x.id === c.courseId) ?? null
      const roundId = await answerChallenge(db, c, memberId, accept, course, hcps.hcpOf)
      if (roundId) {
        toast.ok('¡Desafío aceptado! Quedó armado el partido.')
        navigate(`/golf/partido/${roundId}`)
      } else toast.ok('Desafío rechazado.')
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Section
      title="Desafíos"
      aside={
        isMember ? (
          <Button size="sm" variant="gold" onClick={() => setOpen(true)}>
            <Swords size={14} /> Desafiar
          </Button>
        ) : null
      }
    >
      <p className="tiny muted mb-2">Desafiá a alguien{mode === 'fourball' ? ' (con tu pareja, a otra pareja)' : ''}. Si acepta, queda armado el partido por jugarse y el resultado suma al ranking de {GOLF_MODOS[mode].corto}.</p>
      <div className="grid gap-2">
        {pending.length === 0 && closed.length === 0 ? <Card><p className="small muted">Todavía no hay desafíos.</p></Card> : null}
        {[...pending, ...closed].map((c) => {
          const iAmChallenged = !!memberId && c.challenged.includes(memberId)
          const iAmChallenger = !!memberId && c.challengers.includes(memberId)
          return (
            <Card key={c.id} className="!py-3">
              <div className="flex items-start justify-between gap-2">
                <p className="font-bold min-w-0">
                  {side(c.challengers)} <span className="muted font-normal">desafía a</span> {side(c.challenged)}
                </p>
                <Pill tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Pill>
              </div>
              <p className="tiny muted mt-1">
                {c.playAt ? `${fmtDayLong(c.playAt)} · ${fmtTime(c.playAt)} h` : 'Fecha a definir'}
                {c.courseId ? ` · ${courses.rows.find((x) => x.id === c.courseId)?.name ?? ''}` : ''}
              </p>
              {c.message ? <p className="small mt-1">“{c.message}”</p> : null}
              <div className="flex gap-2 flex-wrap mt-2">
                {c.status === 'PENDING' && iAmChallenged ? (
                  <>
                    <Button size="sm" variant="gold" loading={busy === c.id} onClick={() => void answer(c, true)}>
                      Aceptar
                    </Button>
                    <Button size="sm" variant="line" loading={busy === c.id} onClick={() => void answer(c, false)}>
                      Rechazar
                    </Button>
                  </>
                ) : null}
                {c.status === 'PENDING' && iAmChallenger ? (
                  <Button size="sm" variant="line" onClick={() => void cancelChallenge(db, c, memberId!).catch((e) => toast.error(errorText(e)))}>
                    Cancelar desafío
                  </Button>
                ) : null}
                {c.roundId ? (
                  <Link to={`/golf/partido/${c.roundId}`} className="btn btn-sm">
                    Ver el partido
                  </Link>
                ) : null}
              </div>
            </Card>
          )
        })}
      </div>
      {open ? <ChallengeForm mode={mode} players={players} onClose={() => setOpen(false)} /> : null}
    </Section>
  )
}

function ChallengeForm({ mode, players, onClose }: { mode: 'match' | 'fourball'; players: FmoPlayers; onClose: () => void }) {
  const { db, memberId } = useSession()
  const toast = useToast()
  const courses = useGolfCourses()
  const [partner, setPartner] = useState('')
  const [rival1, setRival1] = useState('')
  const [rival2, setRival2] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('09:00')
  const [courseId, setCourseId] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const members = players.list.filter((p) => !p.guest && p.id !== memberId)
  const everyone = players.list.filter((p) => p.id !== memberId)
  const picked = [partner, rival1, rival2].filter(Boolean)
  const valid = mode === 'match' ? !!rival1 : !!partner && !!rival1 && !!rival2 && new Set(picked).size === 3

  async function send() {
    if (!memberId || !valid) return
    setBusy(true)
    try {
      await createChallenge(db, memberId, {
        mode,
        challengers: mode === 'match' ? [memberId] : [memberId, partner],
        challenged: mode === 'match' ? [rival1] : [rival1, rival2],
        playAt: date ? localToMs(date, time) : null,
        courseId: courseId || null,
        message: message.trim().slice(0, 140),
      })
      toast.ok('Desafío enviado. Avisale por WhatsApp que lo acepte en la web.')
      onClose()
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  const sel = (value: string, onChange: (v: string) => void, list: FmoPlayers['list'], label: string, id: string) => (
    <Field label={label} id={id}>
      <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Elegí…</option>
        {list.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
            {p.guest ? ' (invitado)' : ''}
          </option>
        ))}
      </select>
    </Field>
  )

  return (
    <Modal open onClose={onClose} title={`Desafío de ${GOLF_MODOS[mode].corto}`}>
      {mode === 'fourball' ? sel(partner, setPartner, everyone, 'Tu pareja', 'ch-partner') : null}
      {sel(rival1, setRival1, members, mode === 'match' ? 'A quién desafiás' : 'Rival 1 (de la banda, es quien acepta)', 'ch-r1')}
      {mode === 'fourball' ? sel(rival2, setRival2, everyone, 'Rival 2', 'ch-r2') : null}
      <div className="grid grid-cols-2 gap-2">
        <Field label="Día (opcional)" id="ch-date">
          <Input id="ch-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Hora" id="ch-time">
          <Input id="ch-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
      </div>
      <Field label="Cancha (opcional)" id="ch-course">
        <select id="ch-course" className="input" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
          <option value="">A definir</option>
          {courseGroups(courses.active).map((g) => (
            <optgroup key={g.club} label={g.club}>
              {g.items.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name.split(' · ')[1] ?? c.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </Field>
      <Field label="Mensaje (opcional)" id="ch-msg">
        <Input id="ch-msg" value={message} maxLength={140} onChange={(e) => setMessage(e.target.value)} placeholder="ej. Preparate para perder" />
      </Field>
      <Button variant="gold" className="w-full" onClick={() => void send()} disabled={!valid} loading={busy}>
        Enviar desafío
      </Button>
    </Modal>
  )
}

