// Interfaz mínima de acceso a datos. Hay dos implementaciones:
// - firestoreAdapter: producción (Firebase).
// - memoryAdapter: modo demo (en memoria + localStorage), sin backend.
// Las pantallas y el repositorio sólo usan esta interfaz.

export type FilterOp = '==' | 'in' | 'array-contains' | '!='

export interface QueryFilter {
  field: string
  op: FilterOp
  value: unknown
}

export type WithId<T> = T & { id: string }

export interface Tx {
  get<T>(path: string): Promise<T | null>
  set<T extends object>(path: string, data: T, opts?: { merge?: boolean }): void
  update(path: string, data: Record<string, unknown>): void
  delete(path: string): void
}

export interface DataAdapter {
  readonly kind: 'firestore' | 'memory'
  getDoc<T>(path: string): Promise<T | null>
  setDoc<T extends object>(path: string, data: T, opts?: { merge?: boolean }): Promise<void>
  updateDoc(path: string, data: Record<string, unknown>): Promise<void>
  deleteDoc(path: string): Promise<void>
  getCollection<T>(path: string, filters?: QueryFilter[]): Promise<WithId<T>[]>
  subscribeDoc<T>(path: string, cb: (data: T | null) => void, onError?: (e: Error) => void): () => void
  subscribeCollection<T>(
    path: string,
    cb: (rows: WithId<T>[]) => void,
    filters?: QueryFilter[],
    onError?: (e: Error) => void,
  ): () => void
  runTransaction<R>(fn: (tx: Tx) => Promise<R>): Promise<R>
  newId(): string
}

export interface AuthUser {
  uid: string
  email: string
  emailVerified: boolean
}

export interface AuthAdapter {
  readonly kind: 'firebase' | 'demo'
  onChange(cb: (user: AuthUser | null) => void): () => void
  sendLink(email: string, returnTo: string): Promise<void>
  isLinkSignIn(): boolean
  completeLink(email: string): Promise<AuthUser>
  storedEmail(): string | null
  signOut(): Promise<void>
  // Sólo demo: entrar como un usuario ficticio.
  demoSignIn?(uid: string, email: string): Promise<void>
}

export class DataError extends Error {
  code: string
  constructor(code: string, message?: string) {
    super(message ?? code)
    this.code = code
  }
}

export function randomId(len = 20): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = new Uint8Array(len)
  crypto.getRandomValues(bytes)
  let out = ''
  for (let i = 0; i < len; i++) out += chars[bytes[i] % chars.length]
  return out
}
