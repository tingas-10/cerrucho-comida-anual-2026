// Pantalla pública: sólo marca genérica y acceso por mail. Sin fotos ni datos del evento.
import { useEffect, useState, type FormEvent } from 'react'
import { GRUPO, TEXTOS } from '../content/config'
import { useSession } from '../data/DataContext'
import { DEMO_ACTIVE_ALIASES, DEMO_OWNER_UID, demoEmailFor } from '../data/demoSeed'
import { slugify } from '../data/seed'
import { Button, Field, Input, Notice } from '../ui/components'
import { useTheme } from '../ui/theme'

export function Login({ returnTo }: { returnTo: string }) {
  const { auth, demo } = useSession()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)
  const [needEmail, setNeedEmail] = useState(false)
  useTheme()

  // Si venimos del link del mail, completar el ingreso.
  useEffect(() => {
    if (!auth.isLinkSignIn()) return
    const stored = auth.storedEmail()
    if (!stored) {
      setNeedEmail(true)
      return
    }
    setBusy(true)
    auth
      .completeLink(stored)
      .catch((e: Error) => setError(mapAuthError(e)))
      .finally(() => setBusy(false))
  }, [auth])

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const value = email.trim().toLowerCase()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
      setError('Revisá el mail.')
      return
    }
    setBusy(true)
    try {
      if (needEmail) {
        await auth.completeLink(value)
        return
      }
      const base = window.location.href.split('#')[0]
      await auth.sendLink(value, `${base}#${returnTo && returnTo !== '/' ? returnTo : '/entrar'}`)
      setSent(true)
      setCooldown(60)
    } catch (err) {
      setError(mapAuthError(err as Error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center p-5 bg-bg">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <p className="font-serif text-gold text-5xl font-bold">C</p>
          <h1 className="h1 mt-3">{GRUPO.nombre}</h1>
          <p className="eyebrow mt-2">Cena de fin de año</p>
        </div>
        <div className="card p-6">
          {demo ? (
            <DemoLogin />
          ) : sent ? (
            <div>
              <Notice tone="ok">{TEXTOS.loginRespuesta}</Notice>
              <p className="small muted mt-4">
                Abrí el mail en este mismo celular o computadora y tocá el link. Si no llega, revisá spam.
              </p>
              <div className="flex gap-2 mt-4">
                <Button variant="line" onClick={() => setSent(false)} disabled={cooldown > 0}>
                  {cooldown > 0 ? `Reenviar en ${cooldown} s` : 'Reenviar o corregir el mail'}
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={submit}>
              {needEmail ? <Notice>Confirmá tu mail para terminar de entrar.</Notice> : null}
              <Field label="Tu mail" id="email" hint={TEXTOS.loginAyuda}>
                <Input id="email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@mail.com" required autoFocus />
              </Field>
              {error ? <p className="small text-danger mb-3">{error}</p> : null}
              <Button type="submit" variant="gold" className="w-full" loading={busy}>
                {needEmail ? 'Entrar' : 'Enviarme el link para entrar'}
              </Button>
              <p className="tiny muted mt-4">Sin contraseña: te mandamos un link que vence en poco tiempo.</p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

function DemoLogin() {
  const { auth } = useSession()
  const [who, setWho] = useState('owner')
  const options: Array<{ id: string; label: string; email: string; uid: string }> = [
    { id: 'owner', label: `${GRUPO.ownerAlias} (administrador)`, email: GRUPO.ownerEmail as string, uid: DEMO_OWNER_UID },
    ...DEMO_ACTIVE_ALIASES.map((a) => ({ id: 'm-' + slugify(a), label: a, email: demoEmailFor(a), uid: 'demo-m-' + slugify(a) })),
  ]
  const chosen = options.find((o) => o.id === who)!
  return (
    <div>
      <Notice tone="warn">
        <b>Modo demostración.</b> Elegí con quién entrar. Nada se guarda en un servidor.
      </Notice>
      <Field label="Entrar como" id="demo-user">
        <select id="demo-user" className="input" value={who} onChange={(e) => setWho(e.target.value)}>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>
      <Button variant="gold" className="w-full" onClick={() => void auth.demoSignIn?.(chosen.uid, chosen.email)}>
        Entrar
      </Button>
    </div>
  )
}

function mapAuthError(e: Error & { code?: string }): string {
  const code = e.code ?? ''
  if (code.includes('invalid-action-code') || code.includes('expired-action-code')) return 'El link venció o ya se usó. Pedí uno nuevo.'
  if (code.includes('too-many-requests')) return 'Demasiados intentos. Esperá un rato y probá de nuevo.'
  if (code.includes('invalid-email')) return 'Revisá el mail.'
  if (code.includes('unauthorized-continue-uri') || code.includes('unauthorized-domain')) return 'Este dominio no está autorizado en Firebase. Avisale a Agus.'
  return 'No se pudo completar. Probá de nuevo.'
}
