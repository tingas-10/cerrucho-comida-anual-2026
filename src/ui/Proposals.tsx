// Opciones de lugar, comida o salida: cualquiera de la banda propone, pasan directo a votación (👍/👎)
// y el presidente (o Agus) confirma la definitiva. "Más votado" y "Confirmado" se muestran por separado.
import { Pencil, Plus, ThumbsDown, ThumbsUp, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useSession } from '../data/DataContext'
import { errorText, logAudit } from '../data/actions'
import { clearDecision, confirmProposal } from '../data/decisions'
import { useCollection, useEdition, useMembers } from '../data/hooks'
import { P } from '../data/paths'
import type { Proposal, ProposalType } from '../data/types'
import { fmtDayLong } from '../domain/format'
import { Button, Card, ConfirmDialog, Field, Input, LoginPrompt, Modal, Pill, Textarea } from './components'
import { useToast } from './toast'

function score(p: Proposal): { up: number; down: number; net: number } {
  const v = Object.values(p.votes ?? {})
  const up = v.filter((x) => x === 'up').length
  const down = v.filter((x) => x === 'down').length
  return { up, down, net: up - down }
}

export function ProposalsBoard({ type, title, placeholder, decisionKey }: { type: ProposalType; title: string; placeholder?: string; decisionKey: 'lugar' | 'menu' | 'salida' }) {
  const { db, slug, memberId, isMember, isAdmin, canDecide } = useSession()
  const toast = useToast()
  const members = useMembers()
  const { data: edition } = useEdition()
  const { rows } = useCollection<Proposal>(P.proposals(slug))
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Proposal | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<Proposal | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Proposal | null>(null)
  const decision = edition?.decisions?.[decisionKey]
  const confirmedId = decision?.status === 'CONFIRMED' ? (decision.proposalId ?? null) : null
  const list = rows
    .filter((p) => p.type === type && p.state !== 'WITHDRAWN' && p.state !== 'REJECTED')
    .sort((a, b) => score(b).net - score(a).net || score(b).up - score(a).up || a.createdAt - b.createdAt)
  const topNet = list.length ? score(list[0]).net : 0
  const topCount = list.filter((p) => score(p).net === topNet).length

  async function vote(p: Proposal, v: 'up' | 'down') {
    if (!memberId) return
    const votes = { ...(p.votes ?? {}) }
    if (votes[memberId] === v) delete votes[memberId]
    else votes[memberId] = v
    try {
      await db.updateDoc(P.proposal(slug, p.id), { votes, updatedAt: Date.now() })
    } catch (e) {
      toast.error('No se guardó tu voto: ' + errorText(e))
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="h3">{title}</p>
        {isMember ? (
          <Button size="sm" variant="line" onClick={() => setAdding(true)}>
            <Plus size={16} /> Proponer
          </Button>
        ) : null}
      </div>
      {decision?.status === 'CONFIRMED' && !confirmedId && decision.label ? (
        <p className="small mb-2">
          Confirmado: <b>{decision.label}</b>
        </p>
      ) : null}
      {list.length === 0 ? <p className="small muted">Todavía no hay opciones.</p> : null}
      {list.map((p) => {
        const s = score(p)
        const mine = memberId ? p.votes?.[memberId] : undefined
        const isTop = s.net === topNet && s.net > 0
        const isConfirmed = confirmedId === p.id
        return (
          <div key={p.id} className={`py-3 border-b border-line last:border-0 ${isConfirmed ? 'bg-ok-soft/40 -mx-2 px-2 rounded-lg' : ''}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold break-words">{p.label}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {isConfirmed ? (
                    <Pill tone="ok">
                      Confirmado{decision?.confirmedBy ? ` por ${members.aliasOf(decision.confirmedBy)}` : ''}
                    </Pill>
                  ) : null}
                  {isTop ? <Pill>{topCount > 1 ? 'Empatado arriba' : 'Más votado'}</Pill> : null}
                </div>
                {p.detail ? <p className="small muted mt-1 break-words">{p.detail}</p> : null}
                {p.link ? (
                  <a className="text-accent underline tiny" href={p.link} target="_blank" rel="noopener noreferrer">
                    Ver link
                  </a>
                ) : null}
                <p className="tiny muted mt-1">{p.seed ? 'Opción inicial' : `Propuso ${members.aliasOf(p.authorId)}`}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {isMember ? (
                  <>
                    <button type="button" aria-pressed={mine === 'up'} aria-label={`Me gusta ${p.label}`} onClick={() => void vote(p, 'up')} className={`inline-flex items-center gap-1 min-h-[44px] px-3 rounded-full border text-sm ${mine === 'up' ? 'bg-ok-soft text-ok border-ok/40' : 'border-line'}`}>
                      <ThumbsUp size={16} /> {s.up}
                    </button>
                    <button type="button" aria-pressed={mine === 'down'} aria-label={`No me gusta ${p.label}`} onClick={() => void vote(p, 'down')} className={`inline-flex items-center gap-1 min-h-[44px] px-3 rounded-full border text-sm ${mine === 'down' ? 'bg-danger-soft text-danger border-danger/40' : 'border-line'}`}>
                      <ThumbsDown size={16} /> {s.down}
                    </button>
                  </>
                ) : (
                  <span className="small muted whitespace-nowrap">
                    👍 {s.up} · 👎 {s.down}
                  </span>
                )}
              </div>
            </div>
            {canDecide || isAdmin || (p.authorId === memberId && !p.seed) ? (
              <div className="flex flex-wrap gap-2 mt-2">
                {canDecide && !isConfirmed ? (
                  <Button size="sm" variant="gold" onClick={() => setConfirmTarget(p)}>
                    Confirmar como definitivo
                  </Button>
                ) : null}
                {canDecide && isConfirmed ? (
                  <Button size="sm" variant="line" onClick={() => void clearDecision(db, slug, decisionKey, memberId!).catch((e) => toast.error(errorText(e)))}>
                    Quitar confirmación
                  </Button>
                ) : null}
                {isAdmin ? (
                  <Button size="sm" variant="line" onClick={() => setEditing(p)} aria-label={`Editar ${p.label}`}>
                    <Pencil size={14} /> Editar
                  </Button>
                ) : null}
                {isAdmin ? (
                  <Button size="sm" variant="line" onClick={() => setDeleteTarget(p)} aria-label={`Borrar ${p.label}`}>
                    <Trash2 size={14} />
                  </Button>
                ) : p.authorId === memberId && !p.seed ? (
                  <Button size="sm" variant="line" onClick={() => void db.updateDoc(P.proposal(slug, p.id), { state: 'WITHDRAWN', updatedAt: Date.now() }).catch((e) => toast.error(errorText(e)))}>
                    Retirar
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        )
      })}
      {!isMember ? (
        <div className="mt-3">
          <LoginPrompt text="Entrá para votar o proponer." />
        </div>
      ) : null}

      <AddProposal open={adding} onClose={() => setAdding(false)} type={type} title={title} placeholder={placeholder} />
      <EditProposal proposal={editing} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={!!confirmTarget}
        onClose={() => setConfirmTarget(null)}
        title="Confirmar como definitivo"
        text={`"${confirmTarget?.label}" pasa a ser la opción confirmada${decision?.confirmedAt ? ` (reemplaza la confirmada el ${fmtDayLong(decision.confirmedAt)})` : ''}. La votación sigue visible como referencia.`}
        confirmLabel="Confirmar"
        onConfirm={async () => {
          try {
            await confirmProposal(db, slug, confirmTarget!, memberId!)
            toast.ok('Confirmado')
          } catch (e) {
            toast.error(errorText(e))
          } finally {
            setConfirmTarget(null)
          }
        }}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Borrar opción"
        text={`Se borra "${deleteTarget?.label}" con sus votos.`}
        danger
        confirmLabel="Borrar"
        onConfirm={async () => {
          try {
            await db.deleteDoc(P.proposal(slug, deleteTarget!.id))
            await logAudit(db, slug, memberId!, 'propuesta.borrar', deleteTarget!.id)
          } catch (e) {
            toast.error(errorText(e))
          } finally {
            setDeleteTarget(null)
          }
        }}
      />
    </Card>
  )
}

function AddProposal({ open, onClose, type, title, placeholder }: { open: boolean; onClose: () => void; type: ProposalType; title: string; placeholder?: string }) {
  const { db, slug, memberId } = useSession()
  const toast = useToast()
  const [label, setLabel] = useState('')
  const [detail, setDetail] = useState('')
  const [link, setLink] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit() {
    if (!memberId) return
    if (label.trim().length < 2) return toast.error('Poné un nombre.')
    if (link && !/^https?:\/\//i.test(link.trim())) return toast.error('El link tiene que empezar con http:// o https://')
    setBusy(true)
    try {
      const id = db.newId()
      const p: Proposal = { id, type, authorId: memberId, label: label.trim(), detail: detail.trim(), link: link.trim(), state: 'PENDING', votes: { [memberId]: 'up' }, createdAt: Date.now(), updatedAt: Date.now() }
      await db.setDoc(P.proposal(slug, id), p)
      setLabel('')
      setDetail('')
      setLink('')
      toast.ok('Listo, ya la puede votar la banda.')
      onClose()
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal open={open} onClose={onClose} title={`Proponer · ${title}`}>
      <Field label="Nombre" id={`np-label-${type}`}>
        <Input id={`np-label-${type}`} value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} placeholder={placeholder} />
      </Field>
      <Field label="Detalle (opcional)" id={`np-detail-${type}`}>
        <Textarea id={`np-detail-${type}`} value={detail} onChange={(e) => setDetail(e.target.value)} maxLength={300} placeholder="Costo aproximado, qué incluye, capacidad…" />
      </Field>
      <Field label="Link (opcional)" id={`np-link-${type}`}>
        <Input id={`np-link-${type}`} value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" inputMode="url" autoCapitalize="none" />
      </Field>
      <Button variant="gold" className="w-full" onClick={() => void submit()} loading={busy}>
        Publicar para votar
      </Button>
    </Modal>
  )
}

function EditProposal({ proposal, onClose }: { proposal: Proposal | null; onClose: () => void }) {
  const { db, slug } = useSession()
  const toast = useToast()
  const [label, setLabel] = useState('')
  const [detail, setDetail] = useState('')
  const [seenId, setSeenId] = useState<string | null>(null)
  if (proposal && proposal.id !== seenId) {
    setSeenId(proposal.id)
    setLabel(proposal.label)
    setDetail(proposal.detail ?? '')
  }
  async function save() {
    if (!proposal || label.trim().length < 2) return
    try {
      await db.updateDoc(P.proposal(slug, proposal.id), { label: label.trim(), detail: detail.trim(), updatedAt: Date.now() })
      toast.ok('Guardado')
      onClose()
    } catch (e) {
      toast.error(errorText(e))
    }
  }
  return (
    <Modal open={!!proposal} onClose={onClose} title="Editar opción">
      <Field label="Nombre" id="ep-label">
        <Input id="ep-label" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} />
      </Field>
      <Field label="Detalle" id="ep-detail">
        <Textarea id="ep-detail" value={detail} onChange={(e) => setDetail(e.target.value)} maxLength={300} />
      </Field>
      <Button variant="gold" onClick={() => void save()}>
        Guardar
      </Button>
    </Modal>
  )
}
