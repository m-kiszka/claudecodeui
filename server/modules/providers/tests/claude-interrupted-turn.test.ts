import assert from 'node:assert/strict';
import test from 'node:test';

import { mapCliOptionsToSDK } from '@/modules/providers/list/claude/claude-runtime.provider.js';

// A message queued with "interrupt to send" stops the running turn, which the
// CLI records as "[Request interrupted by user]". Without a note the model
// reads that as the user cancelling the request, and drops it.
test('a message that interrupted the previous turn asks the model to finish that turn too', () => {
  const sdkOptions = mapCliOptionsToSDK({ resumesInterruptedTurn: true });
  assert.equal(sdkOptions.systemPrompt.preset, 'claude_code');
  assert.match(sdkOptions.systemPrompt.append, /did not cancel it/);
});

test('an ordinary message keeps the plain Claude Code system prompt', () => {
  const sdkOptions = mapCliOptionsToSDK({});
  assert.deepEqual(sdkOptions.systemPrompt, { type: 'preset', preset: 'claude_code' });
});
