import { onAuthStateChanged, type User } from 'firebase/auth'
import { collection, doc, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { eventsCol, sharedRef } from './api'
import { auth, db } from './firebase'
import type { Group, GroupEvent, Player, Session, SharedDoc } from './types'

/** Live realtime subscriptions. Every hook re-renders when the data changes on any device. */

export function useAuthUser() {
  const [user, setUser] = useState<User | null | undefined>(auth.currentUser ?? undefined)
  useEffect(() => onAuthStateChanged(auth, setUser), [])
  return user // undefined while loading
}

/** undefined while loading, null if the game doesn't exist (e.g. deleted). */
export function useSession(sid: string | null) {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  useEffect(() => {
    if (!sid) return
    return onSnapshot(doc(db, 'sessions', sid), (s) => setSession(s.exists() ? ({ id: s.id, ...s.data() } as Session) : null))
  }, [sid])
  return sid ? session : null
}

export function usePlayers(sid: string | null) {
  const [players, setPlayers] = useState<Player[]>([])
  useEffect(() => {
    if (!sid) return
    return onSnapshot(query(collection(db, 'sessions', sid, 'players'), orderBy('joinedAt')), (s) =>
      setPlayers(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Player)),
    )
  }, [sid])
  return sid ? players : []
}

export function useGroups(sid: string | null) {
  const [groups, setGroups] = useState<Group[]>([])
  useEffect(() => {
    if (!sid) return
    return onSnapshot(query(collection(db, 'sessions', sid, 'groups'), orderBy('order')), (s) =>
      setGroups(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Group)),
    )
  }, [sid])
  return sid ? groups : []
}

export function useShared<T>(sid: string | null, gid: string | null, docId: string) {
  const [shared, setShared] = useState<SharedDoc<T> | null>(null)
  useEffect(() => {
    if (!sid || !gid) return
    return onSnapshot(sharedRef(db, sid, gid, docId), (s) => setShared(s.exists() ? (s.data() as SharedDoc<T>) : null))
  }, [sid, gid, docId])
  return sid && gid ? shared : null
}

/** Group events newer than `since` (ms), oldest first. */
export function useEvents<P = unknown>(sid: string | null, gid: string | null, since: number, max = 50) {
  const [events, setEvents] = useState<GroupEvent<P>[]>([])
  useEffect(() => {
    if (!sid || !gid) return
    const q = query(eventsCol(db, sid, gid), where('at', '>=', since), orderBy('at', 'desc'), limit(max))
    return onSnapshot(q, (s) => setEvents(s.docs.map((d) => ({ id: d.id, ...d.data() }) as GroupEvent<P>).reverse()))
  }, [sid, gid, since, max])
  return sid && gid ? events : []
}

/** A clock that ticks once a second (for countdowns). */
export function useNow(every = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), every)
    return () => clearInterval(t)
  }, [every])
  return now
}

/** A player counts as online if their device checked in recently. */
export const isOnline = (lastSeen: number, now: number) => now - lastSeen < 75_000
