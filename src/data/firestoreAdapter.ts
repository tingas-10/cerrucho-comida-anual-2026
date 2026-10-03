// Implementación sobre Firebase Firestore.
import { initializeApp, type FirebaseApp } from 'firebase/app'
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  type Firestore,
  type QueryConstraint,
} from 'firebase/firestore'
import { DataError, randomId, type DataAdapter, type QueryFilter, type Tx, type WithId } from './adapter'

export interface FirebaseWebConfig {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket?: string
  messagingSenderId?: string
  appId: string
}

let app: FirebaseApp | null = null

export function getFirebaseApp(config: FirebaseWebConfig): FirebaseApp {
  if (!app) app = initializeApp(config)
  return app
}

function constraints(filters: QueryFilter[] = []): QueryConstraint[] {
  return filters.map((f) => where(f.field, f.op, f.value))
}

function mapError(e: unknown): Error {
  const err = e as { code?: string; message?: string }
  const code = err?.code ?? 'UNKNOWN'
  if (code.includes('permission-denied')) return new DataError('ACCESS_DENIED', 'No tenés permiso para hacer eso.')
  if (code.includes('unavailable')) return new DataError('OFFLINE', 'Sin conexión. Probá de nuevo.')
  return new DataError(code, err?.message ?? 'Error inesperado')
}

export class FirestoreAdapter implements DataAdapter {
  readonly kind = 'firestore' as const
  private db: Firestore

  constructor(config: FirebaseWebConfig) {
    this.db = getFirestore(getFirebaseApp(config))
  }

  newId(): string {
    return randomId()
  }

  async getDoc<T>(path: string): Promise<T | null> {
    try {
      const snap = await getDoc(doc(this.db, path))
      return snap.exists() ? (snap.data() as T) : null
    } catch (e) {
      throw mapError(e)
    }
  }

  async setDoc<T extends object>(path: string, data: T, opts?: { merge?: boolean }): Promise<void> {
    try {
      await setDoc(doc(this.db, path), data, { merge: opts?.merge ?? false })
    } catch (e) {
      throw mapError(e)
    }
  }

  async updateDoc(path: string, data: Record<string, unknown>): Promise<void> {
    try {
      await updateDoc(doc(this.db, path), data)
    } catch (e) {
      throw mapError(e)
    }
  }

  async deleteDoc(path: string): Promise<void> {
    try {
      await deleteDoc(doc(this.db, path))
    } catch (e) {
      throw mapError(e)
    }
  }

  async getCollection<T>(path: string, filters?: QueryFilter[]): Promise<WithId<T>[]> {
    try {
      const snap = await getDocs(query(collection(this.db, path), ...constraints(filters)))
      return snap.docs.map((d) => ({ ...(d.data() as T), id: d.id }))
    } catch (e) {
      throw mapError(e)
    }
  }

  subscribeDoc<T>(path: string, cb: (data: T | null) => void, onError?: (e: Error) => void): () => void {
    return onSnapshot(
      doc(this.db, path),
      (snap) => cb(snap.exists() ? (snap.data() as T) : null),
      (e) => onError?.(mapError(e)),
    )
  }

  subscribeCollection<T>(
    path: string,
    cb: (rows: WithId<T>[]) => void,
    filters?: QueryFilter[],
    onError?: (e: Error) => void,
  ): () => void {
    return onSnapshot(
      query(collection(this.db, path), ...constraints(filters)),
      (snap) => cb(snap.docs.map((d) => ({ ...(d.data() as T), id: d.id }))),
      (e) => onError?.(mapError(e)),
    )
  }

  async runTransaction<R>(fn: (tx: Tx) => Promise<R>): Promise<R> {
    try {
      return await runTransaction(this.db, async (t) => {
        const tx: Tx = {
          get: async <T,>(path: string) => {
            const snap = await t.get(doc(this.db, path))
            return snap.exists() ? (snap.data() as T) : null
          },
          set: (path, data, opts) => {
            t.set(doc(this.db, path), data, { merge: opts?.merge ?? false })
          },
          update: (path, data) => {
            t.update(doc(this.db, path), data)
          },
          delete: (path) => {
            t.delete(doc(this.db, path))
          },
        }
        return fn(tx)
      })
    } catch (e) {
      if (e instanceof DataError) throw e
      throw mapError(e)
    }
  }
}
