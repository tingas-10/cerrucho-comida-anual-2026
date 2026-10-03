import { useEffect, useState } from 'react'
import { useSession } from '../data/DataContext'
import { errorText } from '../data/actions'
import { P } from '../data/paths'
import { colorFor } from '../domain/format'
import { Avatar, Button, Card, Field, Input, PageHeader } from '../ui/components'
import { useToast } from '../ui/toast'

const COLORS = ['#d9b45f', '#7bd88f', '#8ab4ff', '#ff9f80', '#c79bff', '#67d6d2', '#f2a9c4', '#ffd166']

export function Cuenta() {
  const { member, memberId, user, db, signOut } = useSession()
  const toast = useToast()
  const [alias, setAlias] = useState(member?.alias ?? '')
  const [color, setColor] = useState(member?.avatarColor ?? colorFor(memberId ?? ''))
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (member) {
      setAlias(member.alias)
      setColor(member.avatarColor ?? colorFor(member.id))
    }
  }, [member])
  if (!member || !memberId) return null

  async function save() {
    const value = alias.trim()
    if (value.length < 2 || value.length > 24) {
      toast.error('El alias tiene que tener entre 2 y 24 caracteres.')
      return
    }
    setBusy(true)
    try {
      await db.updateDoc(P.member(memberId!), { alias: value, avatarColor: color, consentAt: member!.consentAt ?? Date.now(), updatedAt: Date.now() })
      toast.ok('Guardado')
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader eyebrow="Mi cuenta" title="Cómo te ve la banda" intro="Tu alias y color se muestran en la lista de miembros y en los premios. Tu mail no se muestra a nadie." />
      <div className="grid md:grid-cols-[1.4fr_1fr] gap-4">
        <Card>
          <div className="flex items-center gap-4 mb-4">
            <Avatar id={memberId} alias={alias || member.alias} size={56} color={color} />
            <div>
              <p className="font-bold">{alias || member.alias}</p>
              <p className="tiny muted">{user?.email}</p>
            </div>
          </div>
          <Field label="Alias" id="alias" hint="Cómo te dicen en el grupo.">
            <Input id="alias" value={alias} onChange={(e) => setAlias(e.target.value)} maxLength={24} />
          </Field>
          <p className="label">Color</p>
          <div className="flex gap-2 flex-wrap mb-4" role="radiogroup" aria-label="Color del avatar">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={color === c}
                aria-label={`Color ${c}`}
                onClick={() => setColor(c)}
                className="w-11 h-11 rounded-full border-4"
                style={{ background: c, borderColor: color === c ? 'var(--text)' : 'transparent' }}
              />
            ))}
          </div>
          <Button variant="gold" onClick={() => void save()} loading={busy}>
            Guardar
          </Button>
        </Card>
        <Card>
          <p className="h3">Sesión</p>
          <p className="small muted mt-1">Si cerrás sesión, para volver a entrar pedís un link nuevo al mail.</p>
          <Button variant="line" className="mt-4" onClick={() => void signOut()}>
            Cerrar sesión
          </Button>
          <hr className="border-line my-5" />
          <p className="h3">Privacidad</p>
          <p className="small muted mt-1">
            Tus votos de premios y tu amigo invisible no se muestran al grupo. Agus puede acceder a información reservada para resolver incidencias, y
            esos accesos quedan registrados.
          </p>
        </Card>
      </div>
    </div>
  )
}
