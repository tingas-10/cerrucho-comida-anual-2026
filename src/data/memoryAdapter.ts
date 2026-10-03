// Implementación en memoria (modo demo). Persiste en localStorage para que
// recargar la página no pierda lo hecho. Soporta rutas "a/b/c/d" y paths con punto
// en updateDoc ("volunteers.m1").
import { DataError, randomId, type DataAdapter, type QueryFilter, type Tx, type WithId } from './adapter'

const STORAGE_KEY = 'cerrucho-demo-db-v1'

type Doc = Record<string, unknown>

function clone<T>(v: T): T {
  return v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T)
}

function parentCollection(path: string): string {
  const parts = path.split('/')
  parts.pop()
  return parts.join('/')
}

function matches(doc: Doc, filters: QueryFilter[] = []): boolean {
  return filters.every((f) => {
    const v = getPath(doc, f.field)
    switch (f.op) {
      case '==':
        return v === f.value
      case '!=':
        return v !== f.value
      case 'in':
        return Array.isArray(f.value) && (f.value as unknown[]).includes(v)
      case 'array-contains':
        return Array.isArray(v) && v.includes(f.value)
      default:
        return false
    }
  })
}

function getPath(obj: Doc, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, k) => (acc && typeof acc === 'object' ? (acc as Doc)[k] : undefined), obj)
}

function setPath(obj: Doc, path: string, value: unknown) {
  const keys = path.split('.')
  let cur: Doc = obj
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i]
    if (!cur[k] || typeof cur[k] !== 'object') cur[k] = {}
    cur = cur[k] as Doc
  }
  cur[keys[keys.length - 1]] = value
}

export class MemoryAdapter implements DataAdapter {
  readonly kind = 'memory' as const
  private docs = new Map<string, Doc>()
  private listeners = new Set<() => void>()
  private persist: boolean

  constructor(opts: { persist?: boolean } = {}) {
    this.persist = opts.persist ?? true
    if (this.persist) this.load()
  }

  private load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, Doc>
        for (const [k, v] of Object.entries(parsed)) this.docs.set(k, v)
      }
    } catch {
      /* sin storage */
    }
  }

  private save() {
    if (!this.persist) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(this.docs)))
    } catch {
      /* sin storage */
    }
  }

  reset() {
    this.docs.clear()
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* nada */
    }
    this.emit()
  }

  get size() {
    return this.docs.size
  }

  private emit() {
    this.save()
    for (const l of Array.from(this.listeners)) l()
  }

  newId(): string {
    return randomId()
  }

  async getDoc<T>(path: string): Promise<T | null> {
    const d = this.docs.get(path)
    return d ? (clone(d) as T) : null
  }

  async setDoc<T extends object>(path: string, data: T, opts?: { merge?: boolean }): Promise<void> {
    this.setSync(path, data, opts)
    this.emit()
  }

  private setSync<T extends object>(path: string, data: T, opts?: { merge?: boolean }) {
    const existing = this.docs.get(path)
    if (opts?.merge && existing) this.docs.set(path, { ...existing, ...clone(data as Doc) })
    else this.docs.set(path, clone(data as Doc))
  }

  async updateDoc(path: string, data: Record<string, unknown>): Promise<void> {
    this.updateSync(path, data)
    this.emit()
  }

  private updateSync(path: string, data: Record<string, unknown>) {
    const existing = this.docs.get(path)
    if (!existing) throw new DataError('NOT_FOUND', `No existe ${path}`)
    const next = clone(existing)
    for (const [k, v] of Object.entries(data)) setPath(next, k, clone(v))
    this.docs.set(path, next)
  }

  async deleteDoc(path: string): Promise<void> {
    this.docs.delete(path)
    this.emit()
  }

  private query<T>(path: string, filters?: QueryFilter[]): WithId<T>[] {
    const out: WithId<T>[] = []
    for (const [k, v] of this.docs) {
      if (parentCollection(k) !== path) continue
      if (!matches(v, filters)) continue
      out.push({ ...(clone(v) as T), id: k.split('/').pop()! })
    }
    return out
  }

  async getCollection<T>(path: string, filters?: QueryFilter[]): Promise<WithId<T>[]> {
    return this.query<T>(path, filters)
  }

  subscribeDoc<T>(path: string, cb: (data: T | null) => void): () => void {
    let last = JSON.stringify(this.docs.get(path) ?? null)
    cb(this.docs.has(path) ? (clone(this.docs.get(path)) as T) : null)
    const l = () => {
      const cur = JSON.stringify(this.docs.get(path) ?? null)
      if (cur !== last) {
        last = cur
        cb(this.docs.has(path) ? (clone(this.docs.get(path)) as T) : null)
      }
    }
    this.listeners.add(l)
    return () => this.listeners.delete(l)
  }

  subscribeCollection<T>(path: string, cb: (rows: WithId<T>[]) => void, filters?: QueryFilter[]): () => void {
    let last = ''
    const run = () => {
      const rows = this.query<T>(path, filters)
      const cur = JSON.stringify(rows)
      if (cur !== last) {
        last = cur
        cb(rows)
      }
    }
    run()
    this.listeners.add(run)
    return () => this.listeners.delete(run)
  }

  async runTransaction<R>(fn: (tx: Tx) => Promise<R>): Promise<R> {
    const ops: Array<() => void> = []
    const tx: Tx = {
      get: async <T,>(path: string) => this.getDoc<T>(path),
      set: (path, data, opts) => ops.push(() => this.setSync(path, data, opts)),
      update: (path, data) => ops.push(() => this.updateSync(path, data)),
      delete: (path) => ops.push(() => this.docs.delete(path)),
    }
    const result = await fn(tx)
    for (const op of ops) op()
    this.emit()
    return result
  }
}
