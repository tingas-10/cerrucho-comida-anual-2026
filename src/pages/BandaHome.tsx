// Portada de La Banda del cerrucho (no de una edición): accesos a la comida anual, FMO y cumpleaños.
import { Cake, CalendarDays, Goal, LogIn } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { EDICION_ACTUAL, GRUPO } from '../content/config'
import { FOTOS } from '../content/galeria'
import { useSession } from '../data/DataContext'
import { useEdition, useMembers, useNow } from '../data/hooks'
import { formatBirthday, upcoming } from '../domain/birthdays'
import { computeStats, formatPoints, ranking, scoreOf, yearOf } from '../domain/fmo'
import { fmtDayLong, fmtTime } from '../domain/format'
import { Card, MemberAvatar } from '../ui/components'
import { useFmoMatches, useFmoPlayers } from './fmo/fmoShared'

const BASE = import.meta.env.BASE_URL

export function BandaHome() {
  const { isMember, member } = useSession()
  const now = useNow(60000)
  const { data: edition } = useEdition()
  const members = useMembers()
  const { rows: matches } = useFmoMatches()
  const players = useFmoPlayers()
  const nextBirthday = useMemo(() => upcoming(members.list.filter((m) => m.status !== 'suspended'), 1, now)[0], [members.list, now])
  const played = useMemo(() => matches.filter((m) => m.status === 'PLAYED').sort((a, b) => b.playedAt - a.playedAt), [matches])
  const leader = useMemo(() => ranking(computeStats(matches, yearOf(now)))[0], [matches, now])
  const last = played[0]
  const e = `/e/${EDICION_ACTUAL.slug}`
  const hero = BASE + (edition?.heroPhoto ?? FOTOS[0].src)

  return (
    <div>
      <div
        className="relative rounded-[20px] overflow-hidden min-h-[240px] sm:min-h-[320px] flex items-end p-6 sm:p-9 text-white"
        style={{ background: `linear-gradient(0deg, rgba(8,10,17,.9), rgba(8,10,17,.1)), url(${hero}) center 45% / cover` }}
      >
        <div>
          <h1 className="hero-title max-w-3xl">
            La Banda
            <br />
            del cerrucho.
          </h1>
          <p className="text-[#f2e7c8] mt-3">{isMember && member ? `Hola, ${member.alias}.` : 'Comida anual, fútbol y cumpleaños de la banda.'}</p>
        </div>
      </div>

      {!isMember ? (
        <div className="card p-4 mt-4 flex items-center justify-between gap-3 flex-wrap">
          <p className="small">Podés mirar todo sin entrar. Para votar o cargar lo tuyo, entrá con tu usuario.</p>
          <Link to="/entrar" className="btn btn-gold btn-sm">
            <LogIn size={16} /> Entrar
          </Link>
        </div>
      ) : null}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
        <Card className="flex flex-col">
          <p className="eyebrow flex items-center gap-2">
            <CalendarDays size={14} /> {edition?.title ?? EDICION_ACTUAL.titulo}
          </p>
          <div className="mt-2 flex-1">
            <SummaryRow label="Fecha" value={edition?.date.startsAt ? `${fmtDayLong(edition.date.startsAt)} · ${fmtTime(edition.date.startsAt)} h` : null} />
            <SummaryRow label="Lugar" value={edition?.venue?.name ?? null} />
            <SummaryRow label="Comida" value={edition?.menu?.name ?? null} />
          </div>
          <Link to={e} className="btn mt-3">
            Ir a la comida anual
          </Link>
        </Card>

        <Card className="flex flex-col">
          <p className="eyebrow flex items-center gap-2">
            <Goal size={14} /> FMO
          </p>
          <div className="mt-2 flex-1 small">
            {last ? (
              <p>
                <span className="muted">Último partido · {fmtDayLong(last.playedAt)}</span>
                <br />
                <b>
                  {last.nameA} {scoreOf(last).a} – {scoreOf(last).b} {last.nameB}
                </b>
              </p>
            ) : (
              <p className="muted">Todavía no hay partidos cargados.</p>
            )}
            {leader ? (
              <p className="mt-2 flex items-center gap-2">
                <span className="muted">Puntero {yearOf(now)}:</span>
                <b>{players.nameOf(leader.playerId)}</b>
                <span className="muted">({formatPoints(leader.points)} pts)</span>
              </p>
            ) : null}
          </div>
          <Link to="/fmo" className="btn mt-3">
            Ir a FMO
          </Link>
        </Card>

        <Card className="flex flex-col">
          <p className="eyebrow flex items-center gap-2">
            <Cake size={14} /> Cumpleaños
          </p>
          <div className="mt-2 flex-1">
            {nextBirthday ? (
              <div className="flex items-center gap-3">
                <MemberAvatar id={nextBirthday.id} size={44} />
                <div>
                  <p className="font-bold">{nextBirthday.alias}</p>
                  <p className="small muted">
                    {formatBirthday(nextBirthday.birthday!)} · {nextBirthday.days === 0 ? '¡hoy!' : nextBirthday.days === 1 ? 'mañana' : `en ${nextBirthday.days} días`}
                  </p>
                </div>
              </div>
            ) : (
              <p className="small muted">Todavía nadie cargó su cumpleaños.</p>
            )}
          </div>
          <Link to="/cumples" className="btn mt-3">
            Ver todos
          </Link>
        </Card>
      </div>
      <p className="tiny muted mt-6 text-center">{GRUPO.nombre}</p>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between gap-3 py-1.5 border-b border-line last:border-0 small">
      <span className="muted">{label}</span>
      <span className={`text-right ${value ? 'font-semibold' : 'muted'}`}>{value ?? 'A definir'}</span>
    </div>
  )
}
