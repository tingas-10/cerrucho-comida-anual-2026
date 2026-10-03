// Hooks de lectura en vivo sobre el adaptador de datos.
import { useEffect, useMemo, useState } from 'react'
import type { QueryFilter, WithId } from './adapter'
import { useSession } from './DataContext'
import { P } from './paths'
import type { Edition, Member, Poll } from './types'

export interface DocState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

export function useDoc<T>(path: string | null): DocState<T> {
  const { db } = useSession()
  const [state, setState] = useState<DocState<T>>({ data: null, loading: !!path, error: null })
  useEffect(() => {
    if (!path) {
      setState({ data: null, loading: false, error: null })
      return
    }
    setState((s) => ({ ...s, loading: true, error: null }))
    const unsub = db.subscribeDoc<T>(
      path,
      (data) => setState({ data, loading: false, error: null }),
      (e) => setState({ data: null, loading: false, error: e.message }),
    )
    return unsub
  }, [db, path])
  return state
}

export interface ColState<T> {
  rows: WithId<T>[]
  loading: boolean
  error: string | null
}

export function useCollection<T>(path: string | null, filters?: QueryFilter[]): ColState<T> {
  const { db } = useSession()
  const key = JSON.stringify(filters ?? [])
  const [state, setState] = useState<ColState<T>>({ rows: [], loading: !!path, error: null })
  useEffect(() => {
    if (!path) {
      setState({ rows: [], loading: false, error: null })
      return
    }
    setState((s) => ({ ...s, loading: true, error: null }))
    const unsub = db.subscribeCollection<T>(
      path,
      (rows) => setState({ rows, loading: false, error: null }),
      JSON.parse(key) as QueryFilter[],
      (e) => setState({ rows: [], loading: false, error: e.message }),
    )
    return unsub
  }, [db, path, key])
  return state
}

export function useEdition(): DocState<Edition> {
  const { slug } = useSession()
  return useDoc<Edition>(P.edition(slug))
}

export interface MembersIndex {
  list: WithId<Member>[]
  active: WithId<Member>[]
  byId: Record<string, WithId<Member>>
  aliasOf: (id: string) => string
  loading: boolean
}

export function useMembers(): MembersIndex {
  const { rows, loading } = useCollection<Member>(P.members)
  return useMemo(() => {
    const byId: Record<string, WithId<Member>> = {}
    for (const m of rows) byId[m.id] = m
    const list = [...rows].sort((a, b) => a.alias.localeCompare(b.alias, 'es'))
    const active = list.filter((m) => m.status === 'active')
    return {
      list,
      active,
      byId,
      aliasOf: (id: string) => (id === 'NOBODY' ? 'Nadie lo merece' : (byId[id]?.alias ?? '—')),
      loading,
    }
  }, [rows, loading])
}

/** Electores de una consulta: congelados, o todos los activos que participan si es ALL_ACTIVE. */
export function electorateOf(poll: Poll, members: MembersIndex): string[] {
  if (poll.electorateMode === 'ALL_ACTIVE') return members.active.filter((m) => m.participating).map((m) => m.id)
  return poll.electorate
}

/** Suscribe varios documentos a la vez (por ejemplo, mis respuestas de cada encuesta). */
export function useDocs<T>(paths: string[]): { docs: Record<string, T | null>; loading: boolean } {
  const { db } = useSession()
  const key = JSON.stringify(paths)
  const [docs, setDocs] = useState<Record<string, T | null>>({})
  const [loading, setLoading] = useState(paths.length > 0)
  useEffect(() => {
    const list = JSON.parse(key) as string[]
    if (list.length === 0) {
      setDocs({})
      setLoading(false)
      return
    }
    setLoading(true)
    let pending = list.length
    const unsubs = list.map((p) =>
      db.subscribeDoc<T>(p, (data) => {
        setDocs((d) => ({ ...d, [p]: data }))
        if (pending > 0) {
          pending--
          if (pending === 0) setLoading(false)
        }
      }),
    )
    return () => unsubs.forEach((u) => u())
  }, [db, key])
  return { docs, loading }
}

/** Reloj que avanza cada `ms` para recalcular cierres y cuentas regresivas. */
export function useNow(ms = 30000): number {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}
