import { describe, expect, it } from 'vitest';

import { readRefusingRateLimit } from '@/modules/chat/hooks/useChatMessages';
import type { NormalizedMessage } from '@/shared/types';

const row = (overrides: Partial<NormalizedMessage>): NormalizedMessage => ({
  id: Math.random().toString(36),
  sessionId: 'session-1',
  timestamp: '2026-10-16T12:20:14.448Z',
  provider: 'claude',
  kind: 'text',
  ...overrides,
}) as NormalizedMessage;

const refused = { status: 'rejected' as const, resetsAt: 1_792_167_000_000, rateLimitType: 'five_hour' };

describe('the usage limit that refused a session', () => {
  it('is the latest refusal nothing has answered', () => {
    expect(readRefusingRateLimit([
      row({ role: 'user', content: 'Do the thing' }),
      row({ role: 'assistant', content: 'You\'ve hit your session limit', rateLimit: refused }),
    ])).toEqual(refused);
  });

  it('is gone once a prompt follows it', () => {
    expect(readRefusingRateLimit([
      row({ role: 'assistant', content: 'You\'ve hit your session limit', rateLimit: refused }),
      row({ role: 'user', content: 'Continue' }),
      row({ role: 'assistant', content: 'Picking up where I left off.' }),
    ])).toBeNull();
  });

  it('is gone when a later report says the account is allowed again', () => {
    expect(readRefusingRateLimit([
      row({ role: 'assistant', content: 'You\'ve hit your session limit', rateLimit: refused }),
      row({ kind: 'status', rateLimit: { status: 'allowed' } }),
    ])).toBeNull();
  });
});
