import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';

import {
  useSessionProtection,
} from '@/shared/hooks/useSessionProtection';
import type { BackgroundTaskSummary, GetSessionActivity, IsSessionProcessing, MarkSessionBackground, MarkSessionIdle, MarkSessionProcessing, SessionActivity, SessionActivityMap, SyncProcessingSessions } from '@/shared/types';
import { api } from '@/shared/api';

type RunningSessionApiItem = {
  sessionId?: unknown;
  startedAt?: unknown;
  statusText?: unknown;
  canInterrupt?: unknown;
  background?: unknown;
  tasks?: unknown;
  awaitingInput?: unknown;
};

type UnreadCompletedSessions = {
  unreadCompletedSessionIds: ReadonlySet<string>;
  markSessionRead: (sessionId?: string | null) => void;
};

const UNREAD_COMPLETED_STORAGE_KEY = 'unreadCompletedSessionIds';

const readPersistedUnreadIds = (): Set<string> => {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(UNREAD_COMPLETED_STORAGE_KEY) ?? '[]');
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
};

type RunningSessionsApiPayload = {
  data?: {
    sessions?: RunningSessionApiItem[];
  };
};

type SessionProtectionActions = {
  markSessionProcessing: MarkSessionProcessing;
  markSessionIdle: MarkSessionIdle;
  markSessionBackground: MarkSessionBackground;
  syncProcessingSessions: SyncProcessingSessions;
  isSessionProcessing: IsSessionProcessing;
  getSessionActivity: GetSessionActivity;
};

const SessionProtectionStateContext = createContext<SessionActivityMap | null>(null);
const SessionProtectionActionsContext = createContext<SessionProtectionActions | null>(null);
const BusySessionIdsContext = createContext<ReadonlySet<string> | null>(null);
const BackgroundSessionIdsContext = createContext<ReadonlySet<string> | null>(null);
const AwaitingInputSessionIdsContext = createContext<ReadonlySet<string> | null>(null);
const UnreadCompletedSessionsContext = createContext<UnreadCompletedSessions | null>(null);

/**
 * The set of session ids whose activity passes `include`, with a stable
 * identity while membership is unchanged.
 *
 * Every provider `status` frame rewrites an entry's `statusText`, which
 * allocates a new activity map several times a second during a run. Consumers
 * that only need membership — the sidebar renders a dot per row and a running
 * count — would re-render on all of it.
 */
function useSessionIdSet(
  processingSessions: SessionActivityMap,
  include: (activity: SessionActivity) => boolean,
): ReadonlySet<string> {
  // Deriving the set from a membership key, rather than from the map, keeps its
  // identity stable across the `statusText` rewrites without reading a ref
  // during render. Session ids never contain a NUL, so it is a safe separator.
  const membershipKey = [...processingSessions]
    .filter(([, activity]) => include(activity))
    .map(([sessionId]) => sessionId)
    .sort()
    .join('\u0000');

  return useMemo(
    () => new Set(membershipKey ? membershipKey.split('\u0000') : []),
    [membershipKey],
  );
}

const isAnyActivity = () => true;
const isBackgroundOnly = (activity: SessionActivity) => Boolean(activity.background);

const parseStartedAt = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

/** The poll's task list, kept only when every entry has the shape the indicator reads. */
const parseBackgroundTasks = (value: unknown): BackgroundTaskSummary[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const tasks: BackgroundTaskSummary[] = [];
  for (const item of value) {
    const task = item as Partial<Record<keyof BackgroundTaskSummary, unknown>> | null;
    if (
      !task
      || typeof task.taskId !== 'string'
      || typeof task.toolUseId !== 'string'
      || typeof task.taskType !== 'string'
      || typeof task.description !== 'string'
      || typeof task.startedAt !== 'number'
    ) {
      // One entry the server wrote in a shape this client does not read
      // should not hide the rest of the session's work.
      continue;
    }
    tasks.push({
      taskId: task.taskId,
      toolUseId: task.toolUseId,
      taskType: task.taskType,
      description: task.description,
      ...(typeof task.workflowName === 'string' ? { workflowName: task.workflowName } : {}),
      startedAt: task.startedAt,
      ...(task.nested === true ? { nested: true } : {}),
    });
  }
  return tasks;
};

/** Mounted by the project-workspace route; tracks which sessions are busy — producing a response or running background tasks — so chat, sidebar and project-workspace agree on session activity. */
export function SessionProtectionProvider({ children }: { children: ReactNode }) {
  const {
    processingSessions,
    markSessionProcessing,
    markSessionIdle,
    markSessionBackground,
    syncProcessingSessions,
    isSessionProcessing,
    getSessionActivity,
  } = useSessionProtection();
  // Kept as a membership key so the set keeps its identity between polls.
  const [awaitingInputKey, setAwaitingInputKey] = useState('');

  const refreshRunningSessions = useCallback(async () => {
    try {
      const response = await api.runningSessions();
      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as RunningSessionsApiPayload;
      const sessions = Array.isArray(payload.data?.sessions) ? payload.data.sessions : [];

      setAwaitingInputKey(
        sessions
          .filter((session) => session.awaitingInput === true && typeof session.sessionId === 'string')
          .map((session) => session.sessionId as string)
          .sort()
          .join('\u0000'),
      );

      syncProcessingSessions(
        sessions
          .map((session) => {
            if (typeof session.sessionId !== 'string' || !session.sessionId) {
              return null;
            }

            return {
              sessionId: session.sessionId,
              startedAt: parseStartedAt(session.startedAt),
              statusText: typeof session.statusText === 'string' ? session.statusText : undefined,
              canInterrupt: typeof session.canInterrupt === 'boolean' ? session.canInterrupt : undefined,
              background: session.background === true,
              tasks: parseBackgroundTasks(session.tasks),
            };
          })
          .filter((session): session is NonNullable<typeof session> => Boolean(session)),
      );
    } catch (error) {
      console.error('[SessionProtection] Failed to sync running sessions:', error);
    }
  }, [syncProcessingSessions]);

  useEffect(() => {
    void refreshRunningSessions();
  }, [refreshRunningSessions]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void refreshRunningSessions();
    }, 5000);

    return () => window.clearInterval(interval);
  }, [refreshRunningSessions]);

  const actions = useMemo<SessionProtectionActions>(
    () => ({
      markSessionProcessing,
      markSessionIdle,
      markSessionBackground,
      syncProcessingSessions,
      isSessionProcessing,
      getSessionActivity,
    }),
    [
      getSessionActivity,
      isSessionProcessing,
      markSessionBackground,
      markSessionIdle,
      markSessionProcessing,
      syncProcessingSessions,
    ],
  );

  const busySessionIds = useSessionIdSet(processingSessions, isAnyActivity);
  const backgroundSessionIds = useSessionIdSet(processingSessions, isBackgroundOnly);
  const awaitingInputSessionIds = useMemo<ReadonlySet<string>>(
    () => new Set(awaitingInputKey ? awaitingInputKey.split('\u0000') : []),
    [awaitingInputKey],
  );

  // A session that drops out of the busy set has finished its run. It stays
  // unread until opened; the project workspace clears the one being viewed.
  const [unreadCompletedSessionIds, setUnreadCompletedSessionIds] = useState<Set<string>>(readPersistedUnreadIds);
  const previousBusySessionIdsRef = useRef<ReadonlySet<string>>(busySessionIds);
  useEffect(() => {
    const finishedSessionIds = [...previousBusySessionIdsRef.current].filter((id) => !busySessionIds.has(id));
    previousBusySessionIdsRef.current = busySessionIds;
    if (finishedSessionIds.length === 0) {
      return;
    }
    setUnreadCompletedSessionIds((previous) => {
      const next = new Set(previous);
      finishedSessionIds.forEach((id) => next.add(id));
      return next;
    });
  }, [busySessionIds]);

  useEffect(() => {
    try {
      localStorage.setItem(UNREAD_COMPLETED_STORAGE_KEY, JSON.stringify([...unreadCompletedSessionIds]));
    } catch {
      // Storage can be unavailable (private mode); the state still works in memory.
    }
  }, [unreadCompletedSessionIds]);

  const markSessionRead = useCallback((sessionId?: string | null) => {
    if (!sessionId) {
      return;
    }
    setUnreadCompletedSessionIds((previous) => {
      if (!previous.has(sessionId)) {
        return previous;
      }
      const next = new Set(previous);
      next.delete(sessionId);
      return next;
    });
  }, []);

  const unreadCompletedSessions = useMemo<UnreadCompletedSessions>(
    () => ({ unreadCompletedSessionIds, markSessionRead }),
    [markSessionRead, unreadCompletedSessionIds],
  );

  return (
    <SessionProtectionActionsContext.Provider value={actions}>
      <BusySessionIdsContext.Provider value={busySessionIds}>
        <BackgroundSessionIdsContext.Provider value={backgroundSessionIds}>
          <AwaitingInputSessionIdsContext.Provider value={awaitingInputSessionIds}>
            <UnreadCompletedSessionsContext.Provider value={unreadCompletedSessions}>
              <SessionProtectionStateContext.Provider value={processingSessions}>
                {children}
              </SessionProtectionStateContext.Provider>
            </UnreadCompletedSessionsContext.Provider>
          </AwaitingInputSessionIdsContext.Provider>
        </BackgroundSessionIdsContext.Provider>
      </BusySessionIdsContext.Provider>
    </SessionProtectionActionsContext.Provider>
  );
}

/**
 * Membership-only view of the busy sessions, background work included. Prefer
 * this over useProcessingSessions wherever the activity details are not
 * rendered.
 */
export function useBusySessionIdSet(): ReadonlySet<string> {
  const busySessionIds = useContext(BusySessionIdsContext);
  if (!busySessionIds) {
    throw new Error('useBusySessionIdSet must be used within SessionProtectionProvider');
  }
  return busySessionIds;
}

/**
 * The busy sessions that are only running background tasks — no response in
 * flight. A subset of useBusySessionIdSet, with the same stable identity, for
 * the sidebar to draw those rows differently.
 */
export function useBackgroundSessionIdSet(): ReadonlySet<string> {
  const backgroundSessionIds = useContext(BackgroundSessionIdsContext);
  if (!backgroundSessionIds) {
    throw new Error('useBackgroundSessionIdSet must be used within SessionProtectionProvider');
  }
  return backgroundSessionIds;
}

/** Sessions whose run is blocked on a tool approval or question from the user. */
export function useAwaitingInputSessionIdSet(): ReadonlySet<string> {
  const awaitingInputSessionIds = useContext(AwaitingInputSessionIdsContext);
  if (!awaitingInputSessionIds) {
    throw new Error('useAwaitingInputSessionIdSet must be used within SessionProtectionProvider');
  }
  return awaitingInputSessionIds;
}

/** Sessions whose run finished since they were last opened, plus the action that marks one read. */
export function useUnreadCompletedSessions(): UnreadCompletedSessions {
  const unreadCompletedSessions = useContext(UnreadCompletedSessionsContext);
  if (!unreadCompletedSessions) {
    throw new Error('useUnreadCompletedSessions must be used within SessionProtectionProvider');
  }
  return unreadCompletedSessions;
}

export function useProcessingSessions(): SessionActivityMap {
  const processingSessions = useContext(SessionProtectionStateContext);
  if (!processingSessions) {
    throw new Error('useProcessingSessions must be used within SessionProtectionProvider');
  }
  return processingSessions;
}

export function useSessionProtectionActions(): SessionProtectionActions {
  const actions = useContext(SessionProtectionActionsContext);
  if (!actions) {
    throw new Error('useSessionProtectionActions must be used within SessionProtectionProvider');
  }
  return actions;
}
