// Golf · Una cancha: mapa, cada hoyo (par, dificultad, metros y consejo de caddy) e historial con los récords de la banda.
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useSession } from '../../data/DataContext'
import { fmtDayShort } from '../../domain/format'
import { courseHistory, parTotal } from '../../domain/golf'
import { Avatar, Button, Card, Loading, Notice, PageHeader, Section } from '../../ui/components'
import { useFmoPlayers } from '../fmo/fmoShared'
import { CourseEditor } from './GolfCanchas'
import { CourseOverview, HoleView, mapHolesFor, useClubMap } from './golfMap'
import { GolfTabs, useGolfCourses, useGolfRounds } from './golfShared'

export function GolfCancha() {
  const { id } = useParams()
  const { isGolfComm, golfPreview } = useSession()
  const courses = useGolfCourses()
  const { rows: rounds } = useGolfRounds()
  const players = useFmoPlayers()
  const course = courses.rows.find((c) => c.id === id)
  const { map, loading: mapLoading } = useClubMap(course?.club)
  const [sel, setSel] = useState(0)
  const [editing, setEditing] = useState(false)
  const history = useMemo(() => (course ? courseHistory(rounds, course.id) : []), [rounds, course])

  if (courses.loading || players.loading) return <Loading />
  if (!course) return <Notice tone="warn">Esa cancha no existe. <Link className="underline" to="/golf/canchas">Volver a Canchas</Link></Notice>

  const mapHoles = map ? mapHolesFor(map, null, course.holes.map((h) => h.mapRef)) : []
  const hasHoleMap = mapHoles.some(Boolean)
  const h = course.holes[sel]
  const mh = mapHoles[sel] ?? null
  const [club, variant] = course.name.split(' · ')

  return (
    <div>
      <PageHeader
        eyebrow={club}
        title={variant ?? course.name}
        intro={`${course.holes.length} hoyos · par ${parTotal(course.holes)}${course.archived ? ' · archivada' : ''}`}
        actions={
          isGolfComm || golfPreview ? (
            <Button variant="line" onClick={() => setEditing(true)}>
              Proponer cambios
            </Button>
          ) : null
        }
      />
      <GolfTabs />
      <Link to="/golf/canchas" className="tiny underline muted">
        ← Canchas
      </Link>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4 mt-3 items-start">
        <Card className="!p-3 sm:!p-4">
          {mapLoading ? <p className="small muted">Cargando el mapa…</p> : null}
          {map && hasHoleMap ? (
            <CourseOverview map={map} holes={mapHoles} selected={sel} onSelect={setSel} labelOf={(i) => String(i + 1)} />
          ) : !mapLoading ? (
            <p className="small muted">
              Todavía no hay mapa de los hoyos de esta cancha: no están dibujados en OpenStreetMap (el mapa libre del que salen los dibujos). Cuando alguien los dibuje ahí, se pueden sumar.
            </p>
          ) : null}
        </Card>

        <div className="grid gap-4">
          <Card>
            <div className="flex gap-1 overflow-x-auto pb-2 -mx-1 px-1" role="tablist" aria-label="Hoyo">
              {course.holes.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  role="tab"
                  aria-selected={i === sel}
                  onClick={() => setSel(i)}
                  className={`shrink-0 w-10 h-10 rounded-lg border text-sm font-bold ${i === sel ? 'bg-[#d9b45f] text-[#191409] border-[#d9b45f]' : 'border-line'}`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <div className="flex items-end justify-between gap-3 mt-1 mb-3">
              <p className="h2">Hoyo {sel + 1}</p>
              <p className="small muted text-right">
                Par <b className="text-[var(--text)]">{h.par}</b> · Dificultad <b className="text-[var(--text)]">{h.si}</b>
                {h.meters ? (
                  <>
                    {' '}
                    · <b className="text-[var(--text)]">{h.meters} m</b>
                  </>
                ) : null}
              </p>
            </div>
            {map && mh ? <HoleView map={map} hole={mh} /> : null}
            <div className="rounded-xl bg-soft/60 p-3 mt-3">
              <p className="tiny muted font-semibold mb-1">CONSEJO DE CADDY</p>
              <p className="small">{h.tip ?? 'Todavía no hay consejo para este hoyo.'}</p>
            </div>
          </Card>
        </div>
      </div>

      <Section title="Récords de la banda en esta cancha">
        <Card>
          {history.length === 0 ? <p className="small muted">Todavía nadie cargó un partido o una vuelta acá.</p> : null}
          {history.map((r, i) => (
            <div key={r.playerId} className="row">
              <span className="flex items-center gap-2 min-w-0">
                <span className="w-6 text-center">{i === 0 && r.best !== null ? '🏆' : `${i + 1}`}</span>
                <Avatar id={r.playerId} alias={players.nameOf(r.playerId)} size={26} color={players.byId[r.playerId]?.color} photo={players.byId[r.playerId]?.photo} />
                <span className="font-semibold truncate">{players.nameOf(r.playerId)}</span>
              </span>
              <span className="small tabular-nums text-right shrink-0">
                mejor <b>{r.best ?? '—'}</b> · prom. {r.avg === null ? '—' : String(r.avg).replace('.', ',')} · {r.rounds} {r.rounds === 1 ? 'vuelta' : 'vueltas'}
                <span className="tiny muted block">última {fmtDayShort(r.last)}</span>
              </span>
            </div>
          ))}
        </Card>
      </Section>

      <Section title="La tarjeta">
        <Card className="!p-3 sm:!p-5">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="tiny muted text-left">
                  <th className="py-1.5 pr-2">Hoyo</th>
                  <th className="py-1.5 pr-2 text-right">Par</th>
                  <th className="py-1.5 pr-2 text-right">Dificultad</th>
                  <th className="py-1.5 text-right">Metros</th>
                </tr>
              </thead>
              <tbody>
                {course.holes.map((x, i) => (
                  <tr key={i} className={`border-t border-line cursor-pointer ${i === sel ? 'bg-soft' : ''}`} onClick={() => setSel(i)}>
                    <td className="py-1.5 pr-2 font-bold">{i + 1}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{x.par}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{x.si}</td>
                    <td className="py-1.5 text-right tabular-nums">{x.meters ?? '—'}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-line font-bold">
                  <td className="py-1.5 pr-2">Total</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{parTotal(course.holes)}</td>
                  <td />
                  <td className="py-1.5 text-right tabular-nums">{course.holes.every((x) => x.meters) ? course.holes.reduce((a, x) => a + (x.meters ?? 0), 0) : '—'}</td>
                </tr>
              </tbody>
            </table>
          </div>
          {course.source ? <p className="tiny muted mt-2">Fuentes: {course.source}</p> : null}
        </Card>
      </Section>
      {editing ? <CourseEditor course={course} onClose={() => setEditing(false)} /> : null}
    </div>
  )
}
