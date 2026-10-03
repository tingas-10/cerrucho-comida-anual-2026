// Campos de perfil reutilizados en el primer ingreso y en "Mi perfil": foto, cumpleaños y contraseña.
import { Camera, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { useSession } from '../data/DataContext'
import { errorText } from '../data/actions'
import { validatePassword } from '../domain/accounts'
import { MESES, isValidBirthday } from '../domain/birthdays'
import { Avatar, Button, Field, Input } from './components'
import { useToast } from './toast'

/** Achica la foto en el celular antes de guardarla (cuadrada, 160 px, JPEG): queda en ~10 KB. */
export async function resizePhoto(file: File, size = 160): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('No se pudo leer la foto. Probá con otra (JPG o PNG).'))
      i.src = url
    })
    const side = Math.min(img.naturalWidth, img.naturalHeight)
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size)
    return canvas.toDataURL('image/jpeg', 0.82)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function PhotoPicker({ id, alias, color, photo, onChange }: { id: string; alias: string; color?: string; photo: string | null; onChange: (v: string | null) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  async function pick(f: File | undefined) {
    if (!f) return
    setBusy(true)
    try {
      onChange(await resizePhoto(f))
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }
  return (
    <div className="flex items-center gap-4">
      <Avatar id={id} alias={alias} size={72} color={color} photo={photo} />
      <div className="flex flex-col gap-2">
        <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} aria-label="Elegir foto de perfil" />
        <Button size="sm" variant="line" loading={busy} onClick={() => input.current?.click()}>
          <Camera size={16} /> {photo ? 'Cambiar foto' : 'Subir foto'}
        </Button>
        {photo ? (
          <Button size="sm" variant="ghost" onClick={() => onChange(null)}>
            <Trash2 size={16} /> Sacar foto
          </Button>
        ) : null}
      </div>
    </div>
  )
}

export interface BirthValue {
  d: string
  m: string
  y: string
}

export function birthError(v: BirthValue, required: boolean): string | null {
  if (!v.d && !v.m && !v.y) return required ? 'Completá tu fecha de nacimiento.' : null
  const d = Number(v.d)
  const m = Number(v.m)
  const y = Number(v.y)
  if (!isValidBirthday(d, m)) return 'Revisá el día y el mes.'
  const thisYear = new Date().getFullYear()
  if (v.y && (!Number.isInteger(y) || y < 1930 || y > thisYear)) return 'Revisá el año.'
  return null
}

export function BirthdayFields({ value, onChange }: { value: BirthValue; onChange: (v: BirthValue) => void }) {
  return (
    <div className="grid grid-cols-[72px_1fr_96px] gap-2">
      <Field label="Día" id="bd-d">
        <Input id="bd-d" inputMode="numeric" maxLength={2} value={value.d} onChange={(e) => onChange({ ...value, d: e.target.value.replace(/\D/g, '') })} placeholder="15" />
      </Field>
      <Field label="Mes" id="bd-m">
        <select id="bd-m" className="input" value={value.m} onChange={(e) => onChange({ ...value, m: e.target.value })}>
          <option value="">Elegí</option>
          {MESES.map((name, i) => (
            <option key={name} value={i + 1}>
              {name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Año" id="bd-y">
        <Input id="bd-y" inputMode="numeric" maxLength={4} value={value.y} onChange={(e) => onChange({ ...value, y: e.target.value.replace(/\D/g, '') })} placeholder="1992" />
      </Field>
    </div>
  )
}

/** Cambio de contraseña (pide la actual). Sólo para quien entró con usuario y contraseña. */
export function PasswordChange({ onDone, compact }: { onDone?: () => void; compact?: boolean }) {
  const { auth } = useSession()
  const toast = useToast()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [repeat, setRepeat] = useState('')
  const [busy, setBusy] = useState(false)
  async function save() {
    const err = validatePassword(next)
    if (err) return toast.error(err)
    if (next !== repeat) return toast.error('Las dos contraseñas nuevas no coinciden.')
    setBusy(true)
    try {
      await auth.changePassword(current, next)
      setCurrent('')
      setNext('')
      setRepeat('')
      toast.ok('Contraseña cambiada')
      onDone?.()
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div>
      <Field label={compact ? 'Contraseña que te pasó Agus' : 'Contraseña actual'} id="pw-cur">
        <Input id="pw-cur" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
      </Field>
      <div className="grid sm:grid-cols-2 gap-x-3">
        <Field label="Nueva contraseña" id="pw-new" hint="Mínimo 6 caracteres.">
          <Input id="pw-new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        </Field>
        <Field label="Repetila" id="pw-rep">
          <Input id="pw-rep" type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
        </Field>
      </div>
      <Button variant="line" onClick={() => void save()} loading={busy} disabled={!current || !next}>
        Cambiar contraseña
      </Button>
    </div>
  )
}
