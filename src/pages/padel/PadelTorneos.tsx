// Pádel · Torneos: los que se están jugando y el historial con los campeones.
import { Plus, Trophy } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { FORMATO_TORNEO } from '../../content/padel'
import { useSession } from '../../data/DataContext'
import { fmtDayLong } from '../../domain/format'
import { allFixtures, tournamentState } from '../../domain/padelTorneo'
import { Empty, Loading, Section } from '../../ui/components'
import { useFmoPlayers } from '../fmo/fmoShared'
import { PadelTabs, usePadelMatches } from './padelShared'
import { PadelHeader, pairNames, usePadelTournaments } from './padelTorneoShared'

export function PadelTorneos() {
  const { isMember } = useSession()
  const { rows, loading } = usePadelTournaments()
  const { rows: matches, loading: lm } = usePadelMatches()
  const players = useFmoPlayers()
  const list = useMemo(
    () =>
      rows
        .map((t) => ({ t, st: tournamentState(t, matches) }))
        .sort((x, y) => (y.t.date ?? y.t.createdAt) - (x.t.date ?? x.t.createdAt)),
    [rows, matches],
  )
  if (loading || lm || players.loading) return <Loading />
  const open = list.filter((x) => !x.st.champion)
  const done = list.filter((x) => x.st.champion)

  return (
    <div>
      <PadelHeader
        title="Torneos"
        intro="Liga, eliminación directa o grupos más cuadro. Se carga cada resultado cuando termina el partido y todos ven el torneo al día. Cada partido suma también al ranking general."
        actions={
          isMember ? (
            <Link to="/padel/torneos/nuevo" className="btn btn-lime">
              <Plus size={18} /> Nuevo torneo
            </Link>
          ) : null
        }
      />
      <PadelTabs />

      <Section title="En juego" className="mt-2">
        {open.length === 0 ? (
          <Empty title="No hay torneos en juego" text={isMember ? 'Tocá "Nuevo torneo" para armar uno: parejas, formato y reglas.' : 'Cuando armen uno, aparece acá.'} />
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {open.map(({ t, st }) => {
              const live = allFixtures(st).filter((f) => f.live).length
              const pct = st.total ? Math.round((st.played / st.total) * 100) : 0
              return (
                <Link key={t.id} to={`/padel/torneo/${t.id}`} className="tour-band block p-5 hover:brightness-110 transition">
                  <p className="tour-eyebrow">
                    {FORMATO_TORNEO[t.format].label} · {t.pairs.length} parejas
                  </p>
                  <p className="tour-title text-[28px] mt-1 pr-16">{t.name}</p>
                  <p className="small text-white/70 mt-1">{[t.date ? fmtDayLong(t.date) : null, t.place].filter(Boolean).join(' · ') || 'Sin fecha'}</p>
                  <div className="mt-3 h-2 rounded-full bg-white/15 overflow-hidden pr-0 mr-16">
                    <div className="h-full bg-[#d6f21d] rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="tiny text-white/75 mt-1.5 flex items-center gap-2 flex-wrap">
                    {st.played} de {st.total} partidos jugados
                    {live ? <span className="tour-live">{live === 1 ? '1 en cancha' : `${live} en cancha`}</span> : null}
                  </p>
                </Link>
              )
            })}
          </div>
        )}
      </Section>

      <Section title="Historial">
        {done.length === 0 ? (
          <Empty title="Todavía no terminó ningún torneo" text="Cuando termine uno, queda acá con sus campeones." />
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {done.map(({ t, st }) => (
              <Link key={t.id} to={`/padel/torneo/${t.id}`} className="card p-4 flex items-center gap-4 hover:border-[#d6f21d]">
                <span className="w-12 h-12 rounded-xl grid place-items-center bg-[#06112a] text-[#d6f21d] shrink-0">
                  <Trophy size={24} />
                </span>
                <span className="min-w-0">
                  <span className="block font-extrabold italic uppercase truncate">{t.name}</span>
                  <span className="block small muted truncate">
                    {[t.date ? fmtDayLong(t.date) : null, FORMATO_TORNEO[t.format].label].filter(Boolean).join(' · ')}
                  </span>
                  <span className="block small font-semibold truncate mt-0.5">Campeones: {pairNames(t, st.champion, players)}</span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}
