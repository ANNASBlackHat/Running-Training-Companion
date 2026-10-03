import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Session } from '@/domain/types';

/**
 * Session store: past sessions, newest first.
 *
 * Tech Spec section 8: "sessions: array of Session objects. Track points are
 * stored at 1 per second at most. A session is saved automatically when the
 * runner reaches `finished` or the user stops."
 *
 * Section 3: a session keeps a `workoutSnapshot` so later edits to a workout
 * do not change history.
 */

interface SessionState {
  sessions: Session[];
  /** Record a finished session, replacing any earlier run of the same id. */
  saveSession: (session: Session) => void;
  getSession: (id: string) => Session | undefined;
  deleteSession: (id: string) => void;
  clearAll: () => void;
}

const byNewestFirst = (a: Session, b: Session): number => b.startedAt - a.startedAt;

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      sessions: [],

      saveSession: (session) =>
        set((state) => {
          const existing = state.sessions.some((s) => s.id === session.id);
          const sessions = existing
            ? state.sessions.map((s) => (s.id === session.id ? session : s))
            : [session, ...state.sessions];
          return { sessions: sessions.sort(byNewestFirst) };
        }),

      getSession: (id) => get().sessions.find((s) => s.id === id),

      deleteSession: (id) =>
        set((state) => ({ sessions: state.sessions.filter((s) => s.id !== id) })),

      clearAll: () => set({ sessions: [] }),
    }),
    {
      name: 'sessions',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

/** All sessions for one workout, newest first (US-18 groundwork). */
export function sessionsForWorkout(sessions: Session[], workoutId: string): Session[] {
  return sessions.filter((s) => s.workoutId === workoutId).sort(byNewestFirst);
}