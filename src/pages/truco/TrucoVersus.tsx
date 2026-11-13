// Truco · 1 vs 1: cómo les fue a dos jugadores (enfrentados y juntos) y una simulación de un mano a mano.
// La chance sale de un nivel tipo ajedrez (Elo) calculado con todos los partidos: ganarle a uno que viene
// bien vale más. La simulación juega mano por mano (envido, truco, retruco…) y se ve con los fósforos.
import { Dices, FastForward } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSession } from '../../data/DataContext'
import { formatPoints, yearOf } from '../../domain/fmo'
import { computeTrucoStats, emptyTrucoStats, handProbability, rng, simulateMany, simulateMatch, trucoHeadToHead, trucoRatings, trucoYears, winProbability, type SimMatch } from '../../domain/truco'
import { Avatar, Button, Card, Loading, PageHeader, Section, Segmented } from '../../ui/components'
import { YearSelect, useFmoPlayers } from '../fmo/fmoShared'
import { Fosforos, TrucoTabs, useTrucoMatches } from './trucoShared'

export function TrucoVersus() {
  const { memberId } = useSession()
  const { rows, loading } = useTrucoMatches()
  const players = useFmoPlayers()
  const current = yearOf(Date.now())
  const [year, setYear] = useState<number | 'all'>('all')
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  useEffect(() => {
    if (!a && players.list.length) setA(memberId ?? players.list[0].id)
  }, [a, memberId, players.list])
  useEffect(() => {
    if (!b && a && players.list.length) setB(players.list.find((p) => p.id !== a)?.id ?? '')
  }, [b, a, players.list])

  const years = useMemo(() => trucoYears(rows, current), [rows, current])
  const y = year === 'all' ? undefined : year
  const all = useMemo(() => computeTrucoStats(rows, y), [rows, y])
  const sa = all[a] ?? emptyTrucoStats(a)
  const sb = all[b] ?? emptyTrucoStats(b)
  const h = useMemo(() => trucoHeadToHead(rows, a, b, y), [rows, a, b, y])

  if (loading || players.loading) return <Loading />
  const lines: Array<[string, number | string, number | string, number, number]> = [
    ['Puntos', formatPoints(sa.points), formatPoints(sb.points), sa.points, sb.points],
    ['Jugados', sa.played, sb.played, sa.played, sb.played],
    ['Ganados', sa.won, sb.won, sa.won, sb.won],
    ['Perdidos', sa.lost, sb.lost, -sa.lost, -sb.lost],
  ]
  const select = (value: string, onChange: (v: string) => void, label: string) => (
    <select className="input" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
      {players.list.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
          {p.guest ? ' (invitado)' : ''}
        </option>
      ))}
    </select>
  )
  const na = players.nameOf(a)
  const nb = players.nameOf(b)

  return (
    <div>
      <PageHeader eyebrow="Truco" title="1 vs 1" intro="Elegí dos: cómo les fue y una simulación de un mano a mano." actions={<YearSelect value={year} onChange={setYear} years={years} allowAll />} />
      <TrucoTabs />
      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center mb-4">
        {select(a, setA, 'Jugador 1')}
        <span className="font-extrabold muted">vs</span>
        {select(b, setB, 'Jugador 2')}
      </div>
      {a === b ? (
        <p className="small muted">Elegí dos jugadores distintos.</p>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4 items-start">
          <div className="grid gap-4">
            <Card>
              <p className="h3 mb-2">Frente a frente</p>
              {h.against.played === 0 ? (
                <p className="small muted">Todavía no jugaron uno contra el otro.</p>
              ) : (
                <>
                  <p className="small muted mb-2">
                    {h.against.played} {h.against.played === 1 ? 'partido' : 'partidos'} enfrentados (en cualquier formato)
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="rounded-xl bg-soft/50 p-3">
                      <p className="text-3xl font-extrabold tabular-nums">{h.against.aWins}</p>
                      <p className="tiny muted truncate">ganó {na}</p>
                    </div>
                    <div className="rounded-xl bg-soft/50 p-3">
                      <p className="text-3xl font-extrabold tabular-nums">{h.against.bWins}</p>
                      <p className="tiny muted truncate">ganó {nb}</p>
                    </div>
                  </div>
                </>
              )}
              {h.together.played ? (
                <p className="small mt-3">
                  Juntos en el mismo equipo: <b>{h.together.played}</b> {h.together.played === 1 ? 'partido' : 'partidos'}, ganaron {h.together.won} y perdieron {h.together.lost}.
                </p>
              ) : null}
            </Card>
            <Card>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 mb-2">
                <span className="flex items-center gap-2 min-w-0 justify-end">
                  <span className="font-bold truncate">{na}</span>
                  <Avatar id={a} alias={na} size={28} color={players.byId[a]?.color} photo={players.byId[a]?.photo} />
                </span>
                <span />
                <span className="flex items-center gap-2 min-w-0">
                  <Avatar id={b} alias={nb} size={28} color={players.byId[b]?.color} photo={players.byId[b]?.photo} />
                  <span className="font-bold truncate">{nb}</span>
                </span>
              </div>
              {lines.map(([label, va, vb, ka, kb]) => (
                <div key={label} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-1.5 border-t border-line">
                  <span className={`text-right tabular-nums ${ka > kb ? 'font-extrabold text-accent' : ''}`}>{va}</span>
                  <span className="tiny muted text-center w-20">{label}</span>
                  <span className={`tabular-nums ${kb > ka ? 'font-extrabold text-accent' : ''}`}>{vb}</span>
                </div>
              ))}
            </Card>
          </div>
          <Simulacion a={a} b={b} nameA={na} nameB={nb} />
        </div>
      )}
    </div>
  )
}

function Simulacion({ a, b, nameA, nameB }: { a: string; b: string; nameA: string; nameB: string }) {
  const { rows } = useTrucoMatches()
  const [target, setTarget] = useState<'30' | '15'>('30')
  const [sim, setSim] = useState<SimMatch | null>(null)
  const [step, setStep] = useState(0)
  const timer = useRef<number | null>(null)
  const ratings = useMemo(() => trucoRatings(rows), [rows])
  const tgt = Number(target)
  const ra = ratings[a] ?? 1000
  const rb = ratings[b] ?? 1000
  const p = winProbability(ra, rb)
  const q = useMemo(() => handProbability(p, tgt), [p, tgt])
  const many = useMemo(() => simulateMany(tgt, q, 1000, 2026), [q, tgt])
  const noData = ratings[a] === undefined && ratings[b] === undefined
  const pa = Math.round(p * 100)

  // Al cambiar de jugadores, se borra la simulación anterior.
  useEffect(() => {
    setSim(null)
    setStep(0)
  }, [a, b, target])
  useEffect(() => {
    if (!sim || step >= sim.hands.length) return
    timer.current = window.setTimeout(() => setStep((s) => s + 1), 900)
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [sim, step])

  function run() {
    setSim(simulateMatch(tgt, q, rng(Math.floor(Math.random() * 1e9)), nameA, nameB))
    setStep(1)
  }

  const shown = sim ? sim.hands.slice(0, step) : []
  const cur = shown[shown.length - 1]
  const scoreA = cur?.totalA ?? 0
  const scoreB = cur?.totalB ?? 0
  const finished = !!sim && step >= sim.hands.length

  return (
    <Section title="Simulación" className="mt-0">
      <Card>
        <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
          <p className="small">Si juegan un mano a mano:</p>
          <Segmented
            ariaLabel="A cuántos"
            value={target}
            onChange={setTarget}
            options={[
              { value: '30', label: 'A 30' },
              { value: '15', label: 'A 15' },
            ]}
          />
        </div>
        <div className="flex justify-between small font-bold mb-1">
          <span className="truncate">
            {nameA} {pa}%
          </span>
          <span className="truncate">
            {100 - pa}% {nameB}
          </span>
        </div>
        <div className="h-3 rounded-full bg-[var(--border)] overflow-hidden flex" aria-hidden>
          <span className="h-full bg-[var(--gold)]" style={{ width: `${pa}%` }} />
        </div>
        <p className="tiny muted mt-2">
          {noData
            ? 'Todavía no jugaron partidos guardados: la simulación es pareja.'
            : `Sale de todos los partidos guardados: ganarle a uno que viene bien vale más. En 1.000 partidos simulados, ${nameA} ganó ${many} y ${nameB} ${1000 - many}.`}
        </p>

        <Button variant="gold" className="w-full mt-4" onClick={run}>
          <Dices size={16} /> {sim ? 'Simular otro partido' : 'Simular un partido'}
        </Button>

        {sim ? (
          <div className="mt-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { n: nameA, s: scoreA, w: finished && sim.winner === 'A' },
                { n: nameB, s: scoreB, w: finished && sim.winner === 'B' },
              ].map((x, i) => (
                <div key={i} className={`rounded-xl border border-line p-3 flex flex-col items-center text-center ${x.w ? 'ring-2 ring-[var(--gold)]' : ''}`}>
                  <p className="font-bold truncate max-w-full">{x.n}</p>
                  <p className="text-4xl font-extrabold tabular-nums leading-none my-2">{x.s}</p>
                  <Fosforos score={x.s} target={tgt} size={36} />
                </div>
              ))}
            </div>
            {finished ? (
              <p className="h3 text-center mt-3">¡Ganó {sim.winner === 'A' ? nameA : nameB}! 🏆</p>
            ) : (
              <Button variant="line" size="sm" className="mt-3" onClick={() => setStep(sim.hands.length)}>
                <FastForward size={14} /> Ver el final
              </Button>
            )}
            <div className="mt-3 max-h-72 overflow-y-auto overscroll-contain">
              {[...shown].reverse().map((hand) => (
                <div key={hand.n} className="py-2 border-t border-line small">
                  <p className="font-semibold">
                    Mano {hand.n} <span className="tiny muted">· va {hand.totalA} a {hand.totalB}</span>
                  </p>
                  {hand.lines.map((l, i) => (
                    <p key={i} className="tiny muted">
                      {l}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </Card>
    </Section>
  )
}
