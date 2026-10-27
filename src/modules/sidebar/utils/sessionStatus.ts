export type SessionStatus = 'awaiting-input' | 'working' | 'background' | 'unread-completed' | null;

/**
 * The status a sidebar row flags for its session, most urgent first: waiting
 * on the user, then a response in flight, then work the session left running
 * in the background, then a finished run not yet opened.
 * The viewed session is never flagged as unread.
 */
export function getSessionStatus(
  sessionId: string,
  isSelected: boolean,
  isProcessing: boolean,
  awaitingInputSessionIds: ReadonlySet<string>,
  unreadCompletedSessionIds: ReadonlySet<string>,
  hasBackgroundWork = false,
): SessionStatus {
  if (awaitingInputSessionIds.has(sessionId)) {
    return 'awaiting-input';
  }
  if (isProcessing) {
    return 'working';
  }
  if (hasBackgroundWork) {
    return 'background';
  }
  if (!isSelected && unreadCompletedSessionIds.has(sessionId)) {
    return 'unread-completed';
  }
  return null;
}
