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

export const GROUP_NAMES = ['Redwood', 'Oak', 'Cedar', 'Pine', 'Maple', 'Willow', 'Aspen', 'Birch', 'Cypress', 'Juniper', 'Spruce', 'Laurel']
export const GROUP_COLORS = ['#2c5b3c', '#b8461b', '#5d7ea6', '#d9a52b', '#7c5cbf', '#2b8a8a', '#c4568d', '#74a85f', '#8e5a3c', '#3d4a43', '#d0702a', '#4a6fa5']
export const MAX_GROUPS = GROUP_NAMES.length * 3
/** The host's team size is a target (see teams.ts): teams have that many, or one more for an odd one out. */
export const MIN_TEAM_SIZE = 1
export const MAX_TEAM_SIZE = 6
/** Pairs: two jobs each in the four-job challenges. */
export const DEFAULT_TEAM_SIZE = 2

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

/**
 * Host: place students who joined after teams were made (see placeLate). A team takes at most one
 * more than the session's team size; if every fitting team is full, a new team (and station) starts.
 * Deterministic for the same players and groups, so a repeat run writes the same thing.
 */
export async function placeLateJoiners(db: Firestore, sid: string, players: Player[], groups: Group[], teamSize: number, gameIds: string[]) {
  const waiting = players.filter((p) => !p.groupId)
  if (!waiting.length || !groups.length) return
  const teams = groups.map((g) => ({ id: g.id, gameId: g.gameId, size: players.filter((p) => p.groupId === g.id).length }))
  let order = Math.max(...groups.map((g) => g.order)) + 1
  let station = Math.max(...groups.map((g) => g.station)) + 1
  const batch = writeBatch(db)
  for (const p of waiting) {
    const spot = placeLate(p.choices ?? [], teams, teamSize, gameIds)
    if (!spot) continue
    let gid: string
    if ('groupId' in spot) gid = spot.groupId
    else {
      const g: Omit<Group, 'id'> = { name: teamName(order), color: GROUP_COLORS[order % GROUP_COLORS.length], order, gameId: spot.newTeam, station: station++ }
      gid = `g${order++}`
      batch.set(doc(groupsCol(db, sid), gid), g)
      teams.push({ id: gid, gameId: spot.newTeam, size: 0 })
    }
    teams.find((t) => t.id === gid)!.size++
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

interface TimestampedItem {
  id: string
  updatedAt?: number
}

function isTimestampedArray(v: unknown): v is TimestampedItem[] {
  return (
    Array.isArray(v) &&
    v.length > 0 &&
    v.every((x) => typeof x === 'object' && x !== null && 'id' in x && typeof (x as TimestampedItem).updatedAt === 'number')
  )
}

/** Write a group's shared document; `rev` increments so every device can tell new state apart. */
export async function writeShared<T>(db: Firestore, sid: string, gid: string, docId: string, data: T, uid: string): Promise<number> {
  const ref = sharedRef(db, sid, gid, docId)
  return runTransaction(db, async (tx) => {
    const cur = await tx.get(ref)
    const prevDoc = cur.exists() ? (cur.data() as SharedDoc) : null
    const rev = (prevDoc?.rev ?? 0) + 1
    let merged: unknown = data
    if (prevDoc && isTimestampedArray(prevDoc.data) && isTimestampedArray(data)) {
      const byId = new Map<string, TimestampedItem>()
      for (const item of prevDoc.data) byId.set(item.id, item)
      for (const item of data) {
        const existing = byId.get(item.id)
        if (!existing || (item.updatedAt ?? 0) >= (existing.updatedAt ?? 0)) {
          byId.set(item.id, item)
        }
      }
      merged = [...byId.values()]
    }
    tx.set(ref, { data: merged, rev, updatedBy: uid, updatedAt: Date.now() })
    return rev
  })
}

export async function postEvent<P>(db: Firestore, sid: string, gid: string, type: string, payload: P, by: { uid: string; name: string }) {
  await addDoc(eventsCol(db, sid, gid), { type, by: by.uid, byName: by.name, at: Date.now(), payload })
}
