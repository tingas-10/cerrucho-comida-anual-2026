// Golf · Jugadores: hándicap (cada uno carga el suyo), estadísticas, logros e historial.
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSession } from '../../data/DataContext'
import { errorText } from '../../data/actions'
import { proposeGolf, setOwnHcp } from '../../data/golf'
import { yearOf } from '../../domain/fmo'
import { fmtDayShort } from '../../domain/format'
import { golfPlayerStats, golfYears, roundResult } from '../../domain/golf'
import { Button, Card, Loading, Notice, PageHeader, Pill, Section, Stat } from '../../ui/components'
import { useToast } from '../../ui/toast'
import { YearSelect, useFmoPlayers } from '../fmo/fmoShared'
import { GolfTabs, entrantName, formatHcp, modeLabel, useGolfHcps, useGolfRounds } from './golfShared'

export function GolfJugadores() {
  const { db, memberId, isMember, isGolfComm, golfPreview } = useSession()
  const toast = useToast()
  const { rows, loading } = useGolfRounds()
  const hcps = useGolfHcps()
  const players = useFmoPlayers()
  const current = yearOf(Date.now())
  const [year, setYear] = useState<number | 'all'>('all')
  const [who, setWho] = useState('')
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!who && memberId) setWho(memberId)
    else if (!who && players.list.length) setWho(players.list[0].id)
  }, [who, memberId, players.list])
  const doc = hcps.byId[who]
  useEffect(() => {
    setValue(doc ? String(doc.hcp) : '')
  }, [doc, who])

  const years = useMemo(() => golfYears(rows, current), [rows, current])
  const y = year === 'all' ? undefined : year
  const st = useMemo(() => golfPlayerStats(rows, who, y), [rows, who, y])
  const history = useMemo(
    () => rows.filter((r) => r.status === 'PLAYED' && !r.voided && r.entrants.some((e) => e.players.includes(who)) && (y === undefined || yearOf(r.playedAt) === y)).sort((a, b) => b.playedAt - a.playedAt),
    [rows, who, y],
  )

  if (loading || hcps.loading || players.loading) return <Loading />
  const isGuest = players.byId[who]?.guest ?? false
  const canSetDirect = isMember && (who === memberId || isGuest)
  const canPropose = (isGolfComm || golfPreview) && !canSetDirect
  const parsed = Number(value.replace(',', '.'))
  const valid = value.trim() !== '' && Number.isFinite(parsed) && parsed >= -10 && parsed <= 54

  async function saveHcp() {
    if (!memberId || !valid) return
    setBusy(true)
    try {
      const h = Math.round(parsed * 10) / 10
      if (canSetDirect) {
        await setOwnHcp(db, who, h, memberId)
        toast.ok('Hándicap guardado')
      } else {
        await proposeGolf(db, memberId, `Hándicap de ${players.nameOf(who)}: ${formatHcp(doc?.hcp)} → ${formatHcp(h)}`, { type: 'hcp', playerId: who, hcp: h })
        toast.ok('Propuesta enviada a la comisión.')
      }
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader eyebrow="Golf" title="Jugadores" intro="Hándicap, mejores tarjetas, logros e historial de cada uno." />
      <GolfTabs />
      <div className="flex gap-2 flex-wrap mb-4">
        <select className="input w-auto" aria-label="Jugador" value={who} onChange={(e) => setWho(e.target.value)}>
          {players.list.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.guest ? ' (invitado)' : ''}
            </option>
          ))}
        </select>
        <YearSelect value={year} onChange={setYear} years={years} allowAll />
      </div>

      <Card className="mb-4">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <p className="tiny muted">Hándicap</p>
            <p className="text-3xl font-extrabold tabular-nums">{formatHcp(doc?.hcp)}</p>
          </div>
          {canSetDirect || canPropose ? (
            <div className="flex items-end gap-2">
              <label className="small">
                <span className="tiny muted block">{canSetDirect ? (who === memberId ? 'Tu hándicap' : 'Hándicap del invitado') : 'Proponer otro'}</span>
                <input className="input !w-24 text-center" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="ej. 18" aria-label="Hándicap" />
              </label>
              <Button variant="gold" onClick={() => void saveHcp()} disabled={!valid || (!canSetDirect && !isGolfComm)} loading={busy}>
                {canSetDirect ? 'Guardar' : 'Proponer'}
              </Button>
            </div>
          ) : null}
        </div>
        {canPropose ? <p className="tiny muted mt-2">{golfPreview ? 'Vista de administrador: así lo ven los comisionados (el botón está desactivado).' : 'El de otro miembro lo cambia la comisión: se aplica cuando otro comisionado lo aprueba.'}</p> : null}
        {!isMember ? null : !canSetDirect && !canPropose ? <p className="tiny muted mt-2">Cada uno carga el suyo. Si está mal, la comisión lo puede corregir.</p> : null}
        {doc?.history?.length ? (
          <p className="tiny muted mt-2">
            Historial: {doc.history.slice(-6).map((h) => `${formatHcp(h.hcp)} (${fmtDayShort(h.at)})`).join(' → ')}
          </p>
        ) : null}
      </Card>

      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
        <Stat label="Partidos" value={st.rounds} />
        <Stat label="Vueltas individuales" value={st.solos} />
        <Stat label="Primeros" value={st.wins} />
        <Stat label="Podios" value={st.podiums} />
        <Stat label="Mejor 18" value={st.best18 ?? '—'} />
        <Stat label="Promedio 18" value={st.avg18 === null ? '—' : String(st.avg18).replace('.', ',')} />
        <Stat label="Mejor stableford" value={st.bestStableford ?? '—'} />
        <Stat label="Birdies" value={st.birdies} />
        <Stat label="Eagles" value={st.eagles} />
        <Stat label="Hoyos en uno" value={st.aces} />
        <Stat label="Mejor 9" value={st.best9 ?? '—'} />
      </div>

      <Section title="Sus partidos">
        <Card>
          {history.length === 0 ? <p className="small muted">Todavía no jugó ningún partido guardado{y ? ` en ${y}` : ''}.</p> : null}
          {history.map((r) => {
            const res = roundResult(r)
            const e = r.entrants.find((x) => x.players.includes(who))!
            const s = res.standings.find((x) => x.entrantId === e.id)
            return (
              <Link key={r.id} to={`/golf/partido/${r.id}`} className="row">
                <span className="small min-w-0">
                  <span className="tiny muted block">
                    {fmtDayShort(r.playedAt)} · {r.course.name} · {modeLabel(r)}
                  </span>
                  <span className="block truncate">
                    {e.players.length > 1 ? `${entrantName(e, players)} · ` : ''}
                    {s?.label ?? 'sin resultado'}
                  </span>
                </span>
                {s ? <Pill tone={s.position === 1 ? 'ok' : s.position <= 3 ? 'accent' : 'muted'}>{s.position}º de {res.standings.length}</Pill> : null}
              </Link>
            )
          })}
        </Card>
      </Section>
      {!isMember ? <Notice>Entrá con tu usuario para cargar tu hándicap.</Notice> : null}
    </div>
  )
}
