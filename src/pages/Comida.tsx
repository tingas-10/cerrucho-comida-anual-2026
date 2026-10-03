// Comida y lugar: decisiones, encuestas, propuestas y restricciones alimentarias.
import { useEffect, useState } from 'react'
import { useSession } from '../data/DataContext'
import { errorText } from '../data/actions'
import { useCollection, useDoc, useEdition, useMembers } from '../data/hooks'
import { P } from '../data/paths'
import type { DietaryProfile, Poll, Proposal, ProposalType } from '../data/types'
import { formatArs } from '../domain/expenses'
import { Button, Card, Field, Input, Loading, Notice, PageHeader, Pill, Section, Textarea } from '../ui/components'
import { PollCard } from '../ui/PollCard'
import { useToast } from '../ui/toast'

const DIET_TAGS = [
  { key: 'vegetariano', label: 'Vegetariano' },
  { key: 'vegano', label: 'Vegano' },
  { key: 'sin_gluten', label: 'Sin gluten' },
  { key: 'alergia', label: 'Alergia' },
]

export function Comida() {
  const { slug } = useSession()
  const { data: edition, loading } = useEdition()
  const members = useMembers()
  const { rows: polls } = useCollection<Poll>(P.polls(slug))
  if (loading || !edition) return <Loading />
  const venuePolls = polls.filter((p) => p.kind === 'venue' && p.state !== 'DRAFT' && p.state !== 'VOID')
  const foodPolls = polls.filter((p) => p.kind === 'food' && p.state !== 'DRAFT' && p.state !== 'VOID')
  const customPolls = polls.filter((p) => p.kind === 'custom' && p.state !== 'DRAFT' && p.state !== 'VOID')
  return (
    <div>
      <PageHeader eyebrow="Esta edición" title="Comida y lugar" intro="Dos decisiones separadas: dónde y qué comemos. Proponé, aprobá varias opciones y Agus confirma la oficial." />

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <div className="flex justify-between items-center">
            <p className="h3">Lugar</p>
            {edition.venue ? <Pill tone={edition.venue.reserved ? 'ok' : 'warn'}>{edition.venue.reserved ? 'Reservado' : 'Pendiente de reserva'}</Pill> : <Pill tone="muted">Sin definir</Pill>}
          </div>
          {edition.venue ? (
            <div className="mt-2 small">
              <p className="font-semibold text-base">{edition.venue.name}</p>
              {edition.venue.address ? <p className="muted">{edition.venue.address}</p> : null}
              {edition.venue.link ? (
                <a className="text-accent underline" href={edition.venue.link} target="_blank" rel="noopener noreferrer">
                  Ver link
                </a>
              ) : null}
              {typeof edition.venue.costPerPersonCents === 'number' ? <p className="mt-1">Costo estimado: {formatArs(edition.venue.costPerPersonCents)} por persona</p> : null}
              {edition.venue.capacity ? <p className="muted">Capacidad: {edition.venue.capacity}</p> : null}
              {edition.venue.responsibleId ? <p className="muted">Responsable: {members.aliasOf(edition.venue.responsibleId)}</p> : null}
              {edition.venue.notes ? <p className="mt-1">{edition.venue.notes}</p> : null}
            </div>
          ) : (
            <p className="small muted mt-2">Todavía no hay lugar confirmado.</p>
          )}
        </Card>
        <Card>
          <div className="flex justify-between items-center">
            <p className="h3">Menú</p>
            {edition.menu ? <Pill tone="ok">Confirmado</Pill> : <Pill tone="muted">Sin definir</Pill>}
          </div>
          {edition.menu ? (
            <div className="mt-2 small">
              <p className="font-semibold text-base">{edition.menu.name}</p>
              {edition.menu.modality ? <p className="muted">{edition.menu.modality}</p> : null}
              {typeof edition.menu.costPerPersonCents === 'number' ? <p className="mt-1">Costo estimado: {formatArs(edition.menu.costPerPersonCents)} por persona</p> : null}
              {edition.menu.includes ? <p className="mt-1">Incluye: {edition.menu.includes}</p> : null}
              {edition.menu.compatibility ? <p className="muted">Compatibilidad: {edition.menu.compatibility}</p> : null}
              {edition.menu.responsibleId ? <p className="muted">Responsable: {members.aliasOf(edition.menu.responsibleId)}</p> : null}
            </div>
          ) : (
            <p className="small muted mt-2">Todavía no hay menú confirmado.</p>
          )}
        </Card>
      </div>

      {venuePolls.length || foodPolls.length || customPolls.length ? (
        <Section title="Votaciones">
          <div className="grid gap-4">
            {[...venuePolls, ...foodPolls, ...customPolls].map((p) => (
              <PollCard key={p.id} poll={p} aliasOf={members.aliasOf} />
            ))}
          </div>
        </Section>
      ) : null}

      <Section title="Propuestas">
        <Proposals />
      </Section>

      <Section title="Restricciones alimentarias">
        <Dietary summary={edition.dietarySummary ?? null} />
      </Section>
    </div>
  )
}

function Proposals() {
  const { db, slug, memberId } = useSession()
  const toast = useToast()
  const members = useMembers()
  const { rows } = useCollection<Proposal>(P.proposals(slug))
  const [type, setType] = useState<ProposalType>('food')
  const [label, setLabel] = useState('')
  const [detail, setDetail] = useState('')
  const [link, setLink] = useState('')
  const [busy, setBusy] = useState(false)
  const list = rows.filter((p) => (p.type === 'food' || p.type === 'venue') && p.state !== 'WITHDRAWN').sort((a, b) => b.createdAt - a.createdAt)

  async function submit() {
    if (!memberId) return
    if (label.trim().length < 2) {
      toast.error('Poné un nombre.')
      return
    }
    if (link && !/^https?:\/\//i.test(link.trim())) {
      toast.error('El link tiene que empezar con http:// o https://')
      return
    }
    setBusy(true)
    try {
      const id = db.newId()
      const p: Proposal = { id, type, authorId: memberId, label: label.trim(), detail: detail.trim(), link: link.trim(), state: 'PENDING', createdAt: Date.now(), updatedAt: Date.now() }
      await db.setDoc(P.proposal(slug, id), p)
      setLabel('')
      setDetail('')
      setLink('')
      toast.ok('Propuesta enviada. Agus la revisa y la publica como opción.')
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid md:grid-cols-[1fr_1.2fr] gap-4">
      <Card>
        <p className="h3 mb-3">Proponer</p>
        <Field label="Qué proponés" id="prop-type">
          <select id="prop-type" className="input" value={type} onChange={(e) => setType(e.target.value as ProposalType)}>
            <option value="food">Comida</option>
            <option value="venue">Lugar</option>
          </select>
        </Field>
        <Field label="Nombre" id="prop-label">
          <Input id="prop-label" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} placeholder={type === 'food' ? 'ej. Asado' : 'ej. Quincho de Topo'} />
        </Field>
        <Field label="Detalle (opcional)" id="prop-detail">
          <Textarea id="prop-detail" value={detail} onChange={(e) => setDetail(e.target.value)} maxLength={300} placeholder="Costo aproximado, qué incluye, capacidad…" />
        </Field>
        <Field label="Link (opcional)" id="prop-link">
          <Input id="prop-link" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" inputMode="url" />
        </Field>
        <Button onClick={() => void submit()} loading={busy}>
          Enviar propuesta
        </Button>
      </Card>
      <Card>
        <p className="h3 mb-2">Lo que propuso la banda</p>
        {list.length === 0 ? <p className="small muted">Todavía nadie propuso nada. Sé el primero.</p> : null}
        {list.map((p) => (
          <div key={p.id} className="row items-start">
            <div className="small">
              <p className="font-semibold">
                {p.label} <span className="tiny muted font-normal">· {p.type === 'food' ? 'comida' : 'lugar'} · {members.aliasOf(p.authorId)}</span>
              </p>
              {p.detail ? <p className="muted">{p.detail}</p> : null}
              {p.link ? (
                <a className="text-accent underline tiny" href={p.link} target="_blank" rel="noopener noreferrer">
                  link
                </a>
              ) : null}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {p.state === 'PENDING' ? <Pill tone="warn">Pendiente</Pill> : p.state === 'APPROVED' ? <Pill tone="ok">Publicada</Pill> : <Pill tone="muted">No va</Pill>}
              {p.authorId === memberId && p.state === 'PENDING' ? (
                <Button size="sm" variant="line" onClick={() => void db.updateDoc(P.proposal(slug, p.id), { state: 'WITHDRAWN', updatedAt: Date.now() })}>
                  Retirar
                </Button>
              ) : null}
            </div>
          </div>
        ))}
      </Card>
    </div>
  )
}

function Dietary({ summary }: { summary: Record<string, number> | null }) {
  const { db, slug, memberId } = useSession()
  const toast = useToast()
  const mine = useDoc<DietaryProfile>(memberId ? P.dietaryOf(slug, memberId) : null)
  const [tags, setTags] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    setTags(mine.data?.tags ?? [])
    setNote(mine.data?.note ?? '')
  }, [mine.data])
  async function save() {
    if (!memberId) return
    setBusy(true)
    try {
      await db.setDoc<DietaryProfile>(P.dietaryOf(slug, memberId), { tags, note: note.trim(), updatedAt: Date.now() })
      toast.ok('Guardado. Sólo lo ve Agus.')
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(false)
    }
  }
  const visible = summary ? Object.entries(summary).filter(([, n]) => n >= 3) : []
  const hidden = summary ? Object.values(summary).some((n) => n > 0 && n < 3) : false
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card>
        <p className="small muted mb-3">Opcional. Lo ve sólo Agus para organizar la comida. No pedimos historial médico.</p>
        <div className="grid grid-cols-2 gap-2 mb-3">
          {DIET_TAGS.map((t) => (
            <button key={t.key} type="button" className="choice" aria-pressed={tags.includes(t.key)} onClick={() => setTags((s) => (s.includes(t.key) ? s.filter((x) => x !== t.key) : [...s, t.key]))}>
              {t.label}
            </button>
          ))}
        </div>
        <Field label="Comentario" id="diet-note">
          <Textarea id="diet-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="ej. alergia al maní" />
        </Field>
        <Button onClick={() => void save()} loading={busy}>
          Guardar
        </Button>
      </Card>
      <Card>
        <p className="h3 mb-2">Para tener en cuenta</p>
        {!summary ? <p className="small muted">Agus todavía no publicó el resumen.</p> : null}
        {visible.map(([k, n]) => (
          <div key={k} className="row">
            <span className="small">{DIET_TAGS.find((t) => t.key === k)?.label ?? k}</span>
            <b>{n}</b>
          </div>
        ))}
        {summary && visible.length === 0 && !hidden ? <p className="small muted">Sin necesidades registradas.</p> : null}
        {hidden ? <Notice>Hay necesidades alimentarias a contemplar.</Notice> : null}
      </Card>
    </div>
  )
}
