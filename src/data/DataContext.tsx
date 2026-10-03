// Sesión: adaptadores, usuario autenticado, miembro resuelto y permisos.
// Sin sesión se navega como visitante (sólo lectura). Los permisos de verdad los hacen cumplir las reglas de Firestore.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { EDICION_ACTUAL } from '../content/config'
import type { AuthAdapter, AuthUser, DataAdapter } from './adapter'
import { DemoAuthAdapter, FirebaseAuthAdapter, demoResetAccounts } from './auth'
import { seedDemo } from './demoSeed'
import { IS_DEMO, firebaseConfig } from './env'
import { FirestoreAdapter } from './firestoreAdapter'
import { MemoryAdapter } from './memoryAdapter'
import { P } from './paths'
import { OWNER_ID, ensureEdition } from './seed'
import type { Member, RolesConfig } from './types'

// visitor = sin sesión · no-access = entró pero su cuenta no está activa · ready = miembro activo
export type SessionStatus = 'loading' | 'visitor' | 'no-access' | 'suspended' | 'ready'

export interface Session {
  db: DataAdapter
  auth: AuthAdapter
  demo: boolean
  user: AuthUser | null
  member: Member | null
  memberId: string | null
  status: SessionStatus
  isMember: boolean // miembro activo con sesión: puede votar y editar lo propio
  isAdmin: boolean // gestiona cuentas, sorteo y configuración
  isAgus: boolean // único que ve resultados de premios
  isPresident: boolean
  canDecide: boolean // confirma fecha, lugar y comida (presidente o administrador)
  presidentId: string | null
  slug: string
  error: string | null
  signOut: () => Promise<void>
  resetDemo: () => void
}

const Ctx = createContext<Session | null>(null)

function buildAdapters(): { db: DataAdapter; auth: AuthAdapter } {
  if (IS_DEMO || !firebaseConfig) return { db: new MemoryAdapter(), auth: new DemoAuthAdapter() }
  return { db: new FirestoreAdapter(firebaseConfig), auth: new FirebaseAuthAdapter(firebaseConfig) }
}

export function DataProvider({ children }: { children: ReactNode }) {
  const adapters = useMemo(buildAdapters, [])
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined)
  const [member, setMember] = useState<Member | null>(null)
  const [memberId, setMemberId] = useState<string | null>(null)
  const [status, setStatus] = useState<SessionStatus>('loading')
  const [error, setError] = useState<string | null>(null)
  const [presidentId, setPresidentId] = useState<string | null>(null)
  const [demoReady, setDemoReady] = useState(!IS_DEMO)
  const unsubMember = useRef<(() => void) | null>(null)
  const seeded = useRef(false)

  useEffect(() => {
    if (!IS_DEMO) return
    seedDemo(adapters.db as MemoryAdapter).then(() => setDemoReady(true))
  }, [adapters])

  useEffect(() => adapters.auth.onChange((u) => setUser(u)), [adapters])

  // Rol de presidente (público).
  useEffect(() => {
    if (!demoReady) return
    return adapters.db.subscribeDoc<RolesConfig>(P.roles, (r) => setPresidentId(r?.presidentId ?? null), () => setPresidentId(null))
  }, [adapters, demoReady])

  // Resolver el miembro de la cuenta: uids/{uid} → memberId (lo escribe sólo el administrador).
  useEffect(() => {
    if (!demoReady || user === undefined) return
    unsubMember.current?.()
    unsubMember.current = null
    setMember(null)
    setMemberId(null)
    setError(null)
    if (!user) {
      setStatus('visitor')
      return
    }
    let cancelled = false
    setStatus('loading')
    ;(async () => {
      try {
        const link = await adapters.db.getDoc<{ memberId: string }>(P.uid(user.uid))
        if (cancelled) return
        if (!link?.memberId) {
          setStatus('no-access')
          return
        }
        const id = link.memberId
        setMemberId(id)
        unsubMember.current = adapters.db.subscribeDoc<Member>(
          P.member(id),
          (data) => {
            setMember(data)
            setStatus(!data ? 'no-access' : data.status === 'active' ? 'ready' : data.status === 'suspended' ? 'suspended' : 'no-access')
          },
          (e) => setError(e.message),
        )
      } catch (e) {
        if (cancelled) return
        setError((e as Error).message)
        setStatus('no-access')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user, adapters, demoReady])

  const isMember = status === 'ready' && !!member
  const isAdmin = isMember && member!.role === 'owner'
  const isAgus = isMember && memberId === OWNER_ID
  const isPresident = isMember && !!presidentId && presidentId === memberId

  // El administrador completa lo que falte de la edición (idempotente, no pisa nada).
  useEffect(() => {
    if (!isAdmin || seeded.current) return
    seeded.current = true
    ensureEdition(adapters.db).catch(() => undefined)
  }, [isAdmin, adapters])

  const signOut = useCallback(async () => {
    await adapters.auth.signOut()
  }, [adapters])

  const resetDemo = useCallback(() => {
    if (!IS_DEMO) return
    ;(adapters.db as MemoryAdapter).reset()
    demoResetAccounts()
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
      status: user === undefined || !demoReady ? 'loading' : status,
      isMember,
      isAdmin,
      isAgus,
      isPresident,
      canDecide: isAdmin || isPresident,
      presidentId,
      slug: EDICION_ACTUAL.slug,
      error,
      signOut,
      resetDemo,
    }),
    [adapters, user, member, memberId, status, demoReady, isMember, isAdmin, isAgus, isPresident, presidentId, error, signOut, resetDemo],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useSession(): Session {
  const s = useContext(Ctx)
  if (!s) throw new Error('useSession fuera de DataProvider')
  return s
}
