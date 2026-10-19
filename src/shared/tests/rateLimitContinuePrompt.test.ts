import { beforeEach, expect, test, vi } from 'vitest';

vi.mock('@/shared/api', () => ({
  api: { user: { preferences: async () => new Response('{}'), savePreferences: async () => new Response('{}') } },
}));

const {
  DEFAULT_RATE_LIMIT_CONTINUE_PROMPT,
  readRateLimitContinuePrompt,
  writeRateLimitContinuePrompt,
} = await import('@/shared/hooks/useRateLimitContinuePrompt');

beforeEach(() => {
  writeRateLimitContinuePrompt('');
});

test('Continue sends the default until the user picks a prompt', () => {
  expect(readRateLimitContinuePrompt()).toBe(DEFAULT_RATE_LIMIT_CONTINUE_PROMPT);
});

test('a chosen prompt is sent trimmed, and a blank one falls back to the default', () => {
  writeRateLimitContinuePrompt('  Kontynuuj ');
  expect(readRateLimitContinuePrompt()).toBe('Kontynuuj');

  writeRateLimitContinuePrompt('   ');
  expect(readRateLimitContinuePrompt()).toBe(DEFAULT_RATE_LIMIT_CONTINUE_PROMPT);
});
