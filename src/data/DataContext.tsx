// Sesión: adaptadores, usuario autenticado y miembro resuelto.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { EDICION_ACTUAL, GRUPO } from '../content/config'
import type { AuthAdapter, AuthUser, DataAdapter } from './adapter'
import { DemoAuthAdapter, FirebaseAuthAdapter } from './auth'
import { seedDemo } from './demoSeed'
import { IS_DEMO, firebaseConfig } from './env'
import { FirestoreAdapter } from './firestoreAdapter'
import { MemoryAdapter } from './memoryAdapter'
import { P } from './paths'
import { ensureEdition, ensureOwnerAndDrafts } from './seed'
import type { Member, MemberPrivate } from './types'

export type SessionStatus = 'loading' | 'anon' | 'not-member' | 'suspended' | 'ready'

export interface Session {
  db: DataAdapter
  auth: AuthAdapter
  demo: boolean
  user: AuthUser | null
  member: Member | null
  memberId: string | null
  isAdmin: boolean
  status: SessionStatus
  slug: string
  error: string | null
  signOut: () => Promise<void>
  resetDemo: () => void
}

const Ctx = createContext<Session | null>(null)

function buildAdapters(): { db: DataAdapter; auth: AuthAdapter } {
  if (IS_DEMO || !firebaseConfig) {
    const db = new MemoryAdapter()
    return { db, auth: new DemoAuthAdapter() }
  }
  return { db: new FirestoreAdapter(firebaseConfig), auth: new FirebaseAuthAdapter(firebaseConfig) }
}

export function DataProvider({ children }: { children: ReactNode }) {
  const adapters = useMemo(buildAdapters, [])
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined)
  const [member, setMember] = useState<Member | null>(null)
  const [memberId, setMemberId] = useState<string | null>(null)
  const [status, setStatus] = useState<SessionStatus>('loading')
  const [error, setError] = useState<string | null>(null)
  const [demoReady, setDemoReady] = useState(!IS_DEMO)
  const unsubMember = useRef<(() => void) | null>(null)

  // Demo: sembrar datos de ejemplo una sola vez.
  useEffect(() => {
    if (!IS_DEMO) return
    const db = adapters.db as MemoryAdapter
    seedDemo(db).then(() => setDemoReady(true))
  }, [adapters])

  useEffect(() => adapters.auth.onChange((u) => setUser(u)), [adapters])

  // Resolver miembro a partir del usuario autenticado.
  useEffect(() => {
    if (!demoReady || user === undefined) return
    unsubMember.current?.()
    unsubMember.current = null
    setMember(null)
    setMemberId(null)
    setError(null)
    if (!user) {
      setStatus('anon')
      return
    }
    let cancelled = false
    setStatus('loading')
    ;(async () => {
      try {
        const db = adapters.db
        const email = user.email.toLowerCase()
        let id: string | null = null
        const isOwnerEmail = email === GRUPO.ownerEmail.toLowerCase()
        if (isOwnerEmail) {
          await ensureOwnerAndDrafts(db, user.uid, email)
          await ensureEdition(db)
          id = 'owner'
        } else {
          const rows = await db.getCollection<MemberPrivate>(P.memberPrivates, [{ field: 'email', op: '==', value: email }])
          id = rows[0]?.id ?? null
        }
        if (cancelled) return
        if (!id) {
          setStatus('not-member')
          return
        }
        const m = await db.getDoc<Member>(P.member(id))
        if (!m || m.status === 'draft') {
          setStatus('not-member')
          return
        }
        if (m.status === 'suspended') {
          setStatus('suspended')
          return
        }
        if (m.uid !== user.uid) {
          await db.updateDoc(P.member(id), { uid: user.uid, updatedAt: Date.now() })
          await db.setDoc(P.uid(user.uid), { memberId: id })
        } else {
          const link = await db.getDoc(P.uid(user.uid))
          if (!link) await db.setDoc(P.uid(user.uid), { memberId: id })
        }
        setMemberId(id)
        unsubMember.current = db.subscribeDoc<Member>(
          P.member(id),
          (data) => {
            setMember(data)
            if (data?.status === 'suspended') setStatus('suspended')
            else setStatus('ready')
          },
          (e) => setError(e.message),
        )
      } catch (e) {
        if (cancelled) return
        setError((e as Error).message)
        setStatus('not-member')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user, adapters, demoReady])

  const signOut = useCallback(async () => {
    await adapters.auth.signOut()
  }, [adapters])

  const resetDemo = useCallback(() => {
    if (!IS_DEMO) return
    ;(adapters.db as MemoryAdapter).reset()
    adapters.auth.signOut()
    window.location.reload()
  }, [adapters])

  const value: Session = useMemo(
    () => ({
      db: adapters.db,
      auth: adapters.auth,
      demo: IS_DEMO,
      user: user ?? null,
      member,
      memberId,
      isAdmin: !!member && member.role === 'owner' && member.status === 'active',
      status: user === undefined ? 'loading' : status,
      slug: EDICION_ACTUAL.slug,
      error,
      signOut,
      resetDemo,
    }),
    [adapters, user, member, memberId, status, error, signOut, resetDemo],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useSession(): Session {
  const s = useContext(Ctx)
  if (!s) throw new Error('useSession fuera de DataProvider')
  return s
}
