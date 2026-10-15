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
import { placeLate, planTeams } from './teams'
import type { Group, Player, Session, SessionState, SharedDoc } from './types'

export const GROUP_NAMES = ['Redwood', 'Oak', 'Cedar', 'Pine', 'Maple', 'Willow', 'Aspen', 'Birch', 'Cypress', 'Juniper', 'Sequoia', 'Laurel']
export const GROUP_COLORS = ['#2c5b3c', '#b8461b', '#5d7ea6', '#d9a52b', '#7c5cbf', '#2b8a8a', '#c4568d', '#74a85f', '#8e5a3c', '#3d4a43', '#d0702a', '#4a6fa5']
export const MAX_GROUPS = GROUP_NAMES.length * 3
export const MIN_TEAM_SIZE = 2
export const MAX_TEAM_SIZE = 8

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
  opts: { gameIds: string[]; teamSize: number },
): Promise<Session> {
  if (!opts.gameIds.length) throw new Error('Pick at least one challenge.')
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
        gameIds: opts.gameIds,
        state: 'lobby',
        teamSize: Math.max(MIN_TEAM_SIZE, Math.min(MAX_TEAM_SIZE, opts.teamSize)),
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
  else await setDoc(me, { name: clean, choices: [], groupId: null, joinedAt: Date.now(), lastSeen: Date.now() })
  return sid
}

/** Student: save ranked challenge picks (best first, up to 2). */
export async function setChoices(db: Firestore, sid: string, uid: string, choices: string[]) {
  await updateDoc(doc(db, 'sessions', sid, 'players', uid), { choices: choices.slice(0, 2), lastSeen: Date.now() })
}

export async function touchPresence(db: Firestore, sid: string, uid: string) {
  await updateDoc(doc(db, 'sessions', sid, 'players', uid), { lastSeen: Date.now() })
}

/** Team display name for the i-th team in a session (unique even beyond the name list). */
export const teamName = (i: number) => `Team ${GROUP_NAMES[i % GROUP_NAMES.length]}${i >= GROUP_NAMES.length ? ` ${Math.floor(i / GROUP_NAMES.length) + 1}` : ''}`

/** Host: build teams from everyone's ranked picks (see teams.ts), replacing any previous teams. */
export async function makeTeams(db: Firestore, sid: string): Promise<Group[]> {
  const [sessionSnap, players, oldGroups] = await Promise.all([getDoc(sessionRef(db, sid)), getDocs(playersCol(db, sid)), getDocs(groupsCol(db, sid))])
  const session = sessionSnap.data() as Omit<Session, 'id'>
  const plan = planTeams(
    players.docs.map((d) => ({ id: d.id, choices: (d.data().choices as string[]) ?? [] })),
    session.gameIds,
    session.teamSize,
  )
  const batch = writeBatch(db)
  oldGroups.forEach((g) => batch.delete(g.ref))
  const groups: Group[] = plan.map((t, i) => ({
    id: `g${i}`,
    name: teamName(i),
    color: GROUP_COLORS[i % GROUP_COLORS.length],
    order: i,
    gameId: t.gameId,
    station: t.station,
  }))
  groups.forEach((g, i) => {
    const { id, ...data } = g
    batch.set(doc(groupsCol(db, sid), id), data)
    for (const pid of plan[i].members) batch.update(doc(playersCol(db, sid), pid), { groupId: id })
  })
  await batch.commit()
  return groups
}

/** Host: put students who joined after teams were made onto the smallest team of their top pick. */
export async function placeLateJoiners(db: Firestore, sid: string, players: Player[], groups: Group[]) {
  const waiting = players.filter((p) => !p.groupId)
  if (!waiting.length || !groups.length) return
  const sizes = new Map(groups.map((g) => [g.id, players.filter((p) => p.groupId === g.id).length]))
  const batch = writeBatch(db)
  for (const p of waiting) {
    const gid = placeLate(p.choices ?? [], groups.map((g) => ({ id: g.id, gameId: g.gameId, size: sizes.get(g.id)! })))
    if (!gid) continue
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

export async function updateSession(db: Firestore, sid: string, patch: Partial<Pick<Session, 'endsAt' | 'announcement' | 'teamSize' | 'gameIds'>>) {
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
