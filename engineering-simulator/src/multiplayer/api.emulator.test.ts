/**
 * End-to-end checks of the session flow and the security rules, against the local
 * Firebase emulators. Run with `npm run test:mp` (needs Java 21+ for the emulator).
 * Each "device" is its own Firebase app instance with its own signed-in user.
 */
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, GoogleAuthProvider, signInAnonymously, signInWithCredential } from 'firebase/auth'
import { collection, connectFirestoreEmulator, doc, getDoc, getDocs, getFirestore, setDoc, updateDoc } from 'firebase/firestore'
import { afterAll, describe, expect, test } from 'vitest'
import { createSession, joinSession, makeTeams, placeLateJoiners, postEvent, setChoices, setSessionState, writeShared } from './api'
import type { Group, Player } from './types'

const PROJECT = 'demo-besa'
const apps: FirebaseApp[] = []
let n = 0

async function device(kind: 'instructor' | 'student' | 'outsider-google') {
  const app = initializeApp({ projectId: PROJECT, apiKey: 'demo-key', authDomain: `${PROJECT}.firebaseapp.com` }, `dev${n++}`)
  apps.push(app)
  const auth = getAuth(app)
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  const db = getFirestore(app)
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
  if (kind === 'student') await signInAnonymously(auth)
  else {
    const email = kind === 'instructor' ? `teacher${n}@ucsc.edu` : `stranger${n}@gmail.com`
    await signInWithCredential(auth, GoogleAuthProvider.credential(JSON.stringify({ sub: `g${n}`, email, email_verified: true })))
  }
  return { db, uid: auth.currentUser!.uid, name: kind }
}

const denied = async (p: Promise<unknown>) => {
  await expect(p).rejects.toMatchObject({ code: 'permission-denied' })
}

afterAll(async () => {
  await Promise.all(apps.map((a) => deleteApp(a)))
})

describe('multiplayer sessions (emulator)', () => {
  test('full flow: host creates, students join with a code, groups, shared state, events', async () => {
    const host = await device('instructor')
    const session = await createSession(host.db, { uid: host.uid, name: 'Ms. Teacher' }, { gameIds: ['traffic', 'flood'], teamSize: 2 })
    expect(session.code).toMatch(/^\d{6}$/)

    // Five students join and rank their picks: three want traffic first, two want flood.
    const picks: Record<string, string[]> = { Ana: ['traffic', 'flood'], Ben: ['traffic'], Cy: ['flood', 'traffic'], Dee: ['traffic', 'flood'], Eli: ['flood'] }
    const students = await Promise.all(Object.keys(picks).map(async (name) => ({ ...(await device('student')), name })))
    for (const s of students) {
      expect(await joinSession(s.db, s.uid, session.code, s.name)).toBe(session.id)
      await setChoices(s.db, session.id, s.uid, picks[s.name])
    }

    const groups = await makeTeams(host.db, session.id)
    expect(groups.map((g) => g.station)).toEqual(groups.map((_, i) => i + 1))
    const players = (await getDocs(collection(host.db, 'sessions', session.id, 'players'))).docs.map((d) => ({ id: d.id, ...d.data() }) as Player)
    // Everyone got their 1st choice here (both challenges have enough interest).
    for (const p of players) expect(groups.find((g) => g.id === p.groupId)!.gameId).toBe(picks[p.name][0])

    // A late joiner lands on the smallest team of their top pick.
    const late = { ...(await device('student')), name: 'Fay' }
    await joinSession(late.db, late.uid, session.code, late.name)
    await setChoices(late.db, session.id, late.uid, ['flood'])
    const all = (await getDocs(collection(host.db, 'sessions', session.id, 'players'))).docs.map((d) => ({ id: d.id, ...d.data() }) as Player)
    await placeLateJoiners(host.db, session.id, all, groups as Group[])
    const fay = (await getDoc(doc(host.db, 'sessions', session.id, 'players', late.uid))).data() as Player
    expect(groups.find((g) => g.id === fay.groupId)!.gameId).toBe('flood')
    const after = (await getDocs(collection(host.db, 'sessions', session.id, 'players'))).docs.map((d) => d.data() as Player)

    await setSessionState(host.db, session.id, 'playing', { endsAt: Date.now() + 15 * 60_000 })

    // A group member writes the group's shared design; a teammate on another device reads it.
    const g0 = after.find((p) => p.name === 'Ana')!.groupId!
    const me = students.find((s) => after.find((p) => p.name === s.name)?.groupId === g0)!
    const mate = students.find((s) => s !== me && after.find((p) => p.name === s.name)?.groupId === g0)!
    const rev = await writeShared(me.db, session.id, g0, 'design', [{ id: 'd1', kind: 'drain', x: 3, y: 4 }], me.uid)
    expect(rev).toBe(1)
    const seen = await getDoc(doc(mate.db, 'sessions', session.id, 'groups', g0, 'shared', 'design'))
    expect(seen.data()?.data).toEqual([{ id: 'd1', kind: 'drain', x: 3, y: 4 }])
    expect(await writeShared(mate.db, session.id, g0, 'design', [], mate.uid)).toBe(2)

    await postEvent(me.db, session.id, g0, 'result', { pass: true }, { uid: me.uid, name: me.name })
    const events = await getDocs(collection(host.db, 'sessions', session.id, 'groups', g0, 'events'))
    expect(events.docs.map((d) => d.data().type)).toEqual(['result'])
  })

  test('rules: only instructors host; students cannot assign themselves or touch other groups', async () => {
    const host = await device('instructor')
    const session = await createSession(host.db, { uid: host.uid, name: 'Host' }, { gameIds: ['traffic', 'flood'], teamSize: 2 })
    const a = await device('student')
    const b = await device('student')
    const c0 = await device('student')
    const d0 = await device('student')
    for (const [s, n, pick] of [[a, 'A', 'traffic'], [b, 'B', 'flood'], [c0, 'C', 'traffic'], [d0, 'D', 'flood']] as const) {
      await joinSession(s.db, s.uid, session.code, n)
      await setChoices(s.db, session.id, s.uid, [pick])
    }
    // Picks must be at most two, and only challenges this session offers.
    await denied(setChoices(a.db, session.id, a.uid, ['quake']))
    await expect(setChoices(a.db, session.id, a.uid, ['traffic', 'flood', 'traffic'])).resolves.toBeUndefined() // API trims to 2
    await denied(updateDoc(doc(a.db, 'sessions', session.id, 'players', a.uid), { choices: ['traffic', 'flood', 'traffic'] }))
    await makeTeams(host.db, session.id)
    await setSessionState(host.db, session.id, 'playing')
    const aGroup = (await getDoc(doc(a.db, 'sessions', session.id, 'players', a.uid))).data()!.groupId as string
    const bGroup = (await getDoc(doc(b.db, 'sessions', session.id, 'players', b.uid))).data()!.groupId as string
    const other = bGroup

    // Students and non-UCSC Google accounts cannot create sessions.
    await denied(createSession(a.db, { uid: a.uid, name: 'A' }, { gameIds: ['flood'], teamSize: 3 }))
    const stranger = await device('outsider-google')
    await denied(createSession(stranger.db, { uid: stranger.uid, name: 'X' }, { gameIds: ['flood'], teamSize: 3 }))

    // A student cannot move themselves to another group, change the session, or edit another group.
    await denied(updateDoc(doc(a.db, 'sessions', session.id, 'players', a.uid), { groupId: other }))
    await denied(updateDoc(doc(a.db, 'sessions', session.id), { state: 'ended' }))
    await denied(writeShared(a.db, session.id, other, 'design', [], a.uid))
    await denied(postEvent(a.db, session.id, other, 'result', {}, { uid: a.uid, name: 'A' }))
    // ...or join under someone else's id, or with a blank/huge name.
    await denied(setDoc(doc(a.db, 'sessions', session.id, 'players', b.uid), { name: 'imposter', choices: [], groupId: null, joinedAt: 0, lastSeen: 0 }))
    await expect(joinSession(a.db, a.uid, session.code, '   ')).rejects.toThrow('name')

    // But they can edit their own group's design while playing...
    await writeShared(a.db, session.id, aGroup, 'design', [{ id: 'x' }], a.uid)
    // ...and not after the host ends the round.
    await setSessionState(host.db, session.id, 'ended')
    await denied(writeShared(a.db, session.id, aGroup, 'design', [], a.uid))
    // Ended games reject new players.
    const c = await device('student')
    await expect(joinSession(c.db, c.uid, session.code, 'C')).rejects.toThrow('ended')
  })

  test('wrong codes give a friendly error', async () => {
    const s = await device('student')
    await expect(joinSession(s.db, s.uid, '000000', 'Zed')).rejects.toThrow('not found')
  })
})
