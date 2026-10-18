import assert from 'node:assert/strict';
import test from 'node:test';

import { buildClaudeModelsDefinition, CLAUDE_ULTRACODE_EFFORT } from '@/modules/providers/list/claude/claude-models.provider.js';

test('the CLI catalog is offered as /model lists it, names and versions included', () => {
  const definition = buildClaudeModelsDefinition([
    { value: 'default', displayName: 'Default (recommended)', description: 'Opus 5.5 · Best for everyday, complex tasks', supportedEffortLevels: ['low', 'medium', 'high', 'xhigh', 'max'] },
    { value: 'opus', displayName: 'Opus 5.5', description: 'For complex work', supportedEffortLevels: ['low', 'high', 'xhigh'] },
    { value: 'claude-haiku-4-5-20251001', displayName: 'Haiku 4.5', description: 'Fastest for quick answers' },
  ]);

  assert.deepEqual(definition.OPTIONS.map((option) => [option.value, option.label]), [
    ['default', 'Default (recommended)'],
    ['opus', 'Opus 5.5'],
    ['claude-haiku-4-5-20251001', 'Haiku 4.5'],
  ]);
  assert.equal(definition.DEFAULT, 'default');
  assert.deepEqual(definition.OPTIONS[1]?.effort?.values.map((entry) => entry.value), ['low', 'high', 'xhigh', CLAUDE_ULTRACODE_EFFORT]);
  assert.equal(definition.OPTIONS[1]?.effort?.default, 'high');
  // A model without effort levels offers no effort section.
  assert.equal(definition.OPTIONS[2]?.effort, undefined);
});
