import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import '@/modules/i18n';
import { UiPreferencesProvider } from '@/shared/context/UiPreferencesContext';
import type { ChatMessage } from '@/shared/types';

const { backgroundCommandOutput, subagentActivity } = vi.hoisted(() => ({
  backgroundCommandOutput: vi.fn(async (_sessionId: string, taskId: string) => ({
    ok: true,
    status: 200,
    json: async () => ({ success: true, data: { taskId, output: 'compiling…\ndone\n', size: 17, truncated: false } }),
  })),
  subagentActivity: vi.fn(async (_sessionId: string, agentId: string) => ({
    ok: true,
    status: 200,
    json: async () => ({
      success: true,
      data: { agent: { id: agentId, status: 'running' }, activity: [{ kind: 'text', content: 'Reading the router.' }], activityCount: 1 },
    }),
  })),
}));
vi.mock('@/shared/api', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  api: { backgroundCommandOutput, subagentActivity },
}));

const { BackgroundTasksStrip } = await import('@/modules/chat/transcript/BackgroundTasksStrip');

const renderStrip = (messages: ChatMessage[]) => render(
  <UiPreferencesProvider>
    <BackgroundTasksStrip sessionId="session-1" sendMessage={() => {}} onReveal={() => {}} onLoadAll={() => {}} messages={messages} />
  </UiPreferencesProvider>,
);

describe('the background task details window', () => {
  it('opens from a chip\'s details icon and tails a command\'s output', async () => {
    renderStrip([{
      type: 'assistant',
      timestamp: '2026-10-16T10:00:00.000Z',
      isToolUse: true,
      toolName: 'Bash',
      toolId: 'toolu_bash',
      toolInput: { command: 'npm run build', description: 'Build the client', run_in_background: true },
      taskStatus: { status: 'running', taskId: 'b5d5hh5z7', taskType: 'local_bash', description: 'Build the client' },
    }]);

    fireEvent.click(screen.getByRole('button', { name: 'Details' }));

    expect(await screen.findByText(/compiling…/)).toBeTruthy();
    expect(screen.getByText('$ npm run build')).toBeTruthy();
    expect(backgroundCommandOutput).toHaveBeenCalledWith('session-1', 'b5d5hh5z7');
  });

  it('shows a background agent\'s timeline, read by its id', async () => {
    renderStrip([{
      type: 'assistant',
      timestamp: '2026-10-16T10:00:00.000Z',
      isToolUse: true,
      toolName: 'Agent',
      toolId: 'toolu_agent',
      isSubagentContainer: true,
      taskStatus: { status: 'running', taskId: 'a0123456789abcdef', description: 'Survey the repo', usage: { totalTokens: 1200, toolUses: 3, durationMs: 1 } },
    }]);

    fireEvent.click(screen.getByRole('button', { name: 'Details' }));

    await waitFor(() => expect(screen.getByText('Reading the router.')).toBeTruthy());
    expect(subagentActivity).toHaveBeenCalledWith('session-1', 'a0123456789abcdef');
    expect(screen.getByText(/1200 tokens · 3 tool uses/)).toBeTruthy();
  });
});
