import assert from 'node:assert/strict';

import { test } from 'vitest';

import type { ChatMessage } from '@/shared/types';
import { findCurrentPrompt } from '@/modules/chat/utils/currentPrompt';

const message = (type: string, content: string, timestamp: number, extra: Partial<ChatMessage> = {}): ChatMessage =>
  ({ type, content, timestamp, ...extra }) as ChatMessage;

test('the newest user message is the current prompt', () => {
  const prompt = findCurrentPrompt([
    message('user', 'first', 1),
    message('assistant', 'answer', 2),
    message('user', 'second', 3),
    message('tool', 'Read', 4),
  ]);

  assert.deepEqual(prompt, { text: 'second', timestamp: 3 });
});

test('the shown text wins over raw content, and blank user rows are skipped', () => {
  const prompt = findCurrentPrompt([
    message('user', 'raw', 1, { displayText: 'shown' }),
    message('user', '   ', 2),
  ]);

  assert.deepEqual(prompt, { text: 'shown', timestamp: 1 });
});

test('a transcript without user messages has no current prompt', () => {
  assert.equal(findCurrentPrompt([message('assistant', 'hi', 1)]), null);
});
