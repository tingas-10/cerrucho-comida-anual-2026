// Pádel · Ver torneo completo: pantalla entera con el avance del torneo, para mirar en el celu, la compu o la tele.
// Grupos + eliminación: el cuadro arriba (con la copa en el medio) y los grupos abajo. Eliminación: el cuadro.
// Liga: la tabla y las fechas. Se actualiza sola cuando alguien carga un resultado.
import { Maximize, Minimize, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { FORMATO_TORNEO } from '../../content/padel'
import { useDoc } from '../../data/hooks'
import { P } from '../../data/paths'
import type { PadelTournament } from '../../data/types'
import { fmtDayLong } from '../../domain/format'
import { allFixtures, fixtureTitle, tournamentState } from '../../domain/padelTorneo'
import { Loading } from '../../ui/components'
import { useFmoPlayers } from '../fmo/fmoShared'
import { usePadelMatches } from './padelShared'
import { Bracket, ScoreBox, TourTable, formatLabel } from './padelTorneoShared'

export function PadelCuadro() {
  const { id } = useParams()
  const doc = useDoc<PadelTournament>(id ? P.padelTournament(id) : null)
  const { rows: matches, loading } = usePadelMatches()
  const players = useFmoPlayers()
  const [full, setFull] = useState(false)
  const t = doc.data
  const st = useMemo(() => (t ? tournamentState(t, matches) : null), [t, matches])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onFs = () => setFull(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFs)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('fullscreenchange', onFs)
    }
  }, [])

  function toggleFull() {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen?.().catch(() => undefined)
  }

  const shell = (children: React.ReactNode) => (
    <div className="fixed inset-0 z-[60] overflow-y-auto text-white" style={{ background: 'radial-gradient(120% 80% at 50% 0%, #123372 0%, #081a3d 45%, #040b1c 100%)' }} role="dialog" aria-label="Torneo completo">
      {children}
    </div>
  )
  if (doc.loading || loading || players.loading) return shell(<div className="pt-20"><Loading /></div>)
  if (!t || !st) return shell(<p className="p-8">Ese torneo no existe. <Link className="underline" to="/padel/torneos">Volver</Link></p>)

  const live = allFixtures(st).filter((f) => f.live)
  const k = t.advance === 'all' ? Infinity : (t.advance ?? 0)
  const meta = [FORMATO_TORNEO[t.format].label, t.date ? fmtDayLong(t.date) : null, t.place].filter(Boolean).join(' · ')
  const ko = st.knockout && st.knockout.length ? st.knockout : null

  return shell(
    <div className="max-w-[1500px] mx-auto px-4 sm:px-8 pt-4 pb-10">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="tour-eyebrow">Pádel · Circuito de la banda</p>
          <h1 className="tour-title text-[34px] sm:text-[56px] mt-1 truncate pr-[0.15em]">{t.name}</h1>
          <p className="small text-white/70 mt-1">
            {meta} · {st.played} de {st.total} partidos
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button type="button" onClick={toggleFull} className="hidden sm:grid w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 place-items-center" aria-label={full ? 'Salir de pantalla completa' : 'Pantalla completa'}>
            {full ? <Minimize size={20} /> : <Maximize size={20} />}
          </button>
          <Link to={`/padel/torneo/${t.id}`} className="grid w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 place-items-center" aria-label="Cerrar">
            <X size={22} />
          </Link>
        </div>
      </div>

      {live.length ? (
        <div className="mt-5">
          <p className="tour-eyebrow mb-2 flex items-center gap-2">
            <span className="tour-live">En vivo</span> En cancha ahora
          </p>
          <div className="flex gap-4 flex-wrap">
            {live.map((f) => (
              <div key={f.key}>
                <p className="tiny text-white/60 mb-1">{fixtureTitle(f, st)}</p>
                <ScoreBox t={t} f={f} players={players} />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {ko ? (
        <section className="mt-6">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <h2 className="tour-title text-2xl">Cuadro</h2>
            <p className="tiny text-white/55">{ko.map((r) => `${r.length === 1 ? 'Final' : r.length === 2 ? 'Semis' : r.length === 4 ? 'Cuartos' : `Ronda de ${r.length * 2}`}: ${formatLabel(r[0].format).toLowerCase()}`).join(' · ')}</p>
          </div>
          <div className="mt-2 rounded-2xl bg-white/[.03] border border-white/10">
            <Bracket t={t} rounds={ko} players={players} champion={st.champion} />
          </div>
        </section>
      ) : null}

      {st.groups ? (
        <section className="mt-8">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <h2 className="tour-title text-2xl">Grupos</h2>
            <p className="tiny text-white/55">
              {formatLabel(t.formats.rr)} · {t.advance === 'all' ? 'pasan todos' : t.advance === 1 ? 'pasa el 1°' : `pasan los ${t.advance} primeros`}
            </p>
          </div>
          <div className={`grid gap-4 mt-3 ${st.groups.length > 1 ? 'md:grid-cols-2' : ''} ${st.groups.length > 2 ? 'xl:grid-cols-3' : ''}`}>
            {st.groups.map((g) => (
              <div key={g.name} className="rounded-2xl bg-white/[.05] border border-white/10 p-4">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="tour-title text-xl text-[#d6f21d]">{g.name}</p>
                  {g.done ? <span className="tiny text-white/60">Terminado</span> : <span className="tiny text-white/60">{g.fixtures.filter((f) => f.result).length} de {g.fixtures.length} partidos</span>}
                </div>
                <TourTable t={t} rows={g.table} players={players} qualify={k} dark />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {st.league ? (
        <section className="mt-6 grid lg:grid-cols-[minmax(0,560px)_1fr] gap-6 items-start">
          <div className="rounded-2xl bg-white/[.05] border border-white/10 p-4">
            <p className="tour-title text-xl text-[#d6f21d] mb-1">Tabla</p>
            <TourTable t={t} rows={st.league.table} players={players} dark />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {Array.from({ length: st.league.rounds }, (_, r) => (
              <div key={r}>
                <p className="tour-eyebrow mb-2">Fecha {r + 1}</p>
                <div className="grid gap-2">
                  {st
                    .league!.fixtures.filter((f) => f.round === r)
                    .map((f) => (
                      <ScoreBox key={f.key} t={t} f={f} players={players} wide />
                    ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>,
  )
}
