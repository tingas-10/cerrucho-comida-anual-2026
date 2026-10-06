// Pádel · 1 vs 1: comparar dos jugadores.
import { useEffect, useMemo, useState } from 'react'
import { useSession } from '../../data/DataContext'
import { formatPoints, yearOf } from '../../domain/fmo'
import { computePadelStats, emptyPadelStats, padelHeadToHead, padelYears } from '../../domain/padel'
import { Avatar, Card, Loading, Notice, PageHeader, Section } from '../../ui/components'
import { YearSelect, useFmoPlayers } from '../fmo/fmoShared'
import { PadelTabs, usePadelMatches } from './padelShared'

export function PadelVersus() {
  const { memberId } = useSession()
  const { rows, loading } = usePadelMatches()
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

  const years = useMemo(() => padelYears(rows, current), [rows, current])
  const y = year === 'all' ? undefined : year
  const all = useMemo(() => computePadelStats(rows, y), [rows, y])
  const sa = all[a] ?? emptyPadelStats(a)
  const sb = all[b] ?? emptyPadelStats(b)
  const h = useMemo(() => padelHeadToHead(rows, a, b, y), [rows, a, b, y])

  if (loading || players.loading) return <Loading />
  const lines: Array<[string, number | string, number | string, number, number]> = [
    ['Puntos', formatPoints(sa.points), formatPoints(sb.points), sa.points, sb.points],
    ['Jugados', sa.played, sb.played, sa.played, sb.played],
    ['Ganados', sa.won, sb.won, sa.won, sb.won],
    ['Perdidos', sa.lost, sb.lost, -sa.lost, -sb.lost],
    ['Sets ganados', sa.setsWon, sb.setsWon, sa.setsWon, sb.setsWon],
    ['Games ganados', sa.gamesWon, sb.gamesWon, sa.gamesWon, sb.gamesWon],
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

  return (
    <div>
      <PageHeader eyebrow="Pádel" title="1 vs 1" intro="Elegí dos y compará." actions={<YearSelect value={year} onChange={setYear} years={years} allowAll />} />
      <PadelTabs />
      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center mb-4">
        {select(a, setA, 'Jugador 1')}
        <span className="font-extrabold muted">vs</span>
        {select(b, setB, 'Jugador 2')}
      </div>
      {a === b ? <Notice tone="warn">Elegí dos jugadores distintos.</Notice> : null}

      <Card>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 pb-3 border-b border-line">
          <span className="flex items-center gap-2 font-bold justify-end text-right">
            {players.nameOf(a)} <Avatar id={a} alias={players.nameOf(a)} color={players.byId[a]?.color} photo={players.byId[a]?.photo} />
          </span>
          <span className="tiny muted">vs</span>
          <span className="flex items-center gap-2 font-bold">
            <Avatar id={b} alias={players.nameOf(b)} color={players.byId[b]?.color} photo={players.byId[b]?.photo} /> {players.nameOf(b)}
          </span>
        </div>
        {lines.map(([label, va, vb, na, nb]) => (
          <div key={label} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-2 border-b border-line last:border-0">
            <span className={`text-right tabular-nums text-lg ${na > nb ? 'font-extrabold text-accent' : ''}`}>{va}</span>
            <span className="tiny muted w-24 text-center">{label}</span>
            <span className={`tabular-nums text-lg ${nb > na ? 'font-extrabold text-accent' : ''}`}>{vb}</span>
          </div>
        ))}
      </Card>

      <Section title="Cuando se cruzaron">
        <div className="grid sm:grid-cols-2 gap-3">
          <Card>
            <p className="h3 mb-2">En contra</p>
            {h.against.played === 0 ? (
              <p className="small muted">Nunca jugaron en parejas distintas.</p>
            ) : (
              <>
                <p className="small muted mb-2">{h.against.played} partidos enfrentados</p>
                <div className="row">
                  <span>Ganó {players.nameOf(a)}</span>
                  <b>{h.against.aWins}</b>
                </div>
                <div className="row">
                  <span>Ganó {players.nameOf(b)}</span>
                  <b>{h.against.bWins}</b>
                </div>
                <div className="row">
                  <span>Sets en esos partidos</span>
                  <b>
                    {h.against.aSets} – {h.against.bSets}
                  </b>
                </div>
              </>
            )}
          </Card>
          <Card>
            <p className="h3 mb-2">Juntos</p>
            {h.together.played === 0 ? (
              <p className="small muted">Nunca jugaron en la misma pareja.</p>
            ) : (
              <>
                <p className="small muted mb-2">{h.together.played} partidos en la misma pareja</p>
                <div className="row">
                  <span>Ganados</span>
                  <b>{h.together.won}</b>
                </div>
                <div className="row">
                  <span>Perdidos</span>
                  <b>{h.together.lost}</b>
                </div>
              </>
            )}
          </Card>
        </div>
      </Section>
    </div>
  )
}
