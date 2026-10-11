import type { ChatMessage } from '@/shared/types';

/** One of the user's prompts, as the composer's prompt popover lists it. */
export type CurrentPrompt = {
  text: string;
  timestamp: ChatMessage['timestamp'];
};

/** Every user message with text, newest first. */
export function findUserPrompts(messages: readonly ChatMessage[]): CurrentPrompt[] {
  const prompts: CurrentPrompt[] = [];
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.type !== 'user') continue;
    const text = (message.displayText ?? message.content ?? '').trim();
    if (text) {
      prompts.push({ text, timestamp: message.timestamp });
    }
  }
  return prompts;
}
