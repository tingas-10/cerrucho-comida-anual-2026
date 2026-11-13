// Truco · Un torneo: tabla y fechas (liga), grupos con su tabla, y la llave de eliminación directa.
// Todo se calcula de los partidos anotados: si se corrige un resultado, la tabla y la llave se acomodan solas.
import { Trash2, Trophy } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { aCuantoLabel, formatoTruco } from '../../content/truco'
import { useSession } from '../../data/DataContext'
import { errorText } from '../../data/actions'
import { useDoc } from '../../data/hooks'
import { P } from '../../data/paths'
import type { TrucoTournament } from '../../data/types'
import { BYE, playable, roundName, tournamentState, type Fixture, type TableRow } from '../../domain/truco'
import { Button, Card, ConfirmDialog, Loading, Notice, Pill, Section } from '../../ui/components'
import { useToast } from '../../ui/toast'
import { useFmoPlayers } from '../fmo/fmoShared'
import { newTrucoMatch } from './TrucoPartidos'
import { FORMATO_TORNEO, entrantName } from './TrucoTorneos'
import { useTrucoMatches } from './trucoShared'

export function TrucoTorneo() {
  const { id } = useParams()
  const { db, isAdmin, memberId } = useSession()
  const toast = useToast()
  const navigate = useNavigate()
  const t = useDoc<TrucoTournament>(id ? P.trucoTournament(id) : null)
  const { rows: matches, loading } = useTrucoMatches()
  const players = useFmoPlayers()
  const [deleteOpen, setDeleteOpen] = useState(false)

  if (t.loading || loading || players.loading) return <Loading />
  if (!t.data) return <Notice tone="warn">Ese torneo no existe (capaz lo borraron). <Link className="underline" to="/truco/torneos">Volver a Torneos</Link></Notice>
  const tour = t.data
  const st = tournamentState(tour, matches)
  const name = (eid: string | null) => entrantName(tour, eid, players)
  const k = tour.advance === 'all' ? Infinity : (tour.advance ?? 0)

  return (
    <div>
      <Link to="/truco/torneos" className="back-link">
        ← Torneos
      </Link>
      <h1 className="h1 mt-1">{tour.name}</h1>
      <p className="small muted mb-4">
        {FORMATO_TORNEO[tour.format].label} · {formatoTruco(tour.size)} · {aCuantoLabel(tour.target)} · {st.played} de {st.total || '—'} partidos jugados
      </p>

      {st.champion ? (
        <Card className="mb-4 text-center bg-ok-soft/40">
          <p className="eyebrow">Campeón</p>
          <p className="h1 mt-1 flex items-center justify-center gap-2">
            <Trophy className="text-accent" /> {name(st.champion)}
          </p>
        </Card>
      ) : null}

      {st.league ? (
        <div className="grid lg:grid-cols-[minmax(0,420px)_1fr] gap-4 items-start">
          <Card>
            <p className="h3 mb-2">Tabla</p>
            <Table rows={st.league.table} name={name} />
          </Card>
          <div className="grid gap-3">
            {st.league.rounds.map((r, i) => (
              <Card key={i}>
                <p className="small font-bold mb-1">Fecha {i + 1}</p>
                {r.map((f) => (
                  <FixtureRow key={f.key} f={f} t={tour} name={name} />
                ))}
              </Card>
            ))}
          </div>
        </div>
      ) : null}

      {st.groups ? (
        <>
          <p className="small mb-3">
            Pasan {tour.advance === 'all' ? 'todos, en orden de posiciones' : tour.advance === 1 ? 'el mejor de cada grupo' : `los ${tour.advance} mejores de cada grupo`} a la eliminación directa.
          </p>
          <div className="grid md:grid-cols-2 gap-4 items-start">
            {st.groups.map((g) => (
              <Card key={g.name}>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="h3">{g.name}</p>
                  {g.done ? <Pill tone="ok">Terminado</Pill> : null}
                </div>
                <Table rows={g.table} name={name} qualify={k} />
                <details className="mt-3">
                  <summary className="small font-semibold cursor-pointer min-h-[40px] flex items-center">Partidos del grupo</summary>
                  {g.rounds.map((r, i) => (
                    <div key={i} className="mt-1">
                      <p className="tiny muted">Fecha {i + 1}</p>
                      {r.map((f) => (
                        <FixtureRow key={f.key} f={f} t={tour} name={name} />
                      ))}
                    </div>
                  ))}
                </details>
              </Card>
            ))}
          </div>
        </>
      ) : null}

      {st.knockout ? (
        <Section title={tour.format === 'groups' ? 'Eliminación directa' : 'Llave'}>
          {!st.knockout.ready ? (
            <Card>
              <p className="small muted">La llave se arma sola cuando terminen todos los partidos de los grupos.</p>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
              {st.knockout.rounds.map((r, i) => (
                <Card key={i}>
                  <p className="h3 mb-1">{roundName(r.length)}</p>
                  {r.map((f) => (
                    <FixtureRow key={f.key} f={f} t={tour} name={name} />
                  ))}
                </Card>
              ))}
            </div>
          )}
        </Section>
      ) : null}

      {isAdmin || tour.createdBy === memberId ? (
        <div className="mt-6">
          <Button variant="line" onClick={() => setDeleteOpen(true)}>
            <Trash2 size={16} /> Eliminar torneo
          </Button>
        </div>
      ) : null}
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Eliminar el torneo"
        text="Se borra el torneo con sus cruces. Los partidos que ya se jugaron quedan en el historial y en el ranking."
        danger
        confirmLabel="Eliminar"
        onConfirm={async () => {
          try {
            await db.deleteDoc(P.trucoTournament(tour.id))
            navigate('/truco/torneos')
          } catch (e) {
            toast.error(errorText(e))
          }
        }}
      />
    </div>
  )
}

function Table({ rows, name, qualify = 0 }: { rows: TableRow[]; name: (id: string) => string; qualify?: number }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="tiny muted text-left">
          <th className="py-1.5 pr-2 w-6">#</th>
          <th className="py-1.5 pr-2"></th>
          <th className="py-1.5 pr-2 text-right" title="Jugados">PJ</th>
          <th className="py-1.5 pr-2 text-right" title="Ganados">G</th>
          <th className="py-1.5 pr-2 text-right" title="Perdidos">P</th>
          <th className="py-1.5 text-right" title="Diferencia de tantos">Dif</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.id} className={`border-t border-line ${i < qualify ? 'bg-ok-soft/30' : ''}`}>
            <td className="py-1.5 pr-2">{i + 1}</td>
            <td className="py-1.5 pr-2 max-w-[140px] sm:max-w-none truncate font-semibold">{name(r.id)}</td>
            <td className="py-1.5 pr-2 text-right tabular-nums">{r.pj}</td>
            <td className="py-1.5 pr-2 text-right tabular-nums font-bold">{r.pg}</td>
            <td className="py-1.5 pr-2 text-right tabular-nums">{r.pp}</td>
            <td className="py-1.5 text-right tabular-nums">{r.tf - r.tc > 0 ? `+${r.tf - r.tc}` : r.tf - r.tc}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** Un cruce: quiénes juegan, el resultado o el botón para jugarlo. */
function FixtureRow({ f, t, name }: { f: Fixture; t: TrucoTournament; name: (id: string | null) => string }) {
  const { db, memberId, isMember } = useSession()
  const toast = useToast()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)

  if (f.a === BYE || f.b === BYE) {
    const who = f.a === BYE ? f.b : f.a
    if (who === BYE) return null
    return (
      <div className="py-2 border-t border-line small muted">
        <b className="text-[var(--text)]">{name(who)}</b> pasa directo (no tiene rival en esta ronda)
      </div>
    )
  }

  async function play() {
    if (!memberId || !f.a || !f.b) return
    const ea = t.entrants.find((e) => e.id === f.a)!
    const eb = t.entrants.find((e) => e.id === f.b)!
    setBusy(true)
    try {
      const id = db.newId()
      await db.setDoc(
        P.trucoMatch(id),
        newTrucoMatch(id, memberId, { size: t.size, target: t.target, teamA: ea.players, teamB: eb.players, nameA: ea.name, nameB: eb.name, tournamentId: t.id, fixtureId: f.key, entrantA: f.a, entrantB: f.b }),
      )
      navigate(`/truco/partido/${id}`)
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  const r = f.result
  return (
    <div className="py-2 border-t border-line flex items-center justify-between gap-3">
      <div className="min-w-0 small">
        <p className={`truncate ${r && r.winner === f.a ? 'font-bold' : r ? 'muted' : ''}`}>{name(f.a)}</p>
        <p className={`truncate ${r && r.winner === f.b ? 'font-bold' : r ? 'muted' : ''}`}>{name(f.b)}</p>
      </div>
      {r ? (
        <Link to={`/truco/partido/${r.matchId}`} className="text-link small shrink-0 tabular-nums text-right">
          {r.resultOnly ? `Ganó ${name(r.winner).split(' / ')[0]}` : `${r.scoreA} a ${r.scoreB}`}
        </Link>
      ) : f.openMatchId ? (
        <Link to={`/truco/partido/${f.openMatchId}`} className="btn btn-sm shrink-0">
          Seguir
        </Link>
      ) : playable(f) && isMember ? (
        <Button size="sm" variant="gold" className="shrink-0" onClick={() => void play()} loading={busy}>
          Jugar
        </Button>
      ) : (
        <span className="tiny muted shrink-0">{playable(f) ? 'Por jugar' : 'Esperando'}</span>
      )}
    </div>
  )
}
