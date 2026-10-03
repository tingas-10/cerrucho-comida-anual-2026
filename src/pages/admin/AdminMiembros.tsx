// Miembros y accesos: usuario y contraseña de cada uno, presidente, participación y altas/bajas.
// Las contraseñas no se guardan en ningún lado: se muestran una sola vez al crearlas para pasarlas por WhatsApp.
import { Copy, KeyRound, Plus, UserPlus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { VAO_ACTIVO } from '../../content/premios'
import { useSession } from '../../data/DataContext'
import { createMemberLogin, removeMemberLogin, resetMemberPassword } from '../../data/accounts'
import { errorText, logAudit } from '../../data/actions'
import { useCollection, useDoc, useEdition, useMembers } from '../../data/hooks'
import { P } from '../../data/paths'
import { OWNER_ID, newMember, slugify } from '../../data/seed'
import type { LoginDoc, Member, MemberPrivate, RolesConfig } from '../../data/types'
import { generatePassword, normalizeUsername } from '../../domain/accounts'
import { Button, Card, ConfirmDialog, Field, Input, Loading, MemberAvatar, Modal, Notice, Pill } from '../../ui/components'
import { useToast } from '../../ui/toast'

interface Credential {
  alias: string
  username: string
  password: string
}

function credentialsText(list: Credential[]): string {
  const url = window.location.href.split('#')[0]
  return list.map((c) => `${c.alias}: usuario *${c.username}* · contraseña *${c.password}*`).join('\n') + `\n\nEntrás en ${url}#/entrar (después podés cambiar la contraseña).`
}

export function AdminMiembros() {
  const { db, auth, slug, memberId } = useSession()
  const toast = useToast()
  const members = useMembers()
  const { data: edition } = useEdition()
  const { rows: privates } = useCollection<MemberPrivate>(P.memberPrivates)
  const { data: roles } = useDoc<RolesConfig>(P.roles)
  const privById = useMemo(() => Object.fromEntries(privates.map((p) => [p.id, p])), [privates])
  const [filter, setFilter] = useState('')
  const [newAlias, setNewAlias] = useState('')
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [loginFor, setLoginFor] = useState<{ m: Member; mode: 'create' | 'reset' } | null>(null)
  const [shown, setShown] = useState<Credential[] | null>(null)
  const [bulkProgress, setBulkProgress] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{ m: Member; action: 'remove-login' | 'delete' } | null>(null)

  if (members.loading) return <Loading />
  const usernameOf = (id: string) => privById[id]?.username || ''
  const withoutLogin = members.list.filter((m) => m.status !== 'suspended' && !usernameOf(m.id) && m.id !== OWNER_ID)
  const f = filter.trim().toLowerCase()
  const list = members.list.filter((m) => !f || m.alias.toLowerCase().includes(f) || (m.name ?? '').toLowerCase().includes(f) || usernameOf(m.id).includes(f))

  async function addMember() {
    const a = newAlias.trim()
    if (a.length < 2) return toast.error('Poné un alias.')
    setBusy('add')
    try {
      const id = 'm-' + slugify(a) + '-' + db.newId().slice(0, 4).toLowerCase()
      await db.setDoc(P.member(id), newMember(id, a, Date.now(), { name: newName.trim() }))
      await logAudit(db, slug, memberId!, 'member.create', id)
      setNewAlias('')
      setNewName('')
      toast.ok(`${a} agregado. Ahora creale el usuario.`)
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(null)
    }
  }

  /** Usuario libre a partir del alias (si "facu" está tomado, prueba "facu2", "facu3"…). */
  async function freeUsername(alias: string): Promise<string> {
    const base = normalizeUsername(alias) || 'miembro'
    for (let i = 0; i < 50; i++) {
      const u = i === 0 ? base : `${base}${i + 1}`
      const taken = await db.getDoc<LoginDoc>(P.login(u))
      if (!taken) return u
    }
    return base + db.newId().slice(0, 4).toLowerCase()
  }

  async function bulkCreate() {
    const out: Credential[] = []
    try {
      for (let i = 0; i < withoutLogin.length; i++) {
        const m = withoutLogin[i]
        setBulkProgress(`Creando ${i + 1} de ${withoutLogin.length}: ${m.alias}…`)
        const username = await freeUsername(m.alias)
        const password = generatePassword()
        await createMemberLogin(db, auth, m.id, username, password)
        out.push({ alias: m.alias, username, password })
      }
      await logAudit(db, slug, memberId!, 'login.create.bulk', `${out.length} usuarios`)
      toast.ok(`${out.length} usuarios creados`)
    } catch (e) {
      toast.error(`Se cortó en el ${out.length + 1}: ${errorText(e)}`)
    } finally {
      setBulkProgress(null)
      if (out.length) setShown(out)
    }
  }

  async function setPresident(id: string) {
    try {
      await db.setDoc<RolesConfig>(P.roles, { presidentId: id || null, updatedAt: Date.now() })
      await logAudit(db, slug, memberId!, 'rol.presidente', id || 'ninguno')
      toast.ok(id ? `${members.aliasOf(id)} es el presidente` : 'Sin presidente')
    } catch (e) {
      toast.error(errorText(e))
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
    if (m.id === OWNER_ID) return toast.error('No te podés suspender a vos mismo.')
    try {
      await db.updateDoc(P.member(m.id), { status, updatedAt: Date.now() })
      await logAudit(db, slug, memberId!, status === 'suspended' ? 'member.suspend' : 'member.reactivate', m.id)
    } catch (e) {
      toast.error(errorText(e))
    }
  }

  return (
    <div className="grid gap-4">
      {!usernameOf(OWNER_ID) ? (
        <Notice tone="warn">
          <b>Primero creá tu propio usuario</b> (tarjeta "{members.aliasOf(OWNER_ID)}" → Crear usuario), así elegís el nombre que quieras antes de crear los de todos.
        </Notice>
      ) : null}
      <Notice>
        Cada uno entra con <b>usuario y contraseña</b> (sin mail). Creale el usuario, pasale la contraseña por WhatsApp y en el primer ingreso la puede cambiar. Si se la olvida, la reseteás acá: nunca vas a ver la que eligió.
      </Notice>

      <Card>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <p className="h3 mb-1">Presidente</p>
            <p className="tiny muted mb-2">Puede confirmar la fecha, el lugar y la comida definitivos. Vos también podés.</p>
            <select className="input" aria-label="Presidente" value={roles?.presidentId ?? ''} onChange={(e) => void setPresident(e.target.value)}>
              <option value="">Nadie</option>
              {members.list
                .filter((m) => m.status !== 'suspended')
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.alias}
                    {m.name && m.name !== m.alias ? ` (${m.name})` : ''}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <p className="h3 mb-1">Usuarios que faltan</p>
            <p className="tiny muted mb-2">
              {withoutLogin.length === 0 ? 'Todos tienen usuario.' : `${withoutLogin.length} todavía no tienen usuario. Se crean con su alias y una contraseña tipo "fernet-4827".`}
            </p>
            {withoutLogin.length ? (
              <Button variant="gold" onClick={() => void bulkCreate()} loading={!!bulkProgress}>
                <UserPlus size={16} /> Crear los {withoutLogin.length} usuarios
              </Button>
            ) : null}
            {bulkProgress ? <p className="tiny muted mt-2">{bulkProgress}</p> : null}
          </div>
        </div>
      </Card>

      <Card>
        <p className="h3 mb-2">Sumar a alguien</p>
        <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-2 items-end">
          <Field label="Alias" id="nm-alias">
            <Input id="nm-alias" value={newAlias} onChange={(e) => setNewAlias(e.target.value)} placeholder="ej. Choclo" />
          </Field>
          <Field label="Nombre" id="nm-name">
            <Input id="nm-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="ej. Juan Pérez" />
          </Field>
          <div className="mb-4">
            <Button onClick={() => void addMember()} loading={busy === 'add'} disabled={newAlias.trim().length < 2}>
              <Plus size={16} /> Agregar
            </Button>
          </div>
        </div>
      </Card>

      <input className="input" placeholder="Buscar por alias, nombre o usuario" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Buscar miembro" />

      <div className="grid gap-3 md:grid-cols-2">
        {list.map((m) => (
          <MemberCard
            key={m.id}
            m={m}
            username={usernameOf(m.id)}
            isPresident={roles?.presidentId === m.id}
            onToggle={toggle}
            onStatus={setStatus}
            onLogin={(mode) => setLoginFor({ m, mode })}
            onConfirm={(action) => setConfirm({ m, action })}
          />
        ))}
      </div>
      {VAO_ACTIVO ? (
        <Button size="sm" variant="line" onClick={() => void db.updateDoc(P.edition(slug), { vaoRosterConfirmed: !edition?.vaoRosterConfirmed, updatedAt: Date.now() })}>
          {edition?.vaoRosterConfirmed ? 'Lista del VAO confirmada ✓ (reabrir)' : 'Confirmar quiénes fueron al VAO'}
        </Button>
      ) : null}

      <LoginModal
        target={loginFor}
        onClose={() => setLoginFor(null)}
        suggest={loginFor ? (usernameOf(loginFor.m.id) || normalizeUsername(loginFor.m.alias)) : ''}
        onDone={(cred) => {
          setLoginFor(null)
          setShown([cred])
        }}
      />

      <Modal open={!!shown} onClose={() => setShown(null)} title="Pasáselo por WhatsApp" wide>
        <Notice tone="warn">Copialo ahora: las contraseñas no se guardan y no las vas a poder ver de nuevo (si hace falta, se resetean).</Notice>
        <div className="mt-3 max-h-[50dvh] overflow-y-auto">
          {(shown ?? []).map((c) => (
            <div key={c.username} className="row small">
              <span className="font-semibold">{c.alias}</span>
              <span className="text-right">
                <span className="muted">usuario</span> <b>{c.username}</b>
                <br />
                <span className="muted">contraseña</span> <b className="font-mono">{c.password}</b>
              </span>
            </div>
          ))}
        </div>
        <Button
          variant="gold"
          className="w-full mt-3"
          onClick={() =>
            navigator.clipboard?.writeText(credentialsText(shown ?? [])).then(
              () => toast.ok('Copiado'),
              () => toast.error('No se pudo copiar'),
            )
          }
        >
          <Copy size={16} /> Copiar {shown && shown.length > 1 ? 'todo' : ''}
        </Button>
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={confirm?.action === 'delete' ? `Eliminar a ${confirm?.m.alias}` : `Quitarle el acceso a ${confirm?.m.alias}`}
        text={
          confirm?.action === 'delete'
            ? 'Se borra de la banda. Sus votos y partidos viejos quedan, pero sin nombre.'
            : 'Sigue en la banda (cumpleaños, FMO, amigo invisible) pero ya no puede entrar. Le podés crear un usuario nuevo cuando quieras.'
        }
        danger
        confirmLabel={confirm?.action === 'delete' ? 'Eliminar' : 'Quitar acceso'}
        onConfirm={async () => {
          const c = confirm!
          try {
            if (c.action === 'delete') {
              if (usernameOf(c.m.id)) await removeMemberLogin(db, c.m.id)
              await db.deleteDoc(P.member(c.m.id))
              await logAudit(db, slug, memberId!, 'member.delete', c.m.id)
            } else {
              await removeMemberLogin(db, c.m.id)
              await logAudit(db, slug, memberId!, 'login.remove', c.m.id)
            }
            toast.ok('Listo')
          } catch (e) {
            toast.error(errorText(e))
          } finally {
            setConfirm(null)
          }
        }}
      />
    </div>
  )
}

function MemberCard(props: {
  m: Member
  username: string
  isPresident: boolean
  onToggle: (m: Member, f: 'participating' | 'vao') => void
  onStatus: (m: Member, s: Member['status']) => void
  onLogin: (mode: 'create' | 'reset') => void
  onConfirm: (action: 'remove-login' | 'delete') => void
}) {
  const { m, username, isPresident } = props
  const { db } = useSession()
  const toast = useToast()
  const [alias, setAlias] = useState(m.alias)
  const [name, setName] = useState(m.name ?? '')
  const [busy, setBusy] = useState(false)
  useEffect(() => setAlias(m.alias), [m.alias])
  useEffect(() => setName(m.name ?? ''), [m.name])
  const dirty = alias.trim() !== m.alias || name.trim() !== (m.name ?? '')
  const isOwner = m.id === OWNER_ID

  async function save() {
    if (alias.trim().length < 2) return toast.error('El alias es muy corto.')
    setBusy(true)
    try {
      await db.updateDoc(P.member(m.id), { alias: alias.trim(), name: name.trim(), updatedAt: Date.now() })
      toast.ok('Guardado')
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card p-3">
      <div className="flex items-center gap-3">
        <MemberAvatar id={m.id} size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-1">
            {isOwner ? <Pill>Administrador</Pill> : null}
            {isPresident ? <Pill>Presidente</Pill> : null}
            {m.status === 'suspended' ? <Pill tone="danger">Suspendido</Pill> : username ? <Pill tone="ok">Usuario: {username}</Pill> : <Pill tone="muted">Sin usuario</Pill>}
            {m.status === 'active' && m.profileDone ? null : m.status === 'active' ? <Pill tone="warn">No entró todavía</Pill> : null}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-3">
        <input className="input font-semibold" value={alias} onChange={(e) => setAlias(e.target.value)} aria-label={`Alias de ${m.alias}`} />
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre" aria-label={`Nombre de ${m.alias}`} />
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
        <label className="flex items-center gap-2 small min-h-[40px]">
          <input type="checkbox" className="w-5 h-5" checked={m.participating} onChange={() => props.onToggle(m, 'participating')} />
          Participa este año
        </label>
        {VAO_ACTIVO ? (
          <label className="flex items-center gap-2 small min-h-[40px]">
            <input type="checkbox" className="w-5 h-5" checked={m.vao} onChange={() => props.onToggle(m, 'vao')} />
            Fue al VAO
          </label>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {dirty ? (
          <Button size="sm" variant="gold" onClick={() => void save()} loading={busy}>
            Guardar
          </Button>
        ) : null}
        {!username && m.status !== 'suspended' ? (
          <Button size="sm" variant={dirty ? 'line' : 'gold'} onClick={() => props.onLogin('create')}>
            <UserPlus size={14} /> Crear usuario
          </Button>
        ) : null}
        {username ? (
          <Button size="sm" variant="line" onClick={() => props.onLogin('reset')}>
            <KeyRound size={14} /> Resetear contraseña
          </Button>
        ) : null}
        {username && !isOwner ? (
          <Button size="sm" variant="line" onClick={() => props.onConfirm('remove-login')}>
            Quitar acceso
          </Button>
        ) : null}
        {m.status === 'active' && !isOwner ? (
          <Button size="sm" variant="line" onClick={() => props.onStatus(m, 'suspended')}>
            Suspender
          </Button>
        ) : null}
        {m.status === 'suspended' ? (
          <Button size="sm" variant="line" onClick={() => props.onStatus(m, username ? 'active' : 'draft')}>
            Reactivar
          </Button>
        ) : null}
        {!isOwner && !username ? (
          <Button size="sm" variant="line" onClick={() => props.onConfirm('delete')}>
            Eliminar
          </Button>
        ) : null}
      </div>
    </div>
  )
}

function LoginModal({ target, onClose, suggest, onDone }: { target: { m: Member; mode: 'create' | 'reset' } | null; onClose: () => void; suggest: string; onDone: (c: Credential) => void }) {
  const { db, auth, slug, memberId } = useSession()
  const toast = useToast()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [seen, setSeen] = useState<string | null>(null)
  const key = target ? target.m.id + target.mode : null
  if (key && key !== seen) {
    setSeen(key)
    setUsername(suggest)
    setPassword(generatePassword())
  }
  if (!target) return null
  const { m, mode } = target

  async function go() {
    setBusy(true)
    try {
      if (mode === 'create') {
        const u = await createMemberLogin(db, auth, m.id, username, password)
        await logAudit(db, slug, memberId!, 'login.create', m.id)
        onDone({ alias: m.alias, username: u, password })
      } else {
        await resetMemberPassword(db, auth, m.id, password)
        await logAudit(db, slug, memberId!, 'login.reset', m.id)
        onDone({ alias: m.alias, username: suggest, password })
      }
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={mode === 'create' ? `Usuario para ${m.alias}` : `Nueva contraseña para ${m.alias}`}>
      {mode === 'create' ? (
        <Field label="Usuario" id="lm-user" hint="Sin espacios ni acentos. Es lo que escribe para entrar.">
          <Input id="lm-user" autoCapitalize="none" autoCorrect="off" value={username} onChange={(e) => setUsername(e.target.value)} />
        </Field>
      ) : (
        <p className="small mb-3">
          Usuario: <b>{suggest}</b>. La contraseña anterior deja de servir.
        </p>
      )}
      <Field label={mode === 'create' ? 'Contraseña inicial' : 'Contraseña nueva'} id="lm-pass" hint="Mínimo 6 caracteres. Después la puede cambiar.">
        <div className="flex gap-2">
          <Input id="lm-pass" value={password} onChange={(e) => setPassword(e.target.value)} autoCapitalize="none" autoCorrect="off" />
          <Button variant="line" onClick={() => setPassword(generatePassword())} aria-label="Generar otra">
            Otra
          </Button>
        </div>
      </Field>
      {m.id === OWNER_ID && mode === 'create' ? (
        <Notice tone="warn">Es tu propio usuario: después de crearlo, cerrá sesión y entrá con él. Anotá la contraseña antes.</Notice>
      ) : null}
      <Button variant="gold" className="w-full mt-2" onClick={() => void go()} loading={busy}>
        {mode === 'create' ? 'Crear usuario' : 'Resetear contraseña'}
      </Button>
    </Modal>
  )
}
