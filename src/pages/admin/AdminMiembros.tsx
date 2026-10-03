// Miembros: alta y edición en la misma tabla (alias, nombre, mail), participación, quiénes fueron al VAO, suspensión e importación.
import { Copy } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { VAO_ACTIVO } from '../../content/premios'
import { useSession } from '../../data/DataContext'
import { errorText, logAudit } from '../../data/actions'
import type { DataAdapter } from '../../data/adapter'
import { useCollection, useEdition, useMembers } from '../../data/hooks'
import { P } from '../../data/paths'
import { OWNER_ID, newMember, slugify } from '../../data/seed'
import type { Member, MemberPrivate } from '../../data/types'
import { Button, Card, ConfirmDialog, Loading, Modal, Notice, Pill, Textarea } from '../../ui/components'
import { useToast } from '../../ui/toast'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/** Guarda alias, nombre y mail de un miembro existente. Devuelve un mensaje de error o null. */
async function saveMember(db: DataAdapter, slug: string, actorId: string, m: Member, prevEmail: string, alias: string, name: string, email: string, taken: (e: string) => boolean): Promise<string | null> {
  const a = alias.trim()
  const e = email.trim().toLowerCase()
  if (a.length < 2) return 'El alias es muy corto.'
  if (e && !EMAIL_RE.test(e)) return 'Ese mail no parece válido.'
  if (e && e !== prevEmail && taken(e)) return 'Ese mail ya está cargado en otro miembro.'
  const now = Date.now()
  const emailChanged = e !== prevEmail
  const patch: Record<string, unknown> = { alias: a, name: name.trim(), hasEmail: !!e, updatedAt: now, version: (m.version ?? 1) + 1 }
  if (m.status === 'draft' && e) patch.status = 'active'
  if (m.status === 'active' && !e && m.id !== OWNER_ID) patch.status = 'draft'
  if (emailChanged && m.id !== OWNER_ID) patch.uid = null // obliga a verificar el mail nuevo
  await db.updateDoc(P.member(m.id), patch)
  if (e) await db.setDoc<MemberPrivate>(P.memberPrivate(m.id), { email: e, invitedAt: now }, { merge: true })
  else if (prevEmail) await db.deleteDoc(P.memberPrivate(m.id))
  if (emailChanged) await logAudit(db, slug, actorId, 'member.email', m.id)
  return null
}

export function AdminMiembros() {
  const { db, slug, memberId } = useSession()
  const toast = useToast()
  const members = useMembers()
  const { data: edition } = useEdition()
  const { rows: privates } = useCollection<MemberPrivate>(P.memberPrivates)
  const emailOf = useMemo(() => Object.fromEntries(privates.map((p) => [p.id, p.email])), [privates])
  const [busy, setBusy] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [csv, setCsv] = useState('')
  const [filter, setFilter] = useState('')
  const [newAlias, setNewAlias] = useState('')
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null)

  if (members.loading) return <Loading />
  const taken = (e: string) => privates.some((p) => p.email === e)

  async function add() {
    const a = newAlias.trim()
    const e = newEmail.trim().toLowerCase()
    if (a.length < 2) return toast.error('Poné un alias.')
    if (e && !EMAIL_RE.test(e)) return toast.error('Ese mail no parece válido.')
    if (e && taken(e)) return toast.error('Ese mail ya está cargado en otro miembro.')
    setBusy(true)
    try {
      const now = Date.now()
      const id = 'm-' + slugify(a) + '-' + db.newId().slice(0, 4).toLowerCase()
      await db.setDoc(P.member(id), newMember(id, a, now, { name: newName.trim(), status: e ? 'active' : 'draft', hasEmail: !!e }))
      if (e) await db.setDoc<MemberPrivate>(P.memberPrivate(id), { email: e, invitedAt: now })
      await logAudit(db, slug, memberId!, 'member.create', id)
      setNewAlias('')
      setNewName('')
      setNewEmail('')
      toast.ok(`${a} agregado`)
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
    if (m.id === OWNER_ID) return toast.error('El propietario no se puede suspender.')
    try {
      await db.updateDoc(P.member(m.id), { status, updatedAt: Date.now() })
      await logAudit(db, slug, memberId!, status === 'suspended' ? 'member.suspend' : 'member.reactivate', m.id)
    } catch (e) {
      toast.error(errorText(e))
    }
  }

  async function importCsv() {
    const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    const errors: string[] = []
    const ok: Array<{ alias: string; email: string; name: string }> = []
    const seen = new Set<string>()
    lines.forEach((l, i) => {
      const [a, e, n] = l.split(/[,;\t]/).map((x) => x.trim())
      if (!a || !e) return errors.push(`Línea ${i + 1}: falta alias o mail`)
      const em = e.toLowerCase()
      if (!EMAIL_RE.test(em)) return errors.push(`Línea ${i + 1}: mail inválido`)
      const existing = members.list.find((m) => m.alias.toLowerCase() === a.toLowerCase())
      if (seen.has(em) || privates.some((p) => p.email === em && p.id !== existing?.id)) return errors.push(`Línea ${i + 1}: mail repetido (${em})`)
      seen.add(em)
      ok.push({ alias: a, email: em, name: n ?? '' })
    })
    if (errors.length) return toast.error(errors.slice(0, 3).join(' · '))
    setBusy(true)
    try {
      const now = Date.now()
      for (const r of ok) {
        const existing = members.list.find((m) => m.alias.toLowerCase() === r.alias.toLowerCase())
        const id = existing?.id ?? 'm-' + slugify(r.alias) + '-' + db.newId().slice(0, 4).toLowerCase()
        if (existing) await db.updateDoc(P.member(id), { status: existing.status === 'suspended' ? 'suspended' : 'active', hasEmail: true, ...(r.name ? { name: r.name } : {}), updatedAt: now })
        else await db.setDoc(P.member(id), newMember(id, r.alias, now, { name: r.name, status: 'active', hasEmail: true }))
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
    const text = `Hola banda 👋 Ya está la web de la comida anual: ${url}\nEntrás con tu mail (te llega un link, sin contraseña). Primera misión: votar la fecha.`
    navigator.clipboard?.writeText(text).then(
      () => toast.ok('Mensaje de invitación copiado'),
      () => toast.error('No se pudo copiar'),
    )
  }

  const f = filter.toLowerCase()
  const list = members.list.filter((m) => !f || m.alias.toLowerCase().includes(f) || (m.name ?? '').toLowerCase().includes(f) || (emailOf[m.id] ?? '').includes(f))
  const vaoCount = members.list.filter((m) => m.vao).length
  const withEmail = members.list.filter((m) => emailOf[m.id]).length

  return (
    <div className="grid gap-4">
      <Notice>
        Escribí el <b>mail</b> de cada uno en su fila y tocá <b>Guardar</b>: con mail cargado pasa a Activo y ya puede entrar a la web. Sin mail queda como borrador y no puede entrar. No se mandan mails automáticos: compartí el link por el grupo.
      </Notice>
      <div className="flex gap-2 flex-wrap items-center">
        <Button variant="line" onClick={() => setImportOpen(true)}>
          Pegar una lista
        </Button>
        <Button variant="line" onClick={copyInvite}>
          <Copy size={16} /> Copiar invitación para WhatsApp
        </Button>
        <input className="input sm:max-w-xs ml-auto" placeholder="Buscar" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Buscar miembro" />
      </div>

      <Card>
        <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
          <p className="small muted">
            {members.list.length} en total · {withEmail} con mail{VAO_ACTIVO ? ` · ${vaoCount} fueron al VAO` : ''}
          </p>
          {VAO_ACTIVO ? (
          <Button size="sm" variant={edition?.vaoRosterConfirmed ? 'line' : 'solid'} onClick={() => void db.updateDoc(P.edition(slug), { vaoRosterConfirmed: !edition?.vaoRosterConfirmed, updatedAt: Date.now() })}>
            {edition?.vaoRosterConfirmed ? 'Lista del VAO confirmada ✓ (reabrir)' : 'Confirmar quiénes fueron al VAO'}
          </Button>
          ) : null}
        </div>
        <p className="tiny muted mb-3" hidden={!VAO_ACTIVO}>
          VAO es el Viaje Anual Obligatorio. Tildá "Fue al VAO" en los que viajaron y confirmá la lista: los premios Revelación, MVP y Rey de la noche VAO sólo se pueden abrir con esa lista confirmada, y sólo ellos pueden ganarlos.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left tiny muted">
                <th className="py-2 pr-2 min-w-[110px]">Alias</th>
                <th className="py-2 pr-2 min-w-[150px]">Nombre</th>
                <th className="py-2 pr-2 min-w-[210px]">Mail</th>
                <th className="py-2 pr-2">Estado</th>
                <th className="py-2 pr-2 text-center">Participa</th>
                {VAO_ACTIVO ? <th className="py-2 pr-2 text-center">Fue al VAO</th> : null}
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-line bg-soft/40">
                <td className="py-2 pr-2">
                  <input className="input" placeholder="Nuevo alias" value={newAlias} onChange={(e) => setNewAlias(e.target.value)} aria-label="Alias del nuevo miembro" />
                </td>
                <td className="py-2 pr-2">
                  <input className="input" placeholder="Nombre" value={newName} onChange={(e) => setNewName(e.target.value)} aria-label="Nombre del nuevo miembro" />
                </td>
                <td className="py-2 pr-2">
                  <input className="input" type="email" placeholder="mail@ejemplo.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} aria-label="Mail del nuevo miembro" />
                </td>
                <td className="py-2 pr-2 tiny muted" colSpan={VAO_ACTIVO ? 3 : 2}>
                  Para sumar a alguien que no está en la lista.
                </td>
                <td className="py-2">
                  <Button size="sm" variant="gold" onClick={() => void add()} loading={busy} disabled={newAlias.trim().length < 2}>
                    Agregar
                  </Button>
                </td>
              </tr>
              {list.map((m) => (
                <MemberRow key={m.id} m={m} email={emailOf[m.id] ?? ''} taken={taken} onToggle={toggle} onStatus={setStatus} onRemove={setRemoveTarget} />
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={importOpen} onClose={() => setImportOpen(false)} title="Pegar una lista">
        <p className="small muted mb-2">
          Una persona por línea: <code>alias, mail</code> (y si querés, <code>, nombre</code>). Si el alias ya existe, le completa el mail.
        </p>
        <Textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={8} placeholder={'Choclo, choclo@mail.com\nFacu, facu@mail.com, Facu Caputo'} aria-label="Lista de miembros" />
        <Button className="mt-3" variant="gold" onClick={() => void importCsv()} loading={busy}>
          Cargar
        </Button>
      </Modal>

      <ConfirmDialog
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        title={`Eliminar a ${removeTarget?.alias}`}
        text="Se borra de la lista. Sólo se puede eliminar a quien todavía no tiene mail cargado; a los demás se los suspende."
        danger
        confirmLabel="Eliminar"
        onConfirm={async () => {
          if (!removeTarget) return
          try {
            await db.deleteDoc(P.member(removeTarget.id))
            await logAudit(db, slug, memberId!, 'member.delete', removeTarget.id)
            toast.ok('Eliminado')
          } catch (e) {
            toast.error(errorText(e))
          } finally {
            setRemoveTarget(null)
          }
        }}
      />
    </div>
  )
}

function MemberRow({ m, email, taken, onToggle, onStatus, onRemove }: { m: Member; email: string; taken: (e: string) => boolean; onToggle: (m: Member, f: 'participating' | 'vao') => void; onStatus: (m: Member, s: Member['status']) => void; onRemove: (m: Member) => void }) {
  const { db, slug, memberId } = useSession()
  const toast = useToast()
  const [alias, setAlias] = useState(m.alias)
  const [name, setName] = useState(m.name ?? '')
  const [mail, setMail] = useState(email)
  const [busy, setBusy] = useState(false)
  useEffect(() => setAlias(m.alias), [m.alias])
  useEffect(() => setName(m.name ?? ''), [m.name])
  useEffect(() => setMail(email), [email])
  const dirty = alias !== m.alias || name !== (m.name ?? '') || mail.trim().toLowerCase() !== email
  const isOwner = m.id === OWNER_ID

  async function save() {
    setBusy(true)
    try {
      const err = await saveMember(db, slug, memberId!, m, email, alias, name, isOwner ? email : mail, taken)
      if (err) toast.error(err)
      else toast.ok(`${alias.trim()} guardado`)
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <tr className="border-t border-line align-middle">
      <td className="py-2 pr-2">
        <input className="input" value={alias} onChange={(e) => setAlias(e.target.value)} aria-label={`Alias de ${m.alias}`} />
      </td>
      <td className="py-2 pr-2">
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre" aria-label={`Nombre de ${m.alias}`} />
      </td>
      <td className="py-2 pr-2">
        <input className="input" type="email" value={mail} disabled={isOwner} onChange={(e) => setMail(e.target.value)} placeholder="sin mail" aria-label={`Mail de ${m.alias}`} onKeyDown={(e) => e.key === 'Enter' && dirty && void save()} />
      </td>
      <td className="py-2 pr-2 whitespace-nowrap">
        {isOwner ? <Pill>Dueño</Pill> : m.status === 'active' ? <Pill tone="ok">Activo{m.uid ? '' : ' · no entró'}</Pill> : m.status === 'draft' ? <Pill tone="muted">Borrador</Pill> : <Pill tone="danger">Suspendido</Pill>}
      </td>
      <td className="py-2 pr-2 text-center">
        <input type="checkbox" className="w-5 h-5" aria-label={`Participa ${m.alias}`} checked={m.participating} onChange={() => onToggle(m, 'participating')} />
      </td>
      {VAO_ACTIVO ? (
        <td className="py-2 pr-2 text-center">
          <input type="checkbox" className="w-5 h-5" aria-label={`Fue al VAO ${m.alias}`} checked={m.vao} onChange={() => onToggle(m, 'vao')} />
        </td>
      ) : null}
      <td className="py-2 whitespace-nowrap">
        <span className="inline-flex gap-1">
          {dirty ? (
            <Button size="sm" variant="gold" onClick={() => void save()} loading={busy}>
              Guardar
            </Button>
          ) : null}
          {m.status === 'active' && !isOwner ? (
            <Button size="sm" variant="line" onClick={() => onStatus(m, 'suspended')}>
              Suspender
            </Button>
          ) : null}
          {m.status === 'suspended' ? (
            <Button size="sm" variant="line" onClick={() => onStatus(m, 'active')}>
              Reactivar
            </Button>
          ) : null}
          {m.status === 'draft' && !isOwner && !dirty ? (
            <Button size="sm" variant="line" onClick={() => onRemove(m)}>
              Eliminar
            </Button>
          ) : null}
        </span>
      </td>
    </tr>
  )
}
