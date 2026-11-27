// Portada de La Banda del cerrucho: una sola pantalla con un botón por sección (pedido de Agus, 26/11/2026).
// Cada botón tiene su ícono y una línea al día (próximo partido, puntero, torneo en juego, próximo cumpleaños…).
import { Archive, Cake, Flag, Goal, ImageIcon, LogIn, Spade, Users, UtensilsCrossed } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { EDICION_ACTUAL } from '../content/config'
import { FOTOS } from '../content/galeria'
import { useSession } from '../data/DataContext'
import { useEdition, useMembers, useNow } from '../data/hooks'
import { upcoming } from '../domain/birthdays'
import { computeStats, ranking, upcomingMatches, yearOf } from '../domain/fmo'
import { fmtDayShort } from '../domain/format'
import { meritTable, upcomingRounds } from '../domain/golf'
import { computePadelStats, padelRanking } from '../domain/padel'
import { allFixtures, tournamentState as padelTournamentState } from '../domain/padelTorneo'
import { computeTrucoStats, trucoRanking } from '../domain/truco'
import { PadelIcon } from '../ui/Shell'
import { useFmoMatches, useFmoPlayers } from './fmo/fmoShared'
import { useGolfConfig, useGolfRounds } from './golf/golfShared'
import { usePadelMatches } from './padel/padelShared'
import { usePadelTournaments } from './padel/padelTorneoShared'
import { teamLabel, useTrucoMatches } from './truco/trucoShared'

const BASE = import.meta.env.BASE_URL

interface Tile {
  to: string
  title: string
  sub: string
  icon: ReactNode
  tone: string // colores del ícono
  live?: string | null
}

export function BandaHome() {
  const { isMember, member } = useSession()
  const now = useNow(60000)
  const year = yearOf(now)
  const { data: edition } = useEdition()
  const members = useMembers()
  const players = useFmoPlayers()
  const { rows: fmo } = useFmoMatches()
  const { rows: padel } = usePadelMatches()
  const { rows: padelTours } = usePadelTournaments()
  const { rows: golfRounds } = useGolfRounds()
  const golfCfg = useGolfConfig()
  const { rows: truco } = useTrucoMatches()

  const tiles = useMemo<Tile[]>(() => {
    const e = `/e/${EDICION_ACTUAL.slug}`
    const soon = (ms: number) => ms >= now - 12 * 3600000
    const fmoNext = upcomingMatches(fmo).find((m) => soon(m.playedAt))
    const fmoLeader = ranking(computeStats(fmo, year))[0]
    const tour = padelTours
      .map((t) => ({ t, st: padelTournamentState(t, padel) }))
      .filter((x) => !x.st.champion)
      .sort((a, b) => b.t.createdAt - a.t.createdAt)[0]
    const padelLeader = padelRanking(computePadelStats(padel, year))[0]
    const golfNext = upcomingRounds(golfRounds).find((r) => soon(r.playedAt))
    const golfLeader = meritTable(golfRounds, golfCfg.points, year)[0]
    const trucoLive = truco.filter((m) => m.status === 'LIVE').sort((a, b) => b.updatedAt - a.updatedAt)[0]
    const trucoLeader = trucoRanking(computeTrucoStats(truco, year))[0]
    const bday = upcoming(members.list.filter((m) => m.status !== 'suspended'), 1, now)[0]
    const lead = (id: string | undefined) => (id ? `Puntero: ${players.nameOf(id)}` : 'Todavía sin partidos')
    return [
      {
        to: e,
        title: 'Comida anual',
        sub: edition?.date.startsAt ? `${EDICION_ACTUAL.anio} · ${fmtDayShort(edition.date.startsAt)}` : 'Votando fecha y lugar',
        icon: <UtensilsCrossed size={26} />,
        tone: 'bg-[#d9b45f]/20 text-[#9a7420] dark:text-[#e7c877]',
      },
      {
        to: '/fmo',
        title: 'FMO',
        sub: fmoNext ? `Próximo: ${fmtDayShort(fmoNext.playedAt)}` : lead(fmoLeader?.playerId),
        icon: <Goal size={26} />,
        tone: 'bg-[#1b7f3b]/15 text-[#1b7f3b] dark:text-[#7bd88f]',
      },
      {
        to: tour ? `/padel/torneo/${tour.t.id}` : '/padel',
        title: 'Pádel',
        sub: tour ? `${tour.t.name} en juego` : lead(padelLeader?.id),
        icon: <PadelIcon size={26} />,
        tone: 'bg-[#06112a] text-[#d6f21d]',
        live: tour && allFixtures(tour.st).some((f) => f.live) ? 'En cancha' : null,
      },
      {
        to: '/golf',
        title: 'Golf',
        sub: golfNext ? `Próximo: ${fmtDayShort(golfNext.playedAt)}` : lead(golfLeader?.playerId),
        icon: <Flag size={26} />,
        tone: 'bg-[#2f6b3f]/15 text-[#2f6b3f] dark:text-[#8fd4a0]',
      },
      {
        to: trucoLive ? `/truco/partido/${trucoLive.id}` : '/truco',
        title: 'Truco',
        sub: trucoLive ? `${teamLabel(trucoLive, 'A', players)} ${trucoLive.scoreA} a ${trucoLive.scoreB} ${teamLabel(trucoLive, 'B', players)}` : lead(trucoLeader?.id),
        icon: <Spade size={26} />,
        tone: 'bg-[#b42318]/12 text-[#b42318] dark:text-[#ff8a80]',
        live: trucoLive ? 'En vivo' : null,
      },
      {
        to: '/cumples',
        title: 'Cumpleaños',
        sub: bday ? `${bday.alias} · ${bday.days === 0 ? 'hoy' : bday.days === 1 ? 'mañana' : `en ${bday.days} días`}` : 'Cargá el tuyo',
        icon: <Cake size={26} />,
        tone: 'bg-[#d63384]/12 text-[#b0246b] dark:text-[#f38ab8]',
      },
      {
        to: '/galeria',
        title: 'Galería',
        sub: 'Fotos de la banda',
        icon: <ImageIcon size={26} />,
        tone: 'bg-[#2364b8]/12 text-[#1d58a5] dark:text-[#8ab6f0]',
      },
      isMember
        ? { to: '/miembros', title: 'Miembros', sub: `${members.list.filter((m) => m.status !== 'suspended').length} en la banda`, icon: <Users size={26} />, tone: 'bg-[#6d4bc4]/12 text-[#5b3db0] dark:text-[#b9a4f2]' }
        : { to: '/archivo', title: 'Archivo', sub: 'Comidas anteriores', icon: <Archive size={26} />, tone: 'bg-[#6d4bc4]/12 text-[#5b3db0] dark:text-[#b9a4f2]' },
    ]
  }, [edition, fmo, padel, padelTours, golfRounds, golfCfg.points, truco, members.list, players, now, year, isMember])

  const hero = BASE + (edition?.heroPhoto ?? FOTOS[0].src)

  return (
    // En el celular ocupa justo el alto que queda entre la barra de arriba y la de abajo: no hace falta scrollear.
    <div className="flex flex-col gap-3 h-[calc(100dvh-188px)] min-h-[420px] md:h-auto md:min-h-0 md:gap-4">
      <div
        className="relative rounded-[20px] overflow-hidden shrink-0 h-[clamp(80px,14dvh,124px)] md:h-[190px] flex items-end justify-between gap-3 px-5 pb-3.5 md:px-8 md:pb-6 text-white"
        style={{ background: `linear-gradient(0deg, rgba(8,10,17,.88), rgba(8,10,17,.15)), url(${hero}) center 45% / cover` }}
      >
        <div className="min-w-0">
          <h1 className="font-extrabold tracking-[-0.04em] leading-[0.95] text-[28px] short:text-[24px] md:text-[52px]">La Banda del cerrucho.</h1>
          <p className="text-[#f2e7c8] text-sm md:text-base mt-1">{isMember && member ? `Hola, ${member.alias}.` : 'Elegí a dónde ir.'}</p>
        </div>
        {!isMember ? (
          <Link to="/entrar" className="btn btn-gold btn-sm shrink-0">
            <LogIn size={16} /> Entrar
          </Link>
        ) : null}
      </div>

      <nav aria-label="Secciones" className="grid grid-cols-2 grid-rows-4 flex-1 min-h-0 md:flex-none md:grid-rows-none lg:grid-cols-4 gap-2.5 md:gap-3">
        {tiles.map((t) => (
          <Link
            key={t.title}
            to={t.to}
            className="card relative min-h-0 overflow-hidden flex flex-col short:flex-row short:items-center gap-2 short:gap-2 p-3 short:p-2.5 md:p-4 md:min-h-[150px] hover:border-[var(--gold)] active:scale-[.98] transition"
          >
            {t.live ? <span className="tour-live absolute top-2 right-2 !text-[10px] !px-1.5 short:hidden">{t.live}</span> : null}
            <span className={`relative shrink-0 w-11 h-11 short:w-9 short:h-9 short:rounded-xl short:[&>svg]:w-5 short:[&>svg]:h-5 md:w-14 md:h-14 rounded-2xl grid place-items-center ${t.tone}`}>
              {t.icon}
              {/* En celulares bajos, en vez del cartel, un punto rojo sobre el ícono */}
              {t.live ? <span className="hidden short:block absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#e5262b] ring-2 ring-[var(--card)] animate-pulse" aria-label={t.live} /> : null}
            </span>
            <span className="mt-auto short:mt-0 min-w-0">
              <span className="block font-extrabold text-[17px] short:text-[14.5px] md:text-xl leading-tight truncate short:whitespace-normal short:line-clamp-2">{t.title}</span>
              <span className="block text-[12.5px] short:text-[12px] md:text-sm muted leading-snug truncate short:whitespace-normal short:line-clamp-2">{t.sub}</span>
            </span>
          </Link>
        ))}
      </nav>
    </div>
  )
}
