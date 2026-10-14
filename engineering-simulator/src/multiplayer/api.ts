/**
 * Session operations. Every function takes the Firestore instance so tests can drive
 * several simulated devices (each with its own signed-in app) against the emulator.
 */
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  setDoc,
  updateDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore'
import type { Group, Player, Session, SessionState, SharedDoc } from './types'

export const GROUP_NAMES = ['Redwood', 'Oak', 'Cedar', 'Pine', 'Maple', 'Willow', 'Aspen', 'Birch', 'Cypress', 'Juniper', 'Sequoia', 'Laurel']
export const GROUP_COLORS = ['#2c5b3c', '#b8461b', '#5d7ea6', '#d9a52b', '#7c5cbf', '#2b8a8a', '#c4568d', '#74a85f', '#8e5a3c', '#3d4a43', '#d0702a', '#4a6fa5']
export const MAX_GROUPS = GROUP_NAMES.length

const sessionRef = (db: Firestore, sid: string) => doc(db, 'sessions', sid)
const playersCol = (db: Firestore, sid: string) => collection(db, 'sessions', sid, 'players')
const groupsCol = (db: Firestore, sid: string) => collection(db, 'sessions', sid, 'groups')
export const sharedRef = (db: Firestore, sid: string, gid: string, docId: string) => doc(db, 'sessions', sid, 'groups', gid, 'shared', docId)
export const eventsCol = (db: Firestore, sid: string, gid: string) => collection(db, 'sessions', sid, 'groups', gid, 'events')

const randomCode = () => String(100000 + Math.floor(Math.random() * 900000))

/** Instructor: create a session with a unique 6-digit join code. */
export async function createSession(
  db: Firestore,
  host: { uid: string; name: string },
  opts: { gameId: string; groupCount: number },
): Promise<Session> {
  const sid = doc(collection(db, 'sessions')).id
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = randomCode()
    const created = await runTransaction(db, async (tx) => {
      const codeRef = doc(db, 'codes', code)
      if ((await tx.get(codeRef)).exists()) return null
      const session: Omit<Session, 'id'> = {
        code,
        hostUid: host.uid,
        hostName: host.name,
        gameId: opts.gameId,
        state: 'lobby',
        groupCount: Math.max(1, Math.min(MAX_GROUPS, opts.groupCount)),
        endsAt: null,
        announcement: null,
        createdAt: Date.now(),
      }
      tx.set(codeRef, { sessionId: sid, hostUid: host.uid, createdAt: Date.now() })
      tx.set(sessionRef(db, sid), session)
      return { id: sid, ...session }
    })
    if (created) return created
  }
  throw new Error('Could not find a free join code. Please try again.')
}

export class JoinError extends Error {}

/** Student: look up a code and join (or rejoin) with a display name. */
export async function joinSession(db: Firestore, uid: string, code: string, name: string): Promise<string> {
  const clean = name.trim().slice(0, 24)
  if (!clean) throw new JoinError('Please type your name.')
  const codeSnap = await getDoc(doc(db, 'codes', code.trim()))
  if (!codeSnap.exists()) throw new JoinError('That game code was not found. Check the number on the screen.')
  const sid = codeSnap.data().sessionId as string
  const session = await getDoc(sessionRef(db, sid))
  if (!session.exists() || session.data().state === 'ended') throw new JoinError('That game has already ended.')
  const me = doc(db, 'sessions', sid, 'players', uid)
  const existing = await getDoc(me)
  if (existing.exists()) await updateDoc(me, { name: clean, lastSeen: Date.now() })
  else await setDoc(me, { name: clean, groupId: null, joinedAt: Date.now(), lastSeen: Date.now() })
  return sid
}

export async function touchPresence(db: Firestore, sid: string, uid: string) {
  await updateDoc(doc(db, 'sessions', sid, 'players', uid), { lastSeen: Date.now() })
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Host: (re)create the groups and spread all current players across them evenly at random. */
export async function assignGroups(db: Firestore, sid: string, groupCount: number): Promise<Group[]> {
  const n = Math.max(1, Math.min(MAX_GROUPS, groupCount))
  const [players, oldGroups] = await Promise.all([getDocs(playersCol(db, sid)), getDocs(groupsCol(db, sid))])
  const batch = writeBatch(db)
  oldGroups.forEach((g) => {
    if (Number(g.id.slice(1)) >= n) batch.delete(g.ref)
  })
  const groups: Group[] = Array.from({ length: n }, (_, i) => ({ id: `g${i}`, name: `Team ${GROUP_NAMES[i]}`, color: GROUP_COLORS[i], order: i }))
  for (const g of groups) batch.set(doc(groupsCol(db, sid), g.id), { name: g.name, color: g.color, order: g.order })
  shuffle(players.docs).forEach((p, i) => batch.update(p.ref, { groupId: groups[i % n].id }))
  batch.update(sessionRef(db, sid), { groupCount: n })
  await batch.commit()
  return groups
}

/** Host: put players who joined after groups were made into the smallest groups. */
export async function placeLateJoiners(db: Firestore, sid: string, players: Player[], groups: Group[]) {
  const waiting = players.filter((p) => !p.groupId)
  if (!waiting.length || !groups.length) return
  const sizes = new Map(groups.map((g) => [g.id, players.filter((p) => p.groupId === g.id).length]))
  const batch = writeBatch(db)
  for (const p of waiting) {
    const [gid] = [...sizes.entries()].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))[0]
    sizes.set(gid, sizes.get(gid)! + 1)
    batch.update(doc(playersCol(db, sid), p.id), { groupId: gid })
  }
  await batch.commit()
}

export async function movePlayer(db: Firestore, sid: string, playerId: string, groupId: string | null) {
  await updateDoc(doc(playersCol(db, sid), playerId), { groupId })
}

export async function removePlayer(db: Firestore, sid: string, playerId: string) {
  await deleteDoc(doc(playersCol(db, sid), playerId))
}

export async function setSessionState(db: Firestore, sid: string, state: SessionState, extra: Partial<Pick<Session, 'endsAt' | 'announcement'>> = {}) {
  await updateDoc(sessionRef(db, sid), { state, ...extra })
}

export async function updateSession(db: Firestore, sid: string, patch: Partial<Pick<Session, 'endsAt' | 'announcement' | 'groupCount' | 'gameId'>>) {
  await updateDoc(sessionRef(db, sid), patch)
}

/** Write a group's shared document; `rev` increments so every device can tell new state apart. */
export async function writeShared<T>(db: Firestore, sid: string, gid: string, docId: string, data: T, uid: string): Promise<number> {
  const ref = sharedRef(db, sid, gid, docId)
  return runTransaction(db, async (tx) => {
    const cur = await tx.get(ref)
    const rev = (cur.exists() ? ((cur.data() as SharedDoc).rev ?? 0) : 0) + 1
    tx.set(ref, { data, rev, updatedBy: uid, updatedAt: Date.now() })
    return rev
  })
}

export async function postEvent<P>(db: Firestore, sid: string, gid: string, type: string, payload: P, by: { uid: string; name: string }) {
  await addDoc(eventsCol(db, sid, gid), { type, by: by.uid, byName: by.name, at: Date.now(), payload })
}
