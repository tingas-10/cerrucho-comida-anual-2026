// Miembros: alta, mail, suspensión, participación, padrón VAO, vincular borrador con el propietario, importar CSV.
import { Copy } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSession } from '../../data/DataContext'
import { errorText, logAudit } from '../../data/actions'
import { useCollection, useEdition, useMembers } from '../../data/hooks'
import { P } from '../../data/paths'
import { OWNER_ID, newMember, slugify } from '../../data/seed'
import type { Member, MemberPrivate } from '../../data/types'
import { Avatar, Button, Card, ConfirmDialog, Field, Input, Loading, Modal, Notice, Pill, Textarea } from '../../ui/components'
import { useToast } from '../../ui/toast'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export function AdminMiembros() {
  const { db, slug, memberId } = useSession()
  const toast = useToast()
  const members = useMembers()
  const { data: edition } = useEdition()
  const { rows: privates } = useCollection<MemberPrivate>(P.memberPrivates)
  const emailOf = useMemo(() => Object.fromEntries(privates.map((p) => [p.id, p.email])), [privates])
  const [editing, setEditing] = useState<Member | null>(null)
  const [alias, setAlias] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [csv, setCsv] = useState('')
  const [linkDraft, setLinkDraft] = useState<Member | null>(null)
  const [filter, setFilter] = useState('')

  if (members.loading) return <Loading />

  function openEdit(m: Member | null) {
    setEditing(m)
    setAlias(m?.alias ?? '')
    setName(m?.name ?? '')
    setEmail(m ? (emailOf[m.id] ?? '') : '')
    setNewOpen(true)
  }

  async function save() {
    const a = alias.trim()
    const e = email.trim().toLowerCase()
    if (a.length < 2) {
      toast.error('Alias muy corto.')
      return
    }
    if (e && !EMAIL_RE.test(e)) {
      toast.error('Mail inválido.')
      return
    }
    if (e && privates.some((p) => p.email === e && p.id !== editing?.id)) {
      toast.error('Ese mail ya está cargado en otro miembro.')
      return
    }
    setBusy(true)
    try {
      const now = Date.now()
      if (editing) {
        const prevEmail = emailOf[editing.id] ?? ''
        const emailChanged = e !== prevEmail
        const patch: Partial<Member> = { alias: a, name: name.trim(), hasEmail: !!e, updatedAt: now, version: editing.version + 1 }
        if (editing.status === 'draft' && e) patch.status = 'active'
        if (emailChanged && editing.id !== OWNER_ID) patch.uid = null // obliga a verificar el mail nuevo
        await db.updateDoc(P.member(editing.id), patch as Record<string, unknown>)
        if (e) await db.setDoc<MemberPrivate>(P.memberPrivate(editing.id), { email: e, invitedAt: now }, { merge: true })
        else if (prevEmail) await db.deleteDoc(P.memberPrivate(editing.id))
        if (emailChanged) await logAudit(db, slug, memberId!, 'member.email', editing.id)
      } else {
        const id = 'm-' + slugify(a) + '-' + db.newId().slice(0, 4).toLowerCase()
        await db.setDoc(P.member(id), newMember(id, a, now, { name: name.trim(), status: e ? 'active' : 'draft', hasEmail: !!e }))
        if (e) await db.setDoc<MemberPrivate>(P.memberPrivate(id), { email: e, invitedAt: now })
        await logAudit(db, slug, memberId!, 'member.create', id)
      }
      setNewOpen(false)
      toast.ok('Guardado')
    } catch (err) {
      toast.error(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  async function toggle(m: Member, field: 'participating' | 'vao') {
    try {
      await db.updateDoc(P.member(m.id), { [field]: !m[field], updatedAt: Date.now() })
    } catch (e) {
      toast.error(errorText(e))
    }
  }

  async function setStatus(m: Member, status: Member['status']) {
    if (m.id === OWNER_ID) {
      toast.error('El propietario no se puede suspender.')
      return
    }
    try {
      await db.updateDoc(P.member(m.id), { status, updatedAt: Date.now() })
      await logAudit(db, slug, memberId!, status === 'suspended' ? 'member.suspend' : 'member.reactivate', m.id)
    } catch (e) {
      toast.error(errorText(e))
    }
  }

  async function importCsv() {
    const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    const rows = lines.map((l) => l.split(/[,;\t]/).map((x) => x.trim()))
    const errors: string[] = []
    const ok: Array<{ alias: string; email: string }> = []
    const seen = new Set<string>()
    rows.forEach((r, i) => {
      const [a, e] = r
      if (!a || !e) return errors.push(`Línea ${i + 1}: falta alias o mail`)
      const em = e.toLowerCase()
      if (!EMAIL_RE.test(em)) return errors.push(`Línea ${i + 1}: mail inválido`)
      if (seen.has(em) || privates.some((p) => p.email === em)) return errors.push(`Línea ${i + 1}: mail repetido (${em})`)
      seen.add(em)
      ok.push({ alias: a, email: em })
    })
    if (errors.length) {
      toast.error(errors.slice(0, 3).join(' · '))
      return
    }
    setBusy(true)
    try {
      const now = Date.now()
      for (const r of ok) {
        const existing = members.list.find((m) => m.status === 'draft' && m.alias.toLowerCase() === r.alias.toLowerCase())
        const id = existing?.id ?? 'm-' + slugify(r.alias) + '-' + db.newId().slice(0, 4).toLowerCase()
        if (existing) await db.updateDoc(P.member(id), { status: 'active', hasEmail: true, updatedAt: now })
        else await db.setDoc(P.member(id), newMember(id, r.alias, now, { status: 'active', hasEmail: true }))
        await db.setDoc<MemberPrivate>(P.memberPrivate(id), { email: r.email, invitedAt: now })
      }
      await logAudit(db, slug, memberId!, 'member.import', `${ok.length} filas`)
      setImportOpen(false)
      setCsv('')
      toast.ok(`${ok.length} miembros cargados`)
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  function copyInvite() {
    const url = window.location.href.split('#')[0]
    const text = `Hola banda 👋 Ya está la web de la cena: ${url}\nEntrás con tu mail (te llega un link, sin contraseña). Primera misión: votar la fecha.`
    navigator.clipboard?.writeText(text).then(
      () => toast.ok('Mensaje de invitación copiado'),
      () => toast.error('No se pudo copiar'),
    )
  }

  const list = members.list.filter((m) => !filter || m.alias.toLowerCase().includes(filter.toLowerCase()) || (emailOf[m.id] ?? '').includes(filter.toLowerCase()))
  const vaoCount = members.active.filter((m) => m.vao).length

  return (
    <div className="grid gap-4">
      <div className="flex gap-2 flex-wrap items-center">
        <Button variant="gold" onClick={() => openEdit(null)}>
          Agregar miembro
        </Button>
        <Button variant="line" onClick={() => setImportOpen(true)}>
          Importar lista
        </Button>
        <Button variant="line" onClick={copyInvite}>
          <Copy size={16} /> Copiar invitación para WhatsApp
        </Button>
        <input className="input sm:max-w-xs ml-auto" placeholder="Buscar" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Buscar miembro" />
      </div>
      <Notice>
        Los alias del grupo de WhatsApp están cargados como borradores sin mail. Un borrador no puede entrar hasta que le cargues el correo. No se mandan mails automáticos: compartí el link por el grupo.
      </Notice>
      <Card>
        <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
          <p className="small muted">
            {members.active.length} activos · {members.list.filter((m) => m.status === 'draft').length} borradores · {vaoCount} fueron al VAO
          </p>
          <Button
            size="sm"
            variant={edition?.vaoRosterConfirmed ? 'line' : 'solid'}
            onClick={() => void db.updateDoc(P.edition(slug), { vaoRosterConfirmed: !edition?.vaoRosterConfirmed, updatedAt: Date.now() })}
          >
            {edition?.vaoRosterConfirmed ? 'Padrón VAO confirmado ✓ (reabrir)' : 'Confirmar padrón VAO'}
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left tiny muted">
                <th className="py-2 pr-2">Miembro</th>
                <th className="py-2 pr-2">Mail</th>
                <th className="py-2 pr-2">Estado</th>
                <th className="py-2 pr-2">Participa</th>
                <th className="py-2 pr-2">VAO</th>
                <th className="py-2 pr-2"></th>
              </tr>
            </thead>
            <tbody>
              {list.map((m) => (
                <tr key={m.id} className="border-t border-line">
                  <td className="py-2 pr-2 whitespace-nowrap">
                    <span className="inline-flex items-center gap-2">
                      <Avatar id={m.id} alias={m.alias} size={24} color={m.avatarColor} />
                      <b>{m.alias}</b>
                      {m.name ? <span className="tiny muted">{m.name}</span> : null}
                      {m.role === 'owner' ? <Pill className="ml-1">Dueño</Pill> : null}
                    </span>
                  </td>
                  <td className="py-2 pr-2 tiny">{emailOf[m.id] ?? <span className="muted">sin mail</span>}</td>
                  <td className="py-2 pr-2">
                    {m.status === 'active' ? <Pill tone="ok">Activo{m.uid ? '' : ' · nunca entró'}</Pill> : m.status === 'draft' ? <Pill tone="muted">Borrador</Pill> : <Pill tone="danger">Suspendido</Pill>}
                  </td>
                  <td className="py-2 pr-2">
                    <input type="checkbox" aria-label={`Participa ${m.alias}`} checked={m.participating} onChange={() => void toggle(m, 'participating')} />
                  </td>
                  <td className="py-2 pr-2">
                    <input type="checkbox" aria-label={`VAO ${m.alias}`} checked={m.vao} onChange={() => void toggle(m, 'vao')} />
                  </td>
                  <td className="py-2 whitespace-nowrap">
                    <span className="inline-flex gap-1">
                      <Button size="sm" variant="line" onClick={() => openEdit(m)}>
                        Editar
                      </Button>
                      {m.status === 'draft' && m.id !== OWNER_ID ? (
                        <Button size="sm" variant="line" onClick={() => setLinkDraft(m)}>
                          Vincular con el propietario
                        </Button>
                      ) : null}
                      {m.status === 'active' && m.id !== OWNER_ID ? (
                        <Button size="sm" variant="line" onClick={() => void setStatus(m, 'suspended')}>
                          Suspender
                        </Button>
                      ) : null}
                      {m.status === 'suspended' ? (
                        <Button size="sm" variant="line" onClick={() => void setStatus(m, 'active')}>
                          Reactivar
                        </Button>
                      ) : null}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={newOpen} onClose={() => setNewOpen(false)} title={editing ? `Editar ${editing.alias}` : 'Nuevo miembro'}>
        <Field label="Alias" id="mm-alias">
          <Input id="mm-alias" value={alias} onChange={(e) => setAlias(e.target.value)} />
        </Field>
        <Field label="Nombre (opcional)" id="mm-name">
          <Input id="mm-name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Mail" id="mm-email" hint={editing?.id === OWNER_ID ? 'El mail del propietario está fijado en las reglas.' : 'Con mail cargado pasa a Activo y puede entrar. Cambiarlo obliga a verificar el nuevo.'}>
          <Input id="mm-email" type="email" value={email} disabled={editing?.id === OWNER_ID} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Button variant="gold" onClick={() => void save()} loading={busy}>
          Guardar
        </Button>
      </Modal>

      <Modal open={importOpen} onClose={() => setImportOpen(false)} title="Importar lista">
        <p className="small muted mb-2">Una persona por línea: <code>alias, mail</code>. Si el alias coincide con un borrador, lo completa.</p>
        <Textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={8} placeholder={'Choclo, choclo@mail.com\nFacu, facu@mail.com'} aria-label="Lista CSV" />
        <Button className="mt-3" variant="gold" onClick={() => void importCsv()} loading={busy}>
          Importar
        </Button>
      </Modal>

      <ConfirmDialog
        open={!!linkDraft}
        onClose={() => setLinkDraft(null)}
        title={`Vincular "${linkDraft?.alias}" con el propietario`}
        text="El borrador se elimina y el propietario pasa a usar ese alias. Hacelo sólo si ese alias sos vos."
        confirmLabel="Vincular"
        onConfirm={async () => {
          if (!linkDraft) return
          try {
            await db.updateDoc(P.member(OWNER_ID), { alias: linkDraft.alias, updatedAt: Date.now() })
            await db.deleteDoc(P.member(linkDraft.id))
            await logAudit(db, slug, memberId!, 'member.link-owner', linkDraft.id)
            toast.ok('Vinculado')
          } catch (e) {
            toast.error(errorText(e))
          } finally {
            setLinkDraft(null)
          }
        }}
      />
    </div>
  )
}
