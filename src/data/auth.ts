// Autenticación: Firebase (link por mail, sin contraseña) o demo.
import {
  getAuth,
  isSignInWithEmailLink,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signOut,
  type Auth,
} from 'firebase/auth'
import type { AuthAdapter, AuthUser } from './adapter'
import { getFirebaseApp, type FirebaseWebConfig } from './firestoreAdapter'

const EMAIL_KEY = 'cerrucho-login-email'

export class FirebaseAuthAdapter implements AuthAdapter {
  readonly kind = 'firebase' as const
  private auth: Auth

  constructor(config: FirebaseWebConfig) {
    this.auth = getAuth(getFirebaseApp(config))
    this.auth.languageCode = 'es'
  }

  onChange(cb: (user: AuthUser | null) => void): () => void {
    return onAuthStateChanged(this.auth, (u) => {
      if (!u || !u.email) cb(null)
      else cb({ uid: u.uid, email: u.email.toLowerCase(), emailVerified: u.emailVerified })
    })
  }

  async sendLink(email: string, returnTo: string): Promise<void> {
    const normalized = email.trim().toLowerCase()
    await sendSignInLinkToEmail(this.auth, normalized, {
      url: returnTo,
      handleCodeInApp: true,
    })
    try {
      localStorage.setItem(EMAIL_KEY, normalized)
    } catch {
      /* sin storage */
    }
  }

  isLinkSignIn(): boolean {
    return isSignInWithEmailLink(this.auth, window.location.href)
  }

  async completeLink(email: string): Promise<AuthUser> {
    const cred = await signInWithEmailLink(this.auth, email.trim().toLowerCase(), window.location.href)
    try {
      localStorage.removeItem(EMAIL_KEY)
    } catch {
      /* nada */
    }
    const u = cred.user
    return { uid: u.uid, email: (u.email ?? email).toLowerCase(), emailVerified: u.emailVerified }
  }

  storedEmail(): string | null {
    try {
      return localStorage.getItem(EMAIL_KEY)
    } catch {
      return null
    }
  }

  async signOut(): Promise<void> {
    await signOut(this.auth)
  }
}

// ---------- Demo ----------
const DEMO_KEY = 'cerrucho-demo-user'

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

  async sendLink(): Promise<void> {
    // En demo no se manda nada: el login se hace eligiendo un usuario ficticio.
  }

  isLinkSignIn(): boolean {
    return false
  }

  async completeLink(email: string): Promise<AuthUser> {
    await this.demoSignIn('demo-' + email, email)
    return this.user!
  }

  storedEmail(): string | null {
    return null
  }

  async signOut(): Promise<void> {
    this.user = null
    this.emit()
  }

  async demoSignIn(uid: string, email: string): Promise<void> {
    this.user = { uid, email: email.toLowerCase(), emailVerified: true }
    this.emit()
  }
}
