import { useAwaitingInputSessionIdSet, useUnreadCompletedSessions } from '@/shared/context/SessionProtectionContext';
import { getSessionStatus } from '@/modules/sidebar/utils/sessionStatus';
import type { SessionStatus } from '@/modules/sidebar/utils/sessionStatus';

type SessionStatusSets = {
  awaitingInputSessionIds: ReadonlySet<string>;
  unreadCompletedSessionIds: ReadonlySet<string>;
};

/** The id sets getSessionStatus reads, for a list that resolves many rows in one render. */
export function useSessionStatusSets(): SessionStatusSets {
  const awaitingInputSessionIds = useAwaitingInputSessionIdSet();
  const { unreadCompletedSessionIds } = useUnreadCompletedSessions();
  return { awaitingInputSessionIds, unreadCompletedSessionIds };
}

/** Hook form of getSessionStatus for a component that renders one row. */
export function useSessionStatus(
  sessionId: string,
  isSelected: boolean,
  isProcessing: boolean,
  hasBackgroundWork = false,
): SessionStatus {
  const { awaitingInputSessionIds, unreadCompletedSessionIds } = useSessionStatusSets();
  return getSessionStatus(
    sessionId,
    isSelected,
    isProcessing,
    awaitingInputSessionIds,
    unreadCompletedSessionIds,
    hasBackgroundWork,
  );
}
