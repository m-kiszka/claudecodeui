import assert from 'node:assert/strict';

import { test } from 'vitest';

import type { ChatMessage } from '@/shared/types';
import { findUserPrompts } from '@/modules/chat/utils/currentPrompt';

const message = (type: string, content: string, timestamp: number, extra: Partial<ChatMessage> = {}): ChatMessage =>
  ({ type, content, timestamp, ...extra }) as ChatMessage;

test('user prompts are listed newest first', () => {
  const prompts = findUserPrompts([
    message('user', 'first', 1),
    message('assistant', 'answer', 2),
    message('user', 'second', 3),
    message('tool', 'Read', 4),
  ]);

  assert.deepEqual(prompts, [
    { text: 'second', timestamp: 3 },
    { text: 'first', timestamp: 1 },
  ]);
});

test('the shown text wins over raw content, and blank user rows are skipped', () => {
  const prompts = findUserPrompts([
    message('user', 'raw', 1, { displayText: 'shown' }),
    message('user', '   ', 2),
  ]);

  assert.deepEqual(prompts, [{ text: 'shown', timestamp: 1 }]);
});

test('a transcript without user messages has no prompts', () => {
  assert.deepEqual(findUserPrompts([message('assistant', 'hi', 1)]), []);
});
