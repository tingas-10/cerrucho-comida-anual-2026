// Pádel · Ranking individual y de parejas.
import { useMemo, useState } from 'react'
import { PADEL } from '../../content/padel'
import { formatPoints, yearOf } from '../../domain/fmo'
import { computePadelStats, computePairStats, padelRanking, padelYears, type PadelStats } from '../../domain/padel'
import { Avatar, Card, Empty, Loading, PageHeader, Pill } from '../../ui/components'
import { YearSelect, useFmoPlayers, type FmoPlayers } from '../fmo/fmoShared'
import { PadelTabs, usePadelMatches } from './padelShared'

export function PadelRanking({ pairs = false }: { pairs?: boolean }) {
  const { rows, loading } = usePadelMatches()
  const players = useFmoPlayers()
  const current = yearOf(Date.now())
  const [year, setYear] = useState<number | 'all'>(current)
  const years = useMemo(() => padelYears(rows, current), [rows, current])
  const y = year === 'all' ? undefined : year
  const table = useMemo(() => padelRanking(pairs ? computePairStats(rows, y) : computePadelStats(rows, y)), [rows, y, pairs])
  const p = PADEL.puntos

  if (loading || players.loading) return <Loading />
  return (
    <div>
      <PageHeader
        eyebrow="Pádel"
        title={pairs ? 'Ranking de parejas' : 'Ranking'}
        intro={`${pairs ? 'Cuenta cada pareja junta, sin importar quién jugó de drive o de revés. ' : ''}Ganar a 1 set suma ${p[1]} · al mejor de 3 suma ${p[3]} · al mejor de 5 suma ${p[5]}. Perder suma 0.`}
        actions={<YearSelect value={year} onChange={setYear} years={years} allowAll />}
      />
      <PadelTabs />
      {table.length === 0 ? (
        <Empty title={year === 'all' ? 'Todavía no hay partidos jugados' : `Todavía no hay partidos jugados en ${year}`} text="Guardá un partido y el ranking se arma solo." />
      ) : (
        <Card className="!p-3 sm:!p-5">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="tiny muted text-left">
                  <th className="py-2 pr-2 w-8">#</th>
                  <th className="py-2 pr-2">{pairs ? 'Pareja' : 'Jugador'}</th>
                  <th className="py-2 pr-2 text-right" title="Partidos jugados">PJ</th>
                  <th className="py-2 pr-2 text-right" title="Ganados">G</th>
                  <th className="py-2 pr-2 text-right" title="Perdidos">P</th>
                  <th className="py-2 pr-2 text-right" title="Sets ganados - perdidos">Sets</th>
                  <th className="py-2 text-right" title="Puntos">Pts</th>
                </tr>
              </thead>
              <tbody>
                {table.map((s, i) => (
                  <tr key={s.id} className={`border-t border-line ${i < 3 ? 'font-semibold' : ''}`}>
                    <td className="py-2 pr-2">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</td>
                    <td className="py-2 pr-2 max-w-[150px] sm:max-w-none">
                      <WhoCell s={s} players={players} />
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums">{s.played}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{s.won}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{s.lost}</td>
                    <td className="py-2 pr-2 text-right tabular-nums whitespace-nowrap">
                      {s.setsWon}-{s.setsLost}
                    </td>
                    <td className="py-2 text-right tabular-nums text-accent font-extrabold">{formatPoints(s.points)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}

function WhoCell({ s, players }: { s: PadelStats; players: FmoPlayers }) {
  return (
    <span className="flex items-center gap-2 min-w-0">
      <span className="hidden sm:inline-flex -space-x-2">
        {s.players.map((id) => (
          <Avatar key={id} id={id} alias={players.nameOf(id)} size={24} color={players.byId[id]?.color} photo={players.byId[id]?.photo} />
        ))}
      </span>
      <span className="truncate">{s.players.map(players.nameOf).join(' / ')}</span>
      {s.players.some((id) => players.byId[id]?.guest) ? <Pill tone="muted">Inv.</Pill> : null}
    </span>
  )
}
