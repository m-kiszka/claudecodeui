import type { RecentConversationListItem } from '@/shared/types';

/** How far back the Recent tab looks. */
export const RECENT_WINDOW_MS = 2 * 24 * 60 * 60 * 1000;

const lastActivityTime = (conversation: RecentConversationListItem): number =>
  conversation.lastActivity ? Date.parse(conversation.lastActivity) : Number.NaN;

/** True while the oldest loaded conversation is still inside the window, so the next page may hold more. */
export function reachesIntoRecentWindow(conversations: RecentConversationListItem[], now: number): boolean {
  const oldest = conversations[conversations.length - 1];
  return Boolean(oldest) && lastActivityTime(oldest) >= now - RECENT_WINDOW_MS;
}

/** The loaded conversations active within the window, narrowed by the search box on title or project. */
export function filterRecentWindow(
  conversations: RecentConversationListItem[],
  now: number,
  query: string,
): RecentConversationListItem[] {
  const cutoff = now - RECENT_WINDOW_MS;
  const needle = query.trim().toLowerCase();
  return conversations.filter((conversation) =>
    lastActivityTime(conversation) >= cutoff
    && (!needle
      || conversation.sessionTitle.toLowerCase().includes(needle)
      || conversation.projectDisplayName.toLowerCase().includes(needle)));
}
