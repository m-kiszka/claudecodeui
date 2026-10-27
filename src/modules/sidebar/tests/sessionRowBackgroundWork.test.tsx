import assert from 'node:assert/strict';

import { render } from '@testing-library/react';
import React from 'react';
import { beforeEach, test, vi } from 'vitest';

import type { Project, SessionWithProvider, SidebarProjectListProps } from '@/shared/types';

/**
 * The Projects list draws a session's state on the row's left edge. A session
 * whose turn has ended while the tasks it launched still run shows a purple
 * status icon there, in the colour of the workflow and agent cards, instead of
 * the green "touched lately" dot — while the spinner and the destructive-action
 * lockout stay reserved for a response in flight.
 */

const recordedOptionsProps: Record<string, unknown>[] = [];

vi.mock('@/modules/sidebar/hooks/useSessionStatus', async () => {
  const { getSessionStatus } = await import('@/modules/sidebar/utils/sessionStatus');
  const sets = { awaitingInputSessionIds: new Set<string>(), unreadCompletedSessionIds: new Set<string>() };
  return {
    useSessionStatusSets: () => sets,
    useSessionStatus: (sessionId: string, isSelected: boolean, isProcessing: boolean, hasBackgroundWork = false) =>
      getSessionStatus(
        sessionId,
        isSelected,
        isProcessing,
        sets.awaitingInputSessionIds,
        sets.unreadCompletedSessionIds,
        hasBackgroundWork,
      ),
  };
});

vi.mock('@/modules/sidebar/SessionOptions', () => ({
  default: (props: Record<string, unknown>) => {
    recordedOptionsProps.push(props);
    return null;
  },
}));

const { default: SidebarSessionItem } = await import('@/modules/sidebar/SidebarSessionItem');

const t = ((key: string) => key) as unknown as SidebarProjectListProps['t'];
const NOW = new Date('2026-08-21T10:00:00.000Z');
const noop = () => {};

const PROJECT = { projectId: 'project-1', name: 'project-1', displayName: 'project one', fullPath: '/tmp/project-1', sessions: [] } as unknown as Project;
// Touched a minute ago, so the green "recently active" dot would apply.
const SESSION = { id: 's1', summary: 'session one', lastActivity: '2026-08-21T09:59:00.000Z', __provider: 'claude' } as unknown as SessionWithProvider;

const renderRow = (state: { isProcessing: boolean; hasBackgroundWork: boolean }) => render(
  React.createElement(SidebarSessionItem, {
    project: PROJECT,
    session: SESSION,
    selectedSession: null,
    currentTime: NOW,
    isEditing: false,
    renameDraft: '',
    onRenameDraftChange: noop,
    onStartEditingSession: noop,
    onCancelEditingSession: noop,
    onSaveEditingSession: noop,
    onProjectSelect: noop,
    onSessionSelect: noop,
    onDeleteSession: noop,
    isSelecting: false,
    isChecked: false,
    onToggleSessionSelected: noop,
    t,
    ...state,
  }),
);

beforeEach(() => {
  recordedOptionsProps.length = 0;
});

test('background work shows as a purple status icon in place of the green dot, with nothing spinning', () => {
  const idle = renderRow({ isProcessing: false, hasBackgroundWork: false });
  assert.ok(idle.container.querySelector('[role="status"].bg-green-500'), 'the fixture is a recently touched session');
  idle.unmount();

  const { container } = renderRow({ isProcessing: false, hasBackgroundWork: true });

  const statuses = container.querySelectorAll('[role="status"]');
  assert.equal(statuses.length, 1, 'the green dot gives way to the status icon');
  const status = statuses[0];
  assert.equal(status.getAttribute('aria-label'), 'tooltips.backgroundWorkIndicator');
  assert.ok(status.querySelector('.text-purple-500'));
  assert.equal(container.querySelectorAll('.animate-spin').length, 0);
  assert.equal(recordedOptionsProps.at(-1)?.isProcessing, false, 'the row is not locked the way a responding one is');
});

test('a response in flight still spins and shows no dot', () => {
  const { container } = renderRow({ isProcessing: true, hasBackgroundWork: false });

  assert.equal(container.querySelector('[role="status"].h-2'), null);
  assert.equal(container.querySelectorAll('.animate-spin').length, 1);
  assert.equal(recordedOptionsProps[0].isProcessing, true);
});
