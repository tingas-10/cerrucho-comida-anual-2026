// Bebidas y compras: parámetros de cálculo, stock, precios, responsables, cierre con snapshot.
import { useEffect, useMemo, useState } from 'react'
import { BEBIDAS, BEBIDA_LABEL } from '../../content/bebidas'
import { useSession } from '../../data/DataContext'
import { errorText, logAudit } from '../../data/actions'
import { useCollection, useEdition, useMembers } from '../../data/hooks'
import { P } from '../../data/paths'
import type { BeverageProfile, BeverageSettings, Rsvp } from '../../data/types'
import { computePurchases, formatAmount } from '../../domain/beverages'
import { formatArs, parseArs } from '../../domain/expenses'
import { localToMs, msToLocalParts } from '../../domain/format'
import { Button, Card, Field, Input, Loading, Notice, Pill } from '../../ui/components'
import { useToast } from '../../ui/toast'

export function AdminBebidas() {
  const { db, slug, memberId } = useSession()
  const toast = useToast()
  const { data: edition } = useEdition()
  const members = useMembers()
  const { rows: profiles } = useCollection<BeverageProfile>(P.beverages(slug))
  const { rows: rsvps } = useCollection<Rsvp>(P.rsvps(slug))
  const [s, setS] = useState<BeverageSettings | null>(null)
  const [closeDate, setCloseDate] = useState('')
  const [closeTime, setCloseTime] = useState('23:59')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (edition) {
      setS(edition.beverage)
      const p = msToLocalParts(edition.beverage.closeAt)
      setCloseDate(p.date)
      setCloseTime(p.time || '23:59')
    }
  }, [edition])

  const attendees = useMemo(() => (edition?.date.startsAt ? rsvps.filter((r) => r.status === 'YES' && r.planVersion === edition.planVersion).map((r) => r.id) : []), [rsvps, edition])
  const attendeeProfiles = useMemo(() => {
    const ids = new Set(attendees)
    return edition?.date.startsAt ? profiles.filter((p) => ids.has(p.id)) : profiles
  }, [profiles, attendees, edition])
  const purchases = useMemo(() => (s ? computePurchases(s, attendeeProfiles, attendees.length) : null), [s, attendeeProfiles, attendees])

  if (!edition || !s || !purchases) return <Loading />

  async function save(patch: Partial<BeverageSettings> = {}) {
    setBusy(true)
    try {
      const next: BeverageSettings = { ...s!, ...patch, closeAt: localToMs(closeDate, closeTime) }
      await db.updateDoc(P.edition(slug), { beverage: next, updatedAt: Date.now() })
      toast.ok('Guardado')
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  async function close() {
    setBusy(true)
    try {
      const units: Record<string, number> = {}
      for (const l of purchases!.lines) units[l.ingredientId] = l.packs !== null ? l.packs * (l.packUnits ?? 1) : l.units
      const snapshot = { version: (s!.snapshot?.version ?? 0) + 1, at: Date.now(), attendees: attendees.length, responses: attendeeProfiles.length, units }
      await db.updateDoc(P.edition(slug), { beverage: { ...s!, state: 'CLOSED', snapshot }, updatedAt: Date.now() })
      await logAudit(db, slug, memberId!, 'beverage.close', slug)
      toast.ok('Bebidas cerradas con snapshot v' + snapshot.version)
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  const stale = s.snapshot && purchases.lines.some((l) => (s.snapshot!.units[l.ingredientId] ?? 0) !== (l.packs !== null ? l.packs * (l.packUnits ?? 1) : l.units))

  return (
    <div className="grid gap-4">
      <Card>
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <p className="h3">
            Estado: {s.state === 'OPEN' ? <Pill tone="ok">Abierto</Pill> : <Pill tone="muted">Cerrado</Pill>}
            {s.snapshot ? <span className="tiny muted ml-2">snapshot v{s.snapshot.version} con {s.snapshot.responses} respuestas</span> : null}
          </p>
          <span className="flex gap-2">
            {s.state === 'OPEN' ? (
              <Button size="sm" onClick={() => void close()} loading={busy}>
                Cerrar y guardar snapshot
              </Button>
            ) : (
              <Button size="sm" variant="line" onClick={() => void save({ state: 'OPEN' })} loading={busy}>
                Reabrir
              </Button>
            )}
          </span>
        </div>
        {stale ? <Notice tone="warn">Cambiaron respuestas o asistentes desde el snapshot: la lista actual difiere. Cerrá de nuevo para una nueva versión.</Notice> : null}
        <div className="grid sm:grid-cols-5 gap-3 mt-3">
          <Field label="Reserva %" id="b-res">
            <Input id="b-res" type="number" value={s.reservePct} onChange={(e) => setS({ ...s, reservePct: Number(e.target.value) })} />
          </Field>
          <Field label="Agua ml/persona" id="b-water">
            <Input id="b-water" type="number" value={s.waterMlPerAttendee} onChange={(e) => setS({ ...s, waterMlPerAttendee: Number(e.target.value) })} />
          </Field>
          <Field label="Hielo g/persona" id="b-ice">
            <Input id="b-ice" type="number" value={s.iceGPerAttendee} onChange={(e) => setS({ ...s, iceGPerAttendee: Number(e.target.value) })} />
          </Field>
          <Field label="Escenario sin responder" id="b-pend" hint="Asistentes a imputar con el promedio (0 = no imputar)">
            <Input id="b-pend" type="number" min={0} value={s.pendingScenario} onChange={(e) => setS({ ...s, pendingScenario: Number(e.target.value) })} />
          </Field>
          <Field label="Cierre" id="b-close">
            <Input id="b-close" type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} />
          </Field>
        </div>
        <Button onClick={() => void save()} loading={busy}>
          Guardar parámetros
        </Button>
      </Card>

      <Card>
        <p className="h3 mb-1">Recetas (ml por porción)</p>
        <p className="tiny muted mb-3">Parámetros de cálculo, no instrucciones de preparación.</p>
        <div className="grid sm:grid-cols-2 gap-3">
          {BEBIDAS.map((k) => (
            <div key={k} className="rounded-xl border border-line p-3">
              <p className="font-semibold mb-2">{BEBIDA_LABEL[k]}</p>
              {Object.entries(s.recipes[k] ?? {}).map(([ing, ml]) => (
                <div key={ing} className="flex items-center justify-between gap-2 py-1">
                  <span className="small">{s.ingredients.find((i) => i.id === ing)?.label ?? ing}</span>
                  <input className="input w-24 text-right" type="number" value={ml} aria-label={`${BEBIDA_LABEL[k]} ${ing}`} onChange={(e) => setS({ ...s, recipes: { ...s.recipes, [k]: { ...s.recipes[k], [ing]: Number(e.target.value) } } })} />
                </div>
              ))}
            </div>
          ))}
        </div>
        <Button className="mt-3" onClick={() => void save()} loading={busy}>
          Guardar recetas
        </Button>
      </Card>

      <Card>
        <p className="h3 mb-1">Lista de compras</p>
        <p className="tiny muted mb-3">
          {attendees.length} asistentes confirmados · {attendeeProfiles.length} respondieron. Precios en pesos por envase; stock en envases.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {s.ingredients.map((ing) => {
            const l = purchases.lines.find((x) => x.ingredientId === ing.id)
            const setIng = (patch: Partial<typeof ing>) => setS({ ...s, ingredients: s.ingredients.map((x) => (x.id === ing.id ? { ...x, ...patch } : x)) })
            return (
              <div key={ing.id} className="rounded-xl border border-line p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold">{ing.label}</p>
                    <p className="tiny muted">Necesita {l ? formatAmount(l.protectedAmount, l.unit) : '—'}</p>
                  </div>
                  <p className="text-right">
                    <span className="tiny muted block">Comprar</span>
                    <b>{l ? (l.packs !== null ? `${l.packs} packs (${l.packs * (l.packUnits ?? 1)} u.)` : `${l.units} u.`) : '0'}</b>
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <label className="tiny muted">
                    Envase ({ing.unidad})
                    <input className="input mt-1" type="number" inputMode="numeric" aria-label={`Envase ${ing.label}`} value={ing.envaseMl} onChange={(e) => setIng({ envaseMl: Number(e.target.value) })} />
                  </label>
                  {ing.packUnidades ? (
                    <label className="tiny muted">
                      Unidades por pack
                      <input className="input mt-1" type="number" inputMode="numeric" aria-label={`Pack ${ing.label}`} value={ing.packUnidades} onChange={(e) => setIng({ packUnidades: Number(e.target.value) || undefined })} />
                    </label>
                  ) : null}
                  <label className="tiny muted">
                    Stock (envases)
                    <input className="input mt-1" type="number" inputMode="numeric" min={0} aria-label={`Stock ${ing.label}`} value={s.stock[ing.id] ?? 0} onChange={(e) => setS({ ...s, stock: { ...s.stock, [ing.id]: Number(e.target.value) } })} />
                  </label>
                  <label className="tiny muted">
                    Precio por envase
                    <input className="input mt-1" inputMode="decimal" aria-label={`Precio ${ing.label}`} value={s.prices[ing.id] ? String(s.prices[ing.id] / 100) : ''} placeholder="ARS" onChange={(e) => setS({ ...s, prices: { ...s.prices, [ing.id]: parseArs(e.target.value) ?? 0 } })} />
                  </label>
                  <label className="tiny muted col-span-2">
                    Responsable
                    <select className="input mt-1" aria-label={`Responsable ${ing.label}`} value={s.responsible[ing.id] ?? ''} onChange={(e) => setS({ ...s, responsible: { ...s.responsible, [ing.id]: e.target.value || null } })}>
                      <option value="">—</option>
                      {members.active.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.alias}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="flex items-center gap-2 small mt-3 min-h-[40px]">
                  <input type="checkbox" className="w-5 h-5" aria-label={`Comprado ${ing.label}`} checked={!!s.bought[ing.id]} onChange={(e) => setS({ ...s, bought: { ...s.bought, [ing.id]: e.target.checked } })} />
                  Ya está comprado
                </label>
              </div>
            )
          })}
        </div>
        <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
          <p className="small">
            Total: <b>{formatArs(purchases.totalCents)}</b> {purchases.pricesMissing ? <span className="tiny muted">(faltan precios)</span> : null}
          </p>
          <Button onClick={() => void save()} loading={busy}>
            Guardar compras
          </Button>
        </div>
      </Card>
    </div>
  )
}
