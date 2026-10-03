// Entrar con usuario y contraseña. No pide mail. Se puede seguir mirando como visitante.
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { GRUPO } from '../content/config'
import { useSession } from '../data/DataContext'
import { loginWithUsername } from '../data/accounts'
import { errorText } from '../data/actions'
import { demoAccounts } from '../data/demoSeed'
import { Button, Field, Input, Notice } from '../ui/components'

const LOGO = import.meta.env.BASE_URL + 'logo.webp'

export function Login() {
  const { db, auth, demo, status, member } = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Ya entró: volver a donde estaba.
  useEffect(() => {
    if (status === 'ready') navigate(from, { replace: true })
  }, [status, from, navigate])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await loginWithUsername(db, auth, username, password)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-[70dvh] flex items-center justify-center py-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <img src={LOGO} alt="" className="w-24 h-24 rounded-full object-cover mx-auto shadow-lg" />
          <h1 className="h1 mt-3">{GRUPO.nombre}</h1>
        </div>
        <div className="card p-5">
          {status === 'no-access' || status === 'suspended' ? (
            <Notice tone="warn">
              {status === 'suspended' ? 'Tu acceso está pausado. Hablá con Agus.' : 'Esa cuenta ya no está activa. Pedile a Agus que te pase tu usuario de nuevo.'}
            </Notice>
          ) : null}
          {status === 'ready' && member ? <Notice tone="ok">Ya entraste como {member.alias}.</Notice> : null}
          <form onSubmit={submit} className="mt-1">
            <Field label="Usuario" id="login-user">
              <Input id="login-user" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="ej. facu" required />
            </Field>
            <Field label="Contraseña" id="login-pass">
              <Input id="login-pass" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </Field>
            {error ? (
              <p className="small text-danger mb-3" role="alert">
                {error}
              </p>
            ) : null}
            <Button type="submit" variant="gold" className="w-full" loading={busy}>
              Entrar
            </Button>
          </form>
          <p className="tiny muted mt-4">¿No tenés usuario o te olvidaste la contraseña? Pedíselo a Agus por WhatsApp.</p>
          {demo ? <DemoQuickLogin /> : null}
        </div>
        <p className="text-center mt-4">
          <Link to="/" className="small underline muted">
            Seguir mirando sin entrar
          </Link>
        </p>
      </div>
    </div>
  )
}

function DemoQuickLogin() {
  const { auth } = useSession()
  const accounts = demoAccounts()
  const [who, setWho] = useState(accounts[0].id)
  const chosen = accounts.find((a) => a.id === who)!
  return (
    <div className="mt-5 pt-4 border-t border-line">
      <Notice tone="warn">
        <b>Modo demostración.</b> Entrá rápido como alguien de ejemplo (contraseña de todos: demo123).
      </Notice>
      <div className="flex gap-2 mt-3">
        <select className="input" aria-label="Entrar como" value={who} onChange={(e) => setWho(e.target.value)}>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
        <Button variant="line" onClick={() => void auth.demoSignIn?.(chosen.uid, chosen.email)}>
          Entrar
        </Button>
      </div>
    </div>
  )
}
