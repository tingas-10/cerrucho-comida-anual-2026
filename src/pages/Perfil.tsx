// Mi perfil: alias, foto, cumpleaños, gustos para el regalo y contraseña. Y el primer ingreso.
import { useEffect, useState } from 'react'
import { useSession } from '../data/DataContext'
import { errorText } from '../data/actions'
import { useDoc } from '../data/hooks'
import { P } from '../data/paths'
import type { MemberPrivate } from '../data/types'
import { colorFor } from '../domain/format'
import { Button, Card, Field, Input, LoginPrompt, Notice, PageHeader, Textarea } from '../ui/components'
import { BirthdayFields, PasswordChange, PhotoPicker, birthError, type BirthValue } from '../ui/ProfileFields'
import { useToast } from '../ui/toast'

const COLORS = ['#d9b45f', '#7bd88f', '#8ab4ff', '#ff9f80', '#c79bff', '#67d6d2', '#f2a9c4', '#ffd166']

function useProfileForm() {
  const { member, memberId } = useSession()
  const priv = useDoc<MemberPrivate>(memberId ? P.memberPrivate(memberId) : null)
  const [alias, setAlias] = useState('')
  const [color, setColor] = useState('')
  const [photo, setPhoto] = useState<string | null>(null)
  const [birth, setBirth] = useState<BirthValue>({ d: '', m: '', y: '' })
  const [prefs, setPrefs] = useState('')
  useEffect(() => {
    if (!member) return
    setAlias(member.alias)
    setColor(member.avatarColor ?? colorFor(member.id))
    setPhoto(member.photo ?? null)
    setPrefs(member.giftPrefs ?? '')
    setBirth((b) => ({ d: member.birthday ? String(member.birthday.d) : '', m: member.birthday ? String(member.birthday.m) : '', y: b.y }))
  }, [member])
  useEffect(() => {
    if (priv.data?.birthYear) setBirth((b) => ({ ...b, y: String(priv.data!.birthYear) }))
  }, [priv.data])
  return { alias, setAlias, color, setColor, photo, setPhoto, birth, setBirth, prefs, setPrefs, priv: priv.data }
}

async function saveProfile(
  s: ReturnType<typeof useSession>,
  f: ReturnType<typeof useProfileForm>,
  opts: { requireBirthday: boolean; markDone?: boolean },
): Promise<string | null> {
  const a = f.alias.trim()
  if (a.length < 2 || a.length > 24) return 'El alias tiene que tener entre 2 y 24 caracteres.'
  const bErr = birthError(f.birth, opts.requireBirthday)
  if (bErr) return bErr
  const now = Date.now()
  const birthday = f.birth.d && f.birth.m ? { d: Number(f.birth.d), m: Number(f.birth.m) } : null
  const patch: Record<string, unknown> = { alias: a, avatarColor: f.color, photo: f.photo, birthday, giftPrefs: f.prefs.trim().slice(0, 600), updatedAt: now }
  if (opts.markDone) patch.profileDone = true
  await s.db.updateDoc(P.member(s.memberId!), patch)
  const year = f.birth.y ? Number(f.birth.y) : null
  if ((f.priv?.birthYear ?? null) !== year) await s.db.setDoc(P.memberPrivate(s.memberId!), { birthYear: year, updatedAt: now }, { merge: true })
  return null
}

export function Perfil() {
  const session = useSession()
  const { member, memberId, user, signOut, isMember } = session
  const toast = useToast()
  const f = useProfileForm()
  const [busy, setBusy] = useState(false)
  if (!isMember || !member || !memberId) return <LoginPrompt text="Entrá con tu usuario para ver y editar tu perfil." />

  async function save() {
    setBusy(true)
    try {
      const err = await saveProfile(session, f, { requireBirthday: false })
      if (err) toast.error(err)
      else toast.ok('Perfil guardado')
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader eyebrow="Mi perfil" title={member.alias} intro="Tu foto, cumpleaños y gustos los ve toda la banda. El año de nacimiento queda privado." />
      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-4">
        <Card>
          <PhotoPicker id={memberId} alias={f.alias || member.alias} color={f.color} photo={f.photo} onChange={f.setPhoto} />
          <div className="mt-5">
            <Field label="Alias" id="alias" hint="Cómo te dicen en el grupo.">
              <Input id="alias" value={f.alias} onChange={(e) => f.setAlias(e.target.value)} maxLength={24} />
            </Field>
          </div>
          {!f.photo ? (
            <>
              <p className="label">Color (si no tenés foto)</p>
              <div className="flex gap-2 flex-wrap mb-4" role="radiogroup" aria-label="Color del avatar">
                {COLORS.map((c) => (
                  <button key={c} type="button" role="radio" aria-checked={f.color === c} aria-label={`Color ${c}`} onClick={() => f.setColor(c)} className="w-11 h-11 rounded-full border-4" style={{ background: c, borderColor: f.color === c ? 'var(--text)' : 'transparent' }} />
                ))}
              </div>
            </>
          ) : null}
          <p className="label">Cumpleaños</p>
          <BirthdayFields value={f.birth} onChange={f.setBirth} />
          <Field label="Gustos e ideas de regalo" id="prefs" hint="Hobbies, cosas que te sirven, talle… Lo ve quien te regala (y toda la banda).">
            <Textarea id="prefs" value={f.prefs} onChange={(e) => f.setPrefs(e.target.value)} maxLength={600} placeholder="ej. Me gusta el asado, juego al pádel, talle L." />
          </Field>
          <Button variant="gold" onClick={() => void save()} loading={busy}>
            Guardar
          </Button>
        </Card>
        <div className="grid gap-4 content-start">
          <Card>
            <p className="h3 mb-2">Contraseña</p>
            {user?.passwordLogin ? (
              <PasswordChange />
            ) : (
              <Notice>Entraste con el acceso viejo por mail. Creá tu usuario en Administración → Miembros y después entrá con él.</Notice>
            )}
          </Card>
          <Card>
            <p className="h3">Sesión</p>
            {f.priv?.username ? <p className="small muted mt-1">Tu usuario: <b>{f.priv.username}</b></p> : null}
            <Button variant="line" className="mt-3" onClick={() => void signOut()}>
              Cerrar sesión
            </Button>
          </Card>
        </div>
      </div>
    </div>
  )
}

/** Primer ingreso: cumpleaños (obligatorio), foto y contraseña propia (opcionales). */
export function Onboarding() {
  const session = useSession()
  const { member, memberId, user } = session
  const toast = useToast()
  const f = useProfileForm()
  const [busy, setBusy] = useState(false)
  if (!member || !memberId) return null

  async function finish() {
    setBusy(true)
    try {
      const err = await saveProfile(session, f, { requireBirthday: true, markDone: true })
      if (err) toast.error(err)
      else toast.ok('¡Listo! Bienvenido a la web de la banda.')
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <PageHeader eyebrow="Primer ingreso" title={`¡Hola, ${member.alias}!`} intro="Antes de arrancar, completá un par de cosas. Tarda un minuto." />
      <Card className="mb-4">
        <p className="h3 mb-1">1 · Tu cumpleaños</p>
        <p className="small muted mb-3">La banda ve el día y el mes. El año queda privado.</p>
        <BirthdayFields value={f.birth} onChange={f.setBirth} />
      </Card>
      <Card className="mb-4">
        <p className="h3 mb-1">2 · Tu foto (opcional)</p>
        <p className="small muted mb-3">Aparece en la lista de cumpleaños, en FMO y en los premios.</p>
        <PhotoPicker id={memberId} alias={member.alias} color={f.color} photo={f.photo} onChange={f.setPhoto} />
      </Card>
      {user?.passwordLogin ? (
        <Card className="mb-4">
          <p className="h3 mb-1">3 · Tu propia contraseña (opcional)</p>
          <p className="small muted mb-3">Si querés, cambiá la que te pasó Agus por una que te acuerdes. También lo podés hacer después desde Mi perfil.</p>
          <PasswordChange compact />
        </Card>
      ) : null}
      <div className="sticky bottom-[calc(76px+env(safe-area-inset-bottom))] md:bottom-4 z-10 rounded-xl border border-line bg-card p-2 shadow-lg">
        <Button variant="gold" className="w-full" onClick={() => void finish()} loading={busy}>
          Listo, entrar a la web
        </Button>
      </div>
    </div>
  )
}
