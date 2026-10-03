// Bebidas: nivel de consumo (barra 0-100), reparto entre bebidas (barras que suman 100), reparto del grupo y compras.
import { useEffect, useMemo, useState } from 'react'
import { BEBIDAS, BEBIDA_LABEL, NIVEL_PASO, fraseNivel } from '../content/bebidas'
import { useSession } from '../data/DataContext'
import { errorText } from '../data/actions'
import { DataError } from '../data/adapter'
import { useCollection, useDoc, useEdition, useMembers, useNow } from '../data/hooks'
import { P } from '../data/paths'
import type { BeverageProfile, Rsvp } from '../data/types'
import { computePurchases, emptyPct, formatAmount, pctTotal, portionsOf, summarize, validateProfile } from '../domain/beverages'
import { formatArs } from '../domain/expenses'
import { timeLeft } from '../domain/format'
import { Button, Card, Loading, LoginPrompt, Notice, PageHeader, Pill } from '../ui/components'
import { useToast } from '../ui/toast'

export function Bebidas() {
  const { db, slug, memberId, isAdmin, isMember } = useSession()
  const toast = useToast()
  const now = useNow()
  const { data: edition, loading } = useEdition()
  const members = useMembers()
  const mine = useDoc<BeverageProfile>(isMember && memberId ? P.beverage(slug, memberId) : null)
  const { rows: profiles } = useCollection<BeverageProfile>(isMember ? P.beverages(slug) : null)
  const { rows: rsvps } = useCollection<Rsvp>(P.rsvps(slug))
  const [level, setLevel] = useState(50)
  const [pct, setPct] = useState<Record<string, number>>(emptyPct())
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (dirty || !mine.data) return
    setLevel(mine.data.level ?? (mine.data.noAlcohol ? 0 : 50))
    setPct({ ...emptyPct(), ...mine.data.pct })
  }, [mine.data, dirty])

  const settings = edition?.beverage
  const open = !!settings && settings.state === 'OPEN' && (!settings.closeAt || now < settings.closeAt)
  const attendees = useMemo(() => {
    if (!edition?.date.startsAt) return []
    return rsvps.filter((r) => r.status === 'YES' && r.planVersion === edition.planVersion).map((r) => r.id)
  }, [rsvps, edition])
  const attendeeProfiles = useMemo(() => {
    const ids = new Set(attendees)
    return edition?.date.startsAt ? profiles.filter((p) => ids.has(p.id)) : profiles
  }, [profiles, attendees, edition])
  const summary = useMemo(() => summarize(attendeeProfiles), [attendeeProfiles])
  const purchases = useMemo(() => (settings ? computePurchases(settings, attendeeProfiles, edition?.date.startsAt ? attendees.length : 0) : null), [settings, attendeeProfiles, attendees, edition])

  if (loading || !edition || !settings) return <Loading />
  if (!isMember) {
    return (
      <div>
        <PageHeader eyebrow={edition.title} title="Qué vas a tomar" intro="Cada uno carga cuánto y qué toma, y con eso se arma la lista de compras." />
        <LoginPrompt text="Entrá para cargar lo que vas a tomar." />
      </div>
    )
  }

  const total = pctTotal(pct)
  const validation = validateProfile({ level, pct })

  function setOne(k: string, v: number) {
    setDirty(true)
    setPct((p) => ({ ...p, [k]: Math.max(0, Math.min(100, Math.round(v / 5) * 5 || 0)) }))
  }
  function preset(a: string, b?: string) {
    setDirty(true)
    const next = emptyPct() as Record<string, number>
    if (b) {
      next[a] = 50
      next[b] = 50
    } else next[a] = 100
    setPct(next)
  }

  async function save() {
    if (!memberId) return
    if (validation) {
      toast.error(validation)
      return
    }
    setBusy(true)
    try {
      await db.runTransaction(async (tx) => {
        const cur = await tx.get<BeverageProfile>(P.beverage(slug, memberId))
        if ((cur?.revision ?? 0) !== (mine.data?.revision ?? 0)) throw new DataError('REVISION_CONFLICT')
        const p: BeverageProfile = {
          level,
          portions: portionsOf(level),
          noAlcohol: level === 0,
          pct: level === 0 ? emptyPct() : { ...emptyPct(), ...pct },
          revision: (cur?.revision ?? 0) + 1,
          updatedAt: Date.now(),
        }
        tx.set(P.beverage(slug, memberId), p)
      })
      setDirty(false)
      toast.ok('Guardado')
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  const coverage = edition.date.startsAt ? `${attendeeProfiles.length} de ${attendees.length} asistentes confirmados respondieron` : `${profiles.length} respondieron (todavía sin asistentes confirmados)`

  return (
    <div>
      <PageHeader
        eyebrow="Para comprar lo que hace falta"
        title="Qué vas a tomar"
        intro="Primero cuánto, después qué. Sirve para calcular las compras, no es una recomendación."
        actions={settings.state === 'CLOSED' ? <Pill tone="muted">Cerrado</Pill> : settings.closeAt ? <Pill>{timeLeft(settings.closeAt, now)}</Pill> : null}
      />

      <div className="grid lg:grid-cols-[1.1fr_1fr] gap-4">
        <Card>
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor="nivel" className="h3">
              ¿Cuánto vas a tomar?
            </label>
            <span className="text-3xl font-extrabold tracking-tight text-accent">{level}%</span>
          </div>
          <input
            id="nivel"
            type="range"
            min={0}
            max={100}
            step={NIVEL_PASO}
            value={level}
            disabled={!open}
            onChange={(e) => {
              setDirty(true)
              setLevel(Number(e.target.value))
            }}
            className="slider mt-2"
            style={{ ['--fill' as string]: `${level}%` }}
            aria-valuetext={`${level}%: ${fraseNivel(level)}`}
          />
          <div className="flex justify-between tiny muted mt-1">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
          <p className="mt-3 font-semibold text-lg leading-snug" aria-live="polite">
            “{fraseNivel(level)}”
          </p>

          {level > 0 ? (
            <div className="mt-6">
              <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
                <p className="h3">¿Y qué tomás?</p>
                <Pill tone={total === 100 ? 'ok' : 'warn'}>{total}% {total === 100 ? '' : total < 100 ? `· te faltan ${100 - total}` : `· te pasaste por ${total - 100}`}</Pill>
              </div>
              <p className="tiny muted mb-3">Repartí el 100% entre las seis. Movés una barra y el resto lo ajustás vos.</p>
              <div className="flex gap-2 flex-wrap mb-3">
                <Button size="sm" variant="line" disabled={!open} onClick={() => preset('fernet')}>
                  100% fernet
                </Button>
                <Button size="sm" variant="line" disabled={!open} onClick={() => preset('cerveza')}>
                  100% cerveza
                </Button>
                <Button size="sm" variant="line" disabled={!open} onClick={() => preset('fernet', 'cerveza')}>
                  Mitad y mitad
                </Button>
              </div>
              {BEBIDAS.map((k) => (
                <div key={k} className="py-2.5 border-b border-line last:border-0">
                  <div className="flex items-center justify-between gap-3">
                    <label htmlFor={`pct-${k}`} className="font-semibold">
                      {BEBIDA_LABEL[k]}
                    </label>
                    <span className="font-bold tabular-nums w-14 text-right">{pct[k] ?? 0}%</span>
                  </div>
                  <input
                    id={`pct-${k}`}
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={pct[k] ?? 0}
                    disabled={!open}
                    onChange={(e) => setOne(k, Number(e.target.value))}
                    className="slider"
                    style={{ ['--fill' as string]: `${pct[k] ?? 0}%` }}
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="small muted mt-4">Con 0% no hace falta repartir nada. Igual contás para agua e hielo.</p>
          )}

          {open ? (
            <div className="flex items-center justify-between gap-3 mt-5 flex-wrap">
              <span className="tiny muted" aria-live="polite">
                {validation ?? 'Listo para guardar.'}
              </span>
              <Button variant="gold" onClick={() => void save()} loading={busy} disabled={!!validation || (!dirty && !!mine.data)}>
                {mine.data ? (dirty ? 'Guardar cambios' : 'Ya respondiste') : 'Guardar'}
              </Button>
            </div>
          ) : (
            <Notice tone="warn">Las bebidas están cerradas. {isAdmin ? 'Podés reabrir desde Administración.' : ''}</Notice>
          )}
        </Card>

        <div className="grid gap-4 content-start">
          <Card>
            <p className="h3">Cómo toma la banda</p>
            <p className="tiny muted mb-3">
              {coverage} · {summary.nonDrinkers} en 0% · nivel promedio {summary.avgLevel}%
            </p>
            {summary.totalServings === 0 ? <p className="small muted">Todavía no hay consumo declarado.</p> : null}
            {BEBIDAS.filter((k) => summary.share[k] > 0)
              .sort((a, b) => summary.share[b] - summary.share[a])
              .map((k) => (
                <div key={k} className="py-1.5">
                  <div className="flex justify-between small">
                    <span>{BEBIDA_LABEL[k]}</span>
                    <span className="muted">{summary.share[k]}%</span>
                  </div>
                  <div className="bar mt-1">
                    <span style={{ width: `${summary.share[k]}%` }} />
                  </div>
                </div>
              ))}
          </Card>
          <Card>
            <p className="h3">La lista de compras</p>
            <p className="tiny muted mb-2">
              Sale de las respuestas de asistentes confirmados, recetas, reserva del {settings.reservePct}% y stock.
              {settings.pendingScenario > 0 ? ` Incluye un escenario de ${settings.pendingScenario} sin responder.` : ''}
            </p>
            {!edition.date.startsAt ? <Notice tone="warn">Sin fecha confirmada, es una estimación con todas las respuestas. Con fecha y RSVP, usa sólo asistentes confirmados y suma agua e hielo.</Notice> : null}
            {purchases && purchases.lines.length > 0 ? (
              <div className="mt-2">
                {purchases.lines.map((l) => (
                  <div key={l.ingredientId} className="row items-start">
                    <div className="small">
                      <p className="font-semibold">
                        {l.label} {l.bought ? <Pill tone="ok" className="ml-1">Comprado</Pill> : null}
                      </p>
                      <p className="tiny muted">
                        Necesita {formatAmount(l.protectedAmount, l.unit)}
                        {l.stockUnits ? ` · stock ${l.stockUnits} ${l.envaseLabel.toLowerCase()}` : ''}
                        {l.responsibleId ? ` · ${members.aliasOf(l.responsibleId)}` : ''}
                        {l.assumption ? ` · ${l.assumption}` : ''}
                      </p>
                    </div>
                    <div className="text-right small whitespace-nowrap">
                      <b>{l.packs !== null ? `${l.packs} pack${l.packs === 1 ? '' : 's'} (${l.packs * (l.packUnits ?? 1)} u.)` : `${l.units} × ${l.envaseLabel}`}</b>
                      {l.packs !== null ? <p className="tiny muted">o {l.units} sueltas</p> : null}
                      {l.totalCents !== null ? <p className="tiny muted">{formatArs(l.totalCents)}</p> : null}
                    </div>
                  </div>
                ))}
                <div className="row">
                  <b>Total</b>
                  <b>
                    {formatArs(purchases.totalCents)} {purchases.pricesMissing ? <span className="tiny muted font-normal">(faltan precios)</span> : null}
                  </b>
                </div>
              </div>
            ) : (
              <p className="small muted">Por calcular.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
