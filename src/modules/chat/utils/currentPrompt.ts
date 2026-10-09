import type { ChatMessage } from '@/shared/types';

/** The user's prompt the running turn is answering, as the composer shows it. */
export type CurrentPrompt = {
  text: string;
  timestamp: ChatMessage['timestamp'];
};

/** The newest user message with text, or null when the transcript has none. */
export function findCurrentPrompt(messages: readonly ChatMessage[]): CurrentPrompt | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.type !== 'user') continue;
    const text = (message.displayText ?? message.content ?? '').trim();
    if (text) {
      return { text, timestamp: message.timestamp };
    }
  }
  return null;
}
