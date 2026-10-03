// Operaciones de cuentas: entrar con usuario, crear el acceso de un miembro, resetear o quitar su contraseña.
// Las contraseñas nunca se guardan: viven sólo en Firebase Auth. Un reseteo crea una cuenta nueva y
// desvincula la anterior, así el administrador no necesita (ni puede) ver la contraseña vigente.
import { authEmailFor, normalizeUsername, randomSuffix, validatePassword, validateUsername } from '../domain/accounts'
import { DataError, type AuthAdapter, type DataAdapter } from './adapter'
import { P } from './paths'
import type { LoginDoc, Member, MemberPrivate } from './types'

export async function loginWithUsername(db: DataAdapter, auth: AuthAdapter, usernameInput: string, password: string) {
  const username = normalizeUsername(usernameInput)
  if (!username || !password) throw new DataError('BAD_LOGIN', 'Completá usuario y contraseña.')
  let login: LoginDoc | null = null
  try {
    login = await db.getDoc<LoginDoc>(P.login(username))
  } catch {
    login = null
  }
  if (!login) throw new DataError('BAD_LOGIN', 'Usuario o contraseña incorrectos.')
  await auth.signIn(login.email, password)
}

export async function createMemberLogin(db: DataAdapter, auth: AuthAdapter, memberId: string, usernameInput: string, password: string): Promise<string> {
  const username = normalizeUsername(usernameInput)
  const uErr = validateUsername(username)
  if (uErr) throw new DataError('VALIDATION_ERROR', uErr)
  const pErr = validatePassword(password)
  if (pErr) throw new DataError('VALIDATION_ERROR', pErr)
  const existing = await db.getDoc<LoginDoc>(P.login(username))
  if (existing && existing.memberId !== memberId) throw new DataError('TAKEN', `El usuario "${username}" ya es de otro miembro.`)
  const priv = await db.getDoc<MemberPrivate>(P.memberPrivate(memberId))
  if (priv?.username && priv.username !== username) throw new DataError('TAKEN', `Este miembro ya tiene el usuario "${priv.username}". Reseteale la contraseña.`)
  const email = authEmailFor(username, randomSuffix())
  const uid = await auth.createLogin(email, password)
  const now = Date.now()
  await db.setDoc(P.uid(uid), { memberId })
  await db.setDoc<LoginDoc>(P.login(username), { memberId, email })
  if (priv?.uid && priv.uid !== uid) await db.deleteDoc(P.uid(priv.uid))
  await db.setDoc<MemberPrivate>(P.memberPrivate(memberId), { username, authEmail: email, uid, updatedAt: now }, { merge: true })
  const m = await db.getDoc<Member>(P.member(memberId))
  await db.updateDoc(P.member(memberId), { status: m?.status === 'suspended' ? 'suspended' : 'active', hasLogin: true, updatedAt: now })
  return username
}

/** Nueva contraseña para un miembro: cuenta nueva con el mismo usuario; la anterior deja de servir. */
export async function resetMemberPassword(db: DataAdapter, auth: AuthAdapter, memberId: string, password: string) {
  const pErr = validatePassword(password)
  if (pErr) throw new DataError('VALIDATION_ERROR', pErr)
  const priv = await db.getDoc<MemberPrivate>(P.memberPrivate(memberId))
  if (!priv?.username) throw new DataError('NOT_FOUND', 'Este miembro todavía no tiene usuario.')
  const email = authEmailFor(priv.username, randomSuffix())
  const uid = await auth.createLogin(email, password)
  await db.setDoc(P.uid(uid), { memberId })
  await db.setDoc<LoginDoc>(P.login(priv.username), { memberId, email })
  if (priv.uid && priv.uid !== uid) await db.deleteDoc(P.uid(priv.uid))
  await db.setDoc<MemberPrivate>(P.memberPrivate(memberId), { authEmail: email, uid, updatedAt: Date.now() }, { merge: true })
}

/** Quita el acceso (el miembro sigue en la banda, pero sin poder entrar). */
export async function removeMemberLogin(db: DataAdapter, memberId: string) {
  const priv = await db.getDoc<MemberPrivate>(P.memberPrivate(memberId))
  if (priv?.username) await db.deleteDoc(P.login(priv.username))
  if (priv?.uid) await db.deleteDoc(P.uid(priv.uid))
  await db.setDoc<MemberPrivate>(P.memberPrivate(memberId), { username: '', authEmail: '', uid: '', updatedAt: Date.now() }, { merge: true })
  await db.updateDoc(P.member(memberId), { status: 'draft', hasLogin: false, updatedAt: Date.now() })
}
