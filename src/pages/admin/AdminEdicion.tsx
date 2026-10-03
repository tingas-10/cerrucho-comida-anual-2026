// Edición: estado, fecha oficial, lugar, menú, salida, agenda, resumen alimentario, archivo y año siguiente.
import { useEffect, useState } from 'react'
import { EDICION_ACTUAL } from '../../content/config'
import { FOTOS } from '../../content/galeria'
import { useSession } from '../../data/DataContext'
import { errorText, logAudit, pushNews, setDecision } from '../../data/actions'
import { useCollection, useEdition, useMembers } from '../../data/hooks'
import { P } from '../../data/paths'
import { ensureEdition } from '../../data/seed'
import type { AfterpartyInfo, ArchiveEntry, Award, Edition, FoodInfo, Poll, VenueInfo } from '../../data/types'
import { parseArs } from '../../domain/expenses'
import { fmtDayLong, fmtTime, localToMs, msToLocalParts } from '../../domain/format'
import { Button, Card, ConfirmDialog, Field, Input, Loading, Notice, Section, Textarea } from '../../ui/components'
import { useToast } from '../../ui/toast'
import { awardTitle } from '../Premios'

const STATES: Array<{ value: Edition['state']; label: string }> = [
  { value: 'DRAFT', label: 'Borrador' },
  { value: 'ORGANIZING', label: 'Organizando' },
  { value: 'CONFIRMED', label: 'Confirmada' },
  { value: 'RUNNING', label: 'En curso' },
  { value: 'CLOSED', label: 'Cerrada' },
  { value: 'ARCHIVED', label: 'Archivada' },
]

export function AdminEdicion() {
  const { db, slug, memberId } = useSession()
  const toast = useToast()
  const { data: edition, loading } = useEdition()
  const members = useMembers()
  const { rows: polls } = useCollection<Poll>(P.polls(slug))
  const { rows: awards } = useCollection<Award>(P.awards(slug))
  const [title, setTitle] = useState('')
  const [state, setState] = useState<Edition['state']>('DRAFT')
  const [hero, setHero] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('21:00')
  const [dateLabel, setDateLabel] = useState('')
  const [dateReason, setDateReason] = useState('')
  const [venue, setVenue] = useState<VenueInfo>({ name: '' })
  const [venueCost, setVenueCost] = useState('')
  const [menu, setMenu] = useState<FoodInfo>({ name: '' })
  const [menuCost, setMenuCost] = useState('')
  const [after, setAfter] = useState<AfterpartyInfo>({ name: '' })
  const [afterCost, setAfterCost] = useState('')
  const [agenda, setAgenda] = useState<Edition['agenda']>([])
  const [agendaPublished, setAgendaPublished] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [overrideCapacity, setOverrideCapacity] = useState(false)

  useEffect(() => {
    if (!edition) return
    setTitle(edition.title)
    setState(edition.state)
    setHero(edition.heroPhoto ?? '')
    const parts = msToLocalParts(edition.date.startsAt)
    setDate(parts.date)
    setTime(parts.time || '21:00')
    setDateLabel(edition.date.label ?? '')
    setVenue(edition.venue ?? { name: '' })
    setVenueCost(edition.venue?.costPerPersonCents ? String(edition.venue.costPerPersonCents / 100) : '')
    setMenu(edition.menu ?? { name: '' })
    setMenuCost(edition.menu?.costPerPersonCents ? String(edition.menu.costPerPersonCents / 100) : '')
    setAfter(edition.afterparty ?? { name: '' })
    setAfterCost(edition.afterparty?.entryCostCents ? String(edition.afterparty.entryCostCents / 100) : '')
    setAgenda(edition.agenda)
    setAgendaPublished(edition.agendaPublished)
  }, [edition])

  if (loading || !edition) return <Loading />

  async function run(key: string, fn: () => Promise<void>, okText = 'Guardado') {
    setBusy(key)
    try {
      await fn()
      toast.ok(okText)
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(null)
    }
  }

  const confirmedCount = 0 // se calcula en Miembros; acá sólo se valida capacidad declarada

  return (
    <div className="grid gap-4">
      <Card>
        <p className="h3 mb-3">Datos generales</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Título" id="ed-title">
            <Input id="ed-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Estado" id="ed-state" hint="El estado general no abre ni cierra votaciones por sí solo.">
            <select id="ed-state" className="input" value={state} onChange={(e) => setState(e.target.value as Edition['state'])}>
              {STATES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Foto de portada" id="ed-hero">
          <select id="ed-hero" className="input" value={hero} onChange={(e) => setHero(e.target.value)}>
            {FOTOS.filter((f) => f.kind === 'photo').map((f) => (
              <option key={f.id} value={f.src}>
                {f.caption ?? f.src.split('/').pop()}
              </option>
            ))}
          </select>
        </Field>
        <Button
          onClick={() =>
            void run('general', async () => {
              await db.updateDoc(P.edition(slug), { title: title.trim(), state, heroPhoto: hero, updatedAt: Date.now() })
            })
          }
          loading={busy === 'general'}
        >
          Guardar
        </Button>
      </Card>

      <Card>
        <p className="h3">Fecha oficial</p>
        <p className="small muted mb-3">
          {edition.date.startsAt ? `Hoy: ${fmtDayLong(edition.date.startsAt)} · ${fmtTime(edition.date.startsAt)} h (plan v${edition.planVersion}).` : 'Sin definir. Lo normal es confirmarla desde la consulta de fechas en Decisiones; acá se puede fijar o cambiar a mano.'}
        </p>
        <div className="grid sm:grid-cols-[1fr_120px_1fr] gap-3">
          <Field label="Día" id="ed-date">
            <Input id="ed-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Hora" id="ed-time">
            <Input id="ed-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
          <Field label="Nota (opcional)" id="ed-dlabel">
            <Input id="ed-dlabel" value={dateLabel} onChange={(e) => setDateLabel(e.target.value)} placeholder="ej. llegar 21:30" />
          </Field>
        </div>
        {edition.date.startsAt ? (
          <Field label="Motivo del cambio (obligatorio si cambia la fecha)" id="ed-dreason">
            <Input id="ed-dreason" value={dateReason} onChange={(e) => setDateReason(e.target.value)} />
          </Field>
        ) : null}
        <Button
          variant="gold"
          loading={busy === 'date'}
          onClick={() => {
            const ms = localToMs(date, time)
            if (!ms) {
              toast.error('Elegí día y hora.')
              return
            }
            const changing = !!edition.date.startsAt && edition.date.startsAt !== ms
            if (changing && !dateReason.trim()) {
              toast.error('Indicá el motivo del cambio.')
              return
            }
            void run('date', async () => {
              const planVersion = changing ? edition.planVersion + 1 : edition.planVersion
              await db.updateDoc(P.edition(slug), {
                date: { startsAt: ms, label: dateLabel.trim(), confirmedAt: Date.now(), confirmedBy: memberId, reason: dateReason.trim() },
                planVersion,
                state: edition.state === 'DRAFT' || edition.state === 'ORGANIZING' ? 'CONFIRMED' : edition.state,
                updatedAt: Date.now(),
              })
              await setDecision(db, slug, 'fecha', { status: 'CONFIRMED', label: `${fmtDayLong(ms)} · ${fmtTime(ms)} h`, confirmedBy: memberId, confirmedAt: Date.now(), reason: dateReason.trim() })
              await pushNews(db, slug, changing ? `Cambió la fecha: ${fmtDayLong(ms)}. Hay que reconfirmar asistencia.` : `Fecha confirmada: ${fmtDayLong(ms)} a las ${fmtTime(ms)} h.`)
              await logAudit(db, slug, memberId!, changing ? 'edition.date.change' : 'edition.date.confirm', slug, dateReason.trim())
              setDateReason('')
            }, changing ? 'Fecha cambiada. Los RSVP necesitan reconfirmar.' : 'Fecha confirmada')
          }}
        >
          {edition.date.startsAt ? 'Cambiar fecha' : 'Confirmar fecha'}
        </Button>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <p className="h3 mb-3">Lugar</p>
          <Field label="Nombre" id="v-name">
            <Input id="v-name" value={venue.name} onChange={(e) => setVenue({ ...venue, name: e.target.value })} />
          </Field>
          <Field label="Dirección" id="v-addr">
            <Input id="v-addr" value={venue.address ?? ''} onChange={(e) => setVenue({ ...venue, address: e.target.value })} />
          </Field>
          <Field label="Link" id="v-link">
            <Input id="v-link" value={venue.link ?? ''} onChange={(e) => setVenue({ ...venue, link: e.target.value })} placeholder="https://" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Capacidad" id="v-cap">
              <Input id="v-cap" type="number" value={venue.capacity ?? ''} onChange={(e) => setVenue({ ...venue, capacity: e.target.value ? Number(e.target.value) : null })} />
            </Field>
            <Field label="Costo por persona (ARS)" id="v-cost">
              <Input id="v-cost" inputMode="decimal" value={venueCost} onChange={(e) => setVenueCost(e.target.value)} />
            </Field>
          </div>
          <Field label="Responsable" id="v-resp">
            <select id="v-resp" className="input" value={venue.responsibleId ?? ''} onChange={(e) => setVenue({ ...venue, responsibleId: e.target.value || null })}>
              <option value="">—</option>
              {members.active.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.alias}
                </option>
              ))}
            </select>
          </Field>
          <label className="flex items-center gap-2 mb-3 small">
            <input type="checkbox" checked={!!venue.reserved} onChange={(e) => setVenue({ ...venue, reserved: e.target.checked })} /> Reserva confirmada
          </label>
          <Field label="Notas" id="v-notes">
            <Textarea id="v-notes" value={venue.notes ?? ''} onChange={(e) => setVenue({ ...venue, notes: e.target.value })} />
          </Field>
          {venue.capacity && venue.capacity < confirmedCount && !overrideCapacity ? (
            <Notice tone="warn">
              La capacidad es menor que los asistentes.{' '}
              <button type="button" className="underline" onClick={() => setOverrideCapacity(true)}>
                Confirmar igual
              </button>
            </Notice>
          ) : null}
          <div className="flex gap-2 mt-2">
            <Button
              loading={busy === 'venue'}
              onClick={() => {
                if (venue.link && !/^https?:\/\//i.test(venue.link)) {
                  toast.error('El link tiene que empezar con http(s)://')
                  return
                }
                void run('venue', async () => {
                  const v: VenueInfo = { ...venue, costPerPersonCents: venueCost ? parseArs(venueCost) : null }
                  await db.updateDoc(P.edition(slug), { venue: v.name.trim() ? v : null, updatedAt: Date.now() })
                  await setDecision(db, slug, 'lugar', v.name.trim() ? { status: v.reserved ? 'CONFIRMED' : 'PENDING_RESERVATION', label: v.name, confirmedBy: memberId, confirmedAt: Date.now() } : { status: 'UNDEFINED' })
                  if (v.name.trim()) await pushNews(db, slug, `Lugar: ${v.name}${v.reserved ? ' (reservado)' : ' (pendiente de reserva)'}.`)
                  await logAudit(db, slug, memberId!, 'edition.venue', slug)
                })
              }}
            >
              Guardar lugar
            </Button>
          </div>
        </Card>
        <Card>
          <p className="h3 mb-3">Menú</p>
          <Field label="Nombre" id="m-name">
            <Input id="m-name" value={menu.name} onChange={(e) => setMenu({ ...menu, name: e.target.value })} />
          </Field>
          <Field label="Modalidad" id="m-mod">
            <Input id="m-mod" value={menu.modality ?? ''} onChange={(e) => setMenu({ ...menu, modality: e.target.value })} placeholder="ej. parrilla en casa" />
          </Field>
          <Field label="Costo por persona (ARS)" id="m-cost">
            <Input id="m-cost" inputMode="decimal" value={menuCost} onChange={(e) => setMenuCost(e.target.value)} />
          </Field>
          <Field label="Incluye" id="m-inc">
            <Input id="m-inc" value={menu.includes ?? ''} onChange={(e) => setMenu({ ...menu, includes: e.target.value })} />
          </Field>
          <Field label="Compatibilidad alimentaria declarada" id="m-comp">
            <Input id="m-comp" value={menu.compatibility ?? ''} onChange={(e) => setMenu({ ...menu, compatibility: e.target.value })} placeholder="ej. hay opción vegetariana" />
          </Field>
          <Field label="Responsable" id="m-resp">
            <select id="m-resp" className="input" value={menu.responsibleId ?? ''} onChange={(e) => setMenu({ ...menu, responsibleId: e.target.value || null })}>
              <option value="">—</option>
              {members.active.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.alias}
                </option>
              ))}
            </select>
          </Field>
          <Button
            loading={busy === 'menu'}
            onClick={() =>
              void run('menu', async () => {
                const m: FoodInfo = { ...menu, costPerPersonCents: menuCost ? parseArs(menuCost) : null }
                await db.updateDoc(P.edition(slug), { menu: m.name.trim() ? m : null, updatedAt: Date.now() })
                await setDecision(db, slug, 'menu', m.name.trim() ? { status: 'CONFIRMED', label: m.name, confirmedBy: memberId, confirmedAt: Date.now() } : { status: 'UNDEFINED' })
                if (m.name.trim()) await pushNews(db, slug, `Menú confirmado: ${m.name}.`)
                await logAudit(db, slug, memberId!, 'edition.menu', slug)
              })
            }
          >
            Guardar menú
          </Button>
        </Card>
      </div>

      <Card>
        <p className="h3 mb-3">Salida</p>
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Lugar" id="a-name">
            <Input id="a-name" value={after.name} onChange={(e) => setAfter({ ...after, name: e.target.value })} />
          </Field>
          <Field label="Zona" id="a-zone">
            <Input id="a-zone" value={after.zone ?? ''} onChange={(e) => setAfter({ ...after, zone: e.target.value })} />
          </Field>
          <Field label="Entrada (ARS)" id="a-cost">
            <Input id="a-cost" inputMode="decimal" value={afterCost} onChange={(e) => setAfterCost(e.target.value)} />
          </Field>
          <Field label="Link" id="a-link">
            <Input id="a-link" value={after.link ?? ''} onChange={(e) => setAfter({ ...after, link: e.target.value })} placeholder="https://" />
          </Field>
          <Field label="Dress code" id="a-dress">
            <Input id="a-dress" value={after.dressCode ?? ''} onChange={(e) => setAfter({ ...after, dressCode: e.target.value })} />
          </Field>
          <Field label="Responsable" id="a-resp">
            <select id="a-resp" className="input" value={after.responsibleId ?? ''} onChange={(e) => setAfter({ ...after, responsibleId: e.target.value || null })}>
              <option value="">—</option>
              {members.active.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.alias}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <label className="flex items-center gap-2 mb-3 small">
          <input type="checkbox" checked={!!after.reserved} onChange={(e) => setAfter({ ...after, reserved: e.target.checked })} /> Reserva confirmada
        </label>
        <Button
          loading={busy === 'after'}
          onClick={() =>
            void run('after', async () => {
              const a: AfterpartyInfo = { ...after, entryCostCents: afterCost ? parseArs(afterCost) : null }
              await db.updateDoc(P.edition(slug), { afterparty: a.name.trim() ? a : null, updatedAt: Date.now() })
              await setDecision(db, slug, 'salida', a.name.trim() ? { status: a.reserved ? 'CONFIRMED' : 'PENDING_RESERVATION', label: a.name, confirmedBy: memberId, confirmedAt: Date.now() } : { status: 'UNDEFINED' })
              await logAudit(db, slug, memberId!, 'edition.afterparty', slug)
            })
          }
        >
          Guardar salida
        </Button>
      </Card>

      <Card>
        <p className="h3">Agenda de la noche</p>
        <p className="small muted mb-3">Los offsets son sugerencias desde la llegada. "Sugerir horarios" los calcula desde la hora oficial; después ajustá a mano y publicá.</p>
        <div className="flex gap-2 mb-3 flex-wrap">
          <Button
            size="sm"
            variant="line"
            disabled={!edition.date.startsAt}
            onClick={() => setAgenda((a) => a.map((i) => ({ ...i, startsAt: edition.date.startsAt! + i.offsetMin * 60000 })))}
          >
            Sugerir horarios
          </Button>
          <label className="flex items-center gap-2 small">
            <input type="checkbox" checked={agendaPublished} onChange={(e) => setAgendaPublished(e.target.checked)} /> Publicar horarios
          </label>
        </div>
        {agenda.map((item, i) => (
          <div key={item.key} className="grid grid-cols-2 sm:grid-cols-[1fr_110px_1fr] gap-x-2 items-end py-2 border-b border-line last:border-0">
            <Field label={`Etapa ${i + 1}`} id={`ag-l-${i}`}>
              <Input id={`ag-l-${i}`} value={item.label} onChange={(e) => setAgenda((a) => a.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
            </Field>
            <Field label="Hora" id={`ag-t-${i}`}>
              <Input
                id={`ag-t-${i}`}
                type="time"
                value={msToLocalParts(item.startsAt).time}
                onChange={(e) => {
                  const base = msToLocalParts(edition.date.startsAt).date
                  setAgenda((a) => a.map((x, j) => (j === i ? { ...x, startsAt: base ? localToMs(base, e.target.value) : null } : x)))
                }}
              />
            </Field>
            <Field label="Responsable" id={`ag-r-${i}`}>
              <select id={`ag-r-${i}`} className="input" value={item.responsibleId ?? ''} onChange={(e) => setAgenda((a) => a.map((x, j) => (j === i ? { ...x, responsibleId: e.target.value || null } : x)))}>
                <option value="">—</option>
                {members.active.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.alias}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        ))}
        <Button className="mt-3" loading={busy === 'agenda'} onClick={() => void run('agenda', async () => db.updateDoc(P.edition(slug), { agenda, agendaPublished, updatedAt: Date.now() }))}>
          Guardar agenda
        </Button>
      </Card>

      <Section title="Cierre de la edición" className="mt-2">
        <Card>
          <p className="small muted">Archivar exige que no haya votaciones abiertas. Guarda en el Archivo la comida anual y los premios ya revelados; lo no revelado nunca se publica.</p>
          <div className="flex gap-2 mt-3 flex-wrap">
            <Button variant="line" onClick={() => setArchiveOpen(true)}>
              Archivar {edition.title}
            </Button>
            <Button
              variant="line"
              loading={busy === 'next'}
              onClick={() =>
                void run('next', async () => {
                  const next = String(edition.year + 1)
                  if (await db.getDoc(P.edition(next))) throw new Error('Ya existe la edición ' + next)
                  await ensureEdition(db, next, edition.year + 1, `Comida anual ${edition.year + 1}`)
                  await logAudit(db, slug, memberId!, 'edition.create', next)
                }, `Edición ${edition.year + 1} creada. Para activarla hay que cambiar EDICION_ACTUAL en el código (pedíselo a Claude).`)
              }
            >
              Crear edición {edition.year + 1}
            </Button>
          </div>
          <p className="tiny muted mt-2">La edición activa que ven todos es {EDICION_ACTUAL.slug}.</p>
        </Card>
      </Section>

      <ConfirmDialog
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        title="Archivar edición"
        text="Se marca como archivada y se publica en el Archivo con los premios ya revelados. Anotá pendientes si quedó algo sin resolver."
        requireReason
        confirmLabel="Archivar"
        loading={busy === 'archive'}
        onConfirm={async (reason) => {
          const openPolls = polls.filter((p) => p.state === 'OPEN')
          const openAwards = awards.filter((a) => a.state === 'ROUND1_OPEN' || a.state === 'ROUND2_OPEN')
          if (openPolls.length || openAwards.length) {
            toast.error('Hay votaciones abiertas. Cerralas antes de archivar.')
            return
          }
          await run('archive', async () => {
            const entry: ArchiveEntry = {
              slug,
              title: edition.title,
              year: edition.year,
              date: edition.date.startsAt ? fmtDayLong(edition.date.startsAt) : undefined,
              venue: edition.venue?.name,
              awards: awards
                .filter((a) => a.state === 'REVEALED' && a.result)
                .sort((a, b) => a.order - b.order)
                .map((a) => ({ label: awardTitle(a, edition.year), winner: resultText(a.result!, members.aliasOf), manual: a.result!.manual })),
              updatedAt: Date.now(),
            }
            await db.setDoc(P.archiveEntry(slug), entry)
            await db.updateDoc(P.edition(slug), { state: 'ARCHIVED', updatedAt: Date.now() })
            await logAudit(db, slug, memberId!, 'edition.archive', slug, reason)
            setArchiveOpen(false)
          }, 'Edición archivada')
        }}
      />
    </div>
  )
}

function resultText(r: Award['result'] & object, aliasOf: (k: string) => string): string {
  if (r.outcome === 'WINNER' && r.winner) return aliasOf(r.winner)
  if (r.outcome === 'TIE') return 'EMPATE: ' + (r.tied ?? []).map(aliasOf).join(' · ')
  if (r.outcome === 'DESERTED') return 'DESIERTO'
  return 'SIN VOTOS'
}

