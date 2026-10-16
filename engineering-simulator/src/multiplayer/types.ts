/** Live multiplayer data shapes (scenario-agnostic). See firebase/firestore.rules for who may write what. */

export type SessionState = 'lobby' | 'playing' | 'ended'

export interface Session {
  id: string
  code: string
  hostUid: string
  hostName: string
  /** Challenges offered in this session (scenario ids); students rank their favourites. */
  gameIds: string[]
  state: SessionState
  /** Target number of students per team. */
  teamSize: number
  /** Milliseconds since epoch when the round ends, or null for no timer. */
  endsAt: number | null
  /** Optional message the host broadcasts to every device. */
  announcement: string | null
  createdAt: number
}

export interface Player {
  id: string
  name: string
  /** Ranked challenge picks, best first (up to 2). */
  choices: string[]
  groupId: string | null
  joinedAt: number
  lastSeen: number
}

export interface Group {
  id: string
  name: string
  color: string
  order: number
  /** The challenge this team plays. */
  gameId: string
  /** Where the team meets in the room (tables labelled 1, 2, 3…). */
  station: number
}

/** A live shared document for one group (e.g. the group's design). `rev` increases on every write. */
export interface SharedDoc<T = unknown> {
  data: T
  rev: number
  updatedBy: string
  updatedAt: number
}

export interface GroupEvent<P = unknown> {
  id: string
  type: string
  by: string
  byName: string
  at: number
  payload: P
}
