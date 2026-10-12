// Golf · Cara a cara: comparar dos jugadores (va dentro de Modalidades → 1 vs 1).
import { useEffect, useMemo, useState } from 'react'
import { useSession } from '../../data/DataContext'
import { yearOf } from '../../domain/fmo'
import { golfPlayerStats, golfVersus, golfYears } from '../../domain/golf'
import { Avatar, Card, Loading, Notice, Section } from '../../ui/components'
import { YearSelect, useFmoPlayers } from '../fmo/fmoShared'
import { formatHcp, useGolfHcps, useGolfRounds } from './golfShared'

export function VersusPanel() {
  const { memberId } = useSession()
  const { rows, loading } = useGolfRounds()
  const hcps = useGolfHcps()
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

  const years = useMemo(() => golfYears(rows, current), [rows, current])
  const y = year === 'all' ? undefined : year
  const sa = useMemo(() => golfPlayerStats(rows, a, y), [rows, a, y])
  const sb = useMemo(() => golfPlayerStats(rows, b, y), [rows, b, y])
  const v = useMemo(() => golfVersus(rows, a, b, y), [rows, a, b, y])

  if (loading || players.loading || hcps.loading) return <Loading />
  // [etiqueta, valor A, valor B, comparable A, comparable B] (más alto = mejor; los golpes van en negativo)
  const lines: Array<[string, string | number, string | number, number, number]> = [
    ['Hándicap', formatHcp(hcps.hcpOf(a)), formatHcp(hcps.hcpOf(b)), -(hcps.hcpOf(a) ?? 99), -(hcps.hcpOf(b) ?? 99)],
    ['Partidos', sa.rounds, sb.rounds, sa.rounds, sb.rounds],
    ['Primeros', sa.wins, sb.wins, sa.wins, sb.wins],
    ['Podios', sa.podiums, sb.podiums, sa.podiums, sb.podiums],
    ['Mejor 18', sa.best18 ?? '—', sb.best18 ?? '—', -(sa.best18 ?? 999), -(sb.best18 ?? 999)],
    ['Promedio 18', sa.avg18 ?? '—', sb.avg18 ?? '—', -(sa.avg18 ?? 999), -(sb.avg18 ?? 999)],
    ['Birdies', sa.birdies, sb.birdies, sa.birdies, sb.birdies],
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
      <div className="flex justify-end mb-2">
        <YearSelect value={year} onChange={setYear} years={years} allowAll />
      </div>
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
            <span className={`text-right tabular-nums text-lg ${na > nb ? 'font-extrabold text-accent' : ''}`}>{String(va).replace('.', ',')}</span>
            <span className="tiny muted w-24 text-center">{label}</span>
            <span className={`tabular-nums text-lg ${nb > na ? 'font-extrabold text-accent' : ''}`}>{String(vb).replace('.', ',')}</span>
          </div>
        ))}
      </Card>
      <Section title="Cuando jugaron juntos">
        <div className="grid sm:grid-cols-2 gap-3">
          <Card>
            <p className="h3 mb-2">Uno contra otro</p>
            {v.together - v.partners === 0 ? (
              <p className="small muted">Nunca jugaron un mismo partido en contra.</p>
            ) : (
              <>
                <div className="row">
                  <span>Terminó más arriba {players.nameOf(a)}</span>
                  <b>{v.aAhead}</b>
                </div>
                <div className="row">
                  <span>Terminó más arriba {players.nameOf(b)}</span>
                  <b>{v.bAhead}</b>
                </div>
                <div className="row">
                  <span>Empatados</span>
                  <b>{v.even}</b>
                </div>
                {v.matchA + v.matchB + v.matchHalved ? (
                  <div className="row">
                    <span>Match play entre ellos</span>
                    <b>
                      {v.matchA} – {v.matchB}
                      {v.matchHalved ? ` (${v.matchHalved} empates)` : ''}
                    </b>
                  </div>
                ) : null}
              </>
            )}
          </Card>
          <Card>
            <p className="h3 mb-2">Como compañeros</p>
            {v.partners === 0 ? (
              <p className="small muted">Nunca jugaron en la misma pareja o equipo.</p>
            ) : (
              <>
                <div className="row">
                  <span>Partidos juntos</span>
                  <b>{v.partners}</b>
                </div>
                <div className="row">
                  <span>Ganadas</span>
                  <b>{v.partnersWon}</b>
                </div>
              </>
            )}
          </Card>
        </div>
      </Section>
    </div>
  )
}
