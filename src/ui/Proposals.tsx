// Propuestas de la banda (comida, lugar, salida): se ven al instante y se votan con 👍 / 👎.
import { ThumbsDown, ThumbsUp } from 'lucide-react'
import { useState } from 'react'
import { useSession } from '../data/DataContext'
import { errorText } from '../data/actions'
import { useCollection, useMembers } from '../data/hooks'
import { P } from '../data/paths'
import type { Proposal, ProposalType } from '../data/types'
import { Button, Card, Field, Input, Pill, Textarea } from './components'
import { useToast } from './toast'

const TYPE_LABEL: Record<ProposalType, string> = { food: 'comida', venue: 'lugar', afterparty: 'salida', date: 'fecha' }

export function ProposalsBoard({
  types,
  title = 'Propuestas de la banda',
  intro,
  typeOptions,
  placeholder,
}: {
  types: ProposalType[]
  title?: string
  intro?: string
  typeOptions?: Array<{ value: ProposalType; label: string }>
  placeholder?: string
}) {
  const { db, slug, memberId, isAdmin } = useSession()
  const toast = useToast()
  const members = useMembers()
  const { rows } = useCollection<Proposal>(P.proposals(slug))
  const [type, setType] = useState<ProposalType>(types[0])
  const [label, setLabel] = useState('')
  const [detail, setDetail] = useState('')
  const [link, setLink] = useState('')
  const [busy, setBusy] = useState(false)
  const list = rows
    .filter((p) => types.includes(p.type) && p.state !== 'WITHDRAWN' && p.state !== 'REJECTED')
    .sort((a, b) => score(b) - score(a) || b.createdAt - a.createdAt)

  function score(p: Proposal): number {
    const v = Object.values(p.votes ?? {})
    return v.filter((x) => x === 'up').length - v.filter((x) => x === 'down').length
  }

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
      const p: Proposal = { id, type, authorId: memberId, label: label.trim(), detail: detail.trim(), link: link.trim(), state: 'PENDING', votes: { [memberId]: 'up' }, createdAt: Date.now(), updatedAt: Date.now() }
      await db.setDoc(P.proposal(slug, id), p)
      setLabel('')
      setDetail('')
      setLink('')
      toast.ok('Propuesta publicada. Ya la puede votar la banda.')
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  async function vote(p: Proposal, v: 'up' | 'down') {
    if (!memberId) return
    const cur = p.votes?.[memberId]
    const votes = { ...(p.votes ?? {}) }
    if (cur === v) delete votes[memberId]
    else votes[memberId] = v
    try {
      await db.updateDoc(P.proposal(slug, p.id), { votes, updatedAt: Date.now() })
    } catch (e) {
      toast.error(errorText(e))
    }
  }

  async function withdraw(p: Proposal) {
    try {
      await db.updateDoc(P.proposal(slug, p.id), { state: 'WITHDRAWN', updatedAt: Date.now() })
    } catch (e) {
      toast.error(errorText(e))
    }
  }

  return (
    <div className="grid md:grid-cols-[1fr_1.3fr] gap-4">
      <Card>
        <p className="h3 mb-1">Proponer</p>
        {intro ? <p className="small muted mb-3">{intro}</p> : null}
        {typeOptions && typeOptions.length > 1 ? (
          <Field label="Qué proponés" id="prop-type">
            <select id="prop-type" className="input" value={type} onChange={(e) => setType(e.target.value as ProposalType)}>
              {typeOptions.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        <Field label="Nombre" id="prop-label">
          <Input id="prop-label" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} placeholder={placeholder} />
        </Field>
        <Field label="Detalle (opcional)" id="prop-detail">
          <Textarea id="prop-detail" value={detail} onChange={(e) => setDetail(e.target.value)} maxLength={300} placeholder="Costo aproximado, qué incluye, capacidad…" />
        </Field>
        <Field label="Link (opcional)" id="prop-link">
          <Input id="prop-link" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" inputMode="url" />
        </Field>
        <Button onClick={() => void submit()} loading={busy}>
          Publicar propuesta
        </Button>
      </Card>
      <Card>
        <p className="h3 mb-2">{title}</p>
        {list.length === 0 ? <p className="small muted">Todavía nadie propuso nada. Sé el primero.</p> : null}
        {list.map((p) => {
          const votes = Object.values(p.votes ?? {})
          const up = votes.filter((x) => x === 'up').length
          const down = votes.filter((x) => x === 'down').length
          const mine = memberId ? p.votes?.[memberId] : undefined
          return (
            <div key={p.id} className="row items-start">
              <div className="small min-w-0">
                <p className="font-semibold">
                  {p.label}
                  <span className="tiny muted font-normal">
                    {' '}
                    · {types.length > 1 ? TYPE_LABEL[p.type] + ' · ' : ''}
                    {members.aliasOf(p.authorId)}
                  </span>
                  {p.state === 'APPROVED' ? <Pill tone="ok" className="ml-2">Oficial</Pill> : null}
                </p>
                {p.detail ? <p className="muted">{p.detail}</p> : null}
                {p.link ? (
                  <a className="text-accent underline tiny" href={p.link} target="_blank" rel="noopener noreferrer">
                    link
                  </a>
                ) : null}
                {(p.authorId === memberId || isAdmin) && p.state === 'PENDING' ? (
                  <button type="button" className="tiny underline muted block min-h-[36px]" onClick={() => void withdraw(p)}>
                    Retirar
                  </button>
                ) : null}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button type="button" aria-pressed={mine === 'up'} aria-label="Me gusta" onClick={() => void vote(p, 'up')} className={`inline-flex items-center gap-1 min-h-[40px] px-2.5 rounded-full border text-sm ${mine === 'up' ? 'bg-ok-soft text-ok border-ok/40' : 'border-line'}`}>
                  <ThumbsUp size={16} /> {up}
                </button>
                <button type="button" aria-pressed={mine === 'down'} aria-label="No me gusta" onClick={() => void vote(p, 'down')} className={`inline-flex items-center gap-1 min-h-[40px] px-2.5 rounded-full border text-sm ${mine === 'down' ? 'bg-danger-soft text-danger border-danger/40' : 'border-line'}`}>
                  <ThumbsDown size={16} /> {down}
                </button>
              </div>
            </div>
          )
        })}
      </Card>
    </div>
  )
}
