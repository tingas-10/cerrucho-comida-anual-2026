// Autenticación con usuario y contraseña (Firebase por dentro, con un mail interno inventado) o demo.
import { deleteApp, initializeApp } from 'firebase/app'
import {
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  inMemoryPersistence,
  initializeAuth,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  type Auth,
  type User,
} from 'firebase/auth'
import { isInternalEmail } from '../domain/accounts'
import { DataError, randomId, type AuthAdapter, type AuthUser } from './adapter'
import { getFirebaseApp, type FirebaseWebConfig } from './firestoreAdapter'

function toUser(u: User): AuthUser {
  const email = (u.email ?? '').toLowerCase()
  return { uid: u.uid, email, emailVerified: u.emailVerified, passwordLogin: isInternalEmail(email) }
}

function mapAuthError(e: unknown): Error {
  const code = (e as { code?: string })?.code ?? ''
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found') || code.includes('invalid-email'))
    return new DataError('BAD_LOGIN', 'Usuario o contraseña incorrectos.')
  if (code.includes('too-many-requests')) return new DataError('RATE_LIMITED', 'Demasiados intentos. Esperá unos minutos y probá de nuevo.')
  if (code.includes('email-already-in-use')) return new DataError('TAKEN', 'Ese usuario ya existe.')
  if (code.includes('weak-password')) return new DataError('WEAK', 'La contraseña es muy corta.')
  if (code.includes('network')) return new DataError('OFFLINE', 'Sin conexión. Probá de nuevo.')
  if (code.includes('requires-recent-login')) return new DataError('REAUTH', 'Volvé a entrar y probá de nuevo.')
  return new DataError(code || 'AUTH', (e as Error)?.message ?? 'No se pudo completar.')
}

export class FirebaseAuthAdapter implements AuthAdapter {
  readonly kind = 'firebase' as const
  private auth: Auth
  private config: FirebaseWebConfig

  constructor(config: FirebaseWebConfig) {
    this.config = config
    this.auth = getAuth(getFirebaseApp(config))
    this.auth.languageCode = 'es'
  }

  onChange(cb: (user: AuthUser | null) => void): () => void {
    return onAuthStateChanged(this.auth, (u) => cb(u ? toUser(u) : null))
  }

  async signIn(email: string, password: string): Promise<void> {
    try {
      await signInWithEmailAndPassword(this.auth, email, password)
    } catch (e) {
      throw mapAuthError(e)
    }
  }

  async createLogin(email: string, password: string): Promise<string> {
    // App secundaria en memoria: crear la cuenta no cierra la sesión del administrador.
    const app = initializeApp(this.config, 'alta-' + randomId(8))
    try {
      const auth = initializeAuth(app, { persistence: inMemoryPersistence })
      const cred = await createUserWithEmailAndPassword(auth, email, password)
      const uid = cred.user.uid
      await signOut(auth)
      return uid
    } catch (e) {
      throw mapAuthError(e)
    } finally {
      await deleteApp(app).catch(() => undefined)
    }
  }

  async changePassword(current: string, next: string): Promise<void> {
    const u = this.auth.currentUser
    if (!u || !u.email) throw new DataError('SESSION_REQUIRED', 'Tenés que entrar primero.')
    try {
      await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, current))
    } catch (e) {
      const err = mapAuthError(e)
      if ((err as DataError).code === 'BAD_LOGIN') throw new DataError('BAD_LOGIN', 'La contraseña actual no es correcta.')
      throw err
    }
    try {
      await updatePassword(u, next)
    } catch (e) {
      throw mapAuthError(e)
    }
  }

  async signOut(): Promise<void> {
    await signOut(this.auth)
  }
}

// ---------- Demo ----------
const DEMO_KEY = 'cerrucho-demo-user'
const DEMO_ACCOUNTS_KEY = 'cerrucho-demo-accounts'

/** En demo las cuentas viven en localStorage: { email: { uid, password } }. */
function loadAccounts(): Record<string, { uid: string; password: string }> {
  try {
    return JSON.parse(localStorage.getItem(DEMO_ACCOUNTS_KEY) ?? '{}')
  } catch {
    return {}
  }
}
function saveAccounts(a: Record<string, { uid: string; password: string }>) {
  try {
    localStorage.setItem(DEMO_ACCOUNTS_KEY, JSON.stringify(a))
  } catch {
    /* nada */
  }
}

export class DemoAuthAdapter implements AuthAdapter {
  readonly kind = 'demo' as const
  private listeners = new Set<(u: AuthUser | null) => void>()
  private user: AuthUser | null = null

  constructor() {
    try {
      const raw = localStorage.getItem(DEMO_KEY)
      if (raw) this.user = JSON.parse(raw) as AuthUser
    } catch {
      /* nada */
    }
  }

  onChange(cb: (user: AuthUser | null) => void): () => void {
    this.listeners.add(cb)
    cb(this.user)
    return () => this.listeners.delete(cb)
  }

  private emit() {
    try {
      if (this.user) localStorage.setItem(DEMO_KEY, JSON.stringify(this.user))
      else localStorage.removeItem(DEMO_KEY)
    } catch {
      /* nada */
    }
    for (const l of this.listeners) l(this.user)
  }

  async signIn(email: string, password: string): Promise<void> {
    const acc = loadAccounts()[email.toLowerCase()]
    if (!acc || acc.password !== password) throw new DataError('BAD_LOGIN', 'Usuario o contraseña incorrectos.')
    this.user = { uid: acc.uid, email: email.toLowerCase(), emailVerified: false, passwordLogin: true }
    this.emit()
  }

  async createLogin(email: string, password: string): Promise<string> {
    const all = loadAccounts()
    if (all[email.toLowerCase()]) throw new DataError('TAKEN', 'Ese usuario ya existe.')
    const uid = 'demo-' + randomId(10)
    all[email.toLowerCase()] = { uid, password }
    saveAccounts(all)
    return uid
  }

  async changePassword(current: string, next: string): Promise<void> {
    if (!this.user) throw new DataError('SESSION_REQUIRED', 'Tenés que entrar primero.')
    const all = loadAccounts()
    const acc = all[this.user.email]
    if (!acc || acc.password !== current) throw new DataError('BAD_LOGIN', 'La contraseña actual no es correcta.')
    acc.password = next
    saveAccounts(all)
  }

  async signOut(): Promise<void> {
    this.user = null
    this.emit()
  }

  async demoSignIn(uid: string, email: string): Promise<void> {
    this.user = { uid, email: email.toLowerCase(), emailVerified: true, passwordLogin: true }
    this.emit()
  }
}

export function demoRegisterAccount(email: string, uid: string, password: string) {
  const all = loadAccounts()
  all[email.toLowerCase()] = { uid, password }
  saveAccounts(all)
}

export function demoResetAccounts() {
  try {
    localStorage.removeItem(DEMO_ACCOUNTS_KEY)
  } catch {
    /* nada */
  }
}
