import assert from 'node:assert/strict';

import { fireEvent, render, screen } from '@testing-library/react';
import type { TFunction } from 'i18next';
import { test } from 'vitest';

import type { SidebarSearchMode } from '@/shared/types';
import SidebarModeTabs from '@/modules/sidebar/SidebarModeTabs';

const LABELS: Record<string, string> = {
  'search.modeProjects': 'Projects',
  'search.modeConversations': 'Conversations',
  'search.modeRecent': 'Recent',
  'search.runningTooltip': 'Running sessions',
  'search.archiveOnlyTooltip': 'Archive only',
};

const t = ((key: string, fallback?: string) => LABELS[key] ?? fallback ?? key) as unknown as TFunction;

const renderTabs = (searchMode: SidebarSearchMode, runningSessionsCount = 0) => {
  const changes: SidebarSearchMode[] = [];
  const { container } = render(
    <SidebarModeTabs
      searchMode={searchMode}
      onSearchModeChange={(mode) => changes.push(mode)}
      runningSessionsCount={runningSessionsCount}
      t={t}
    />,
  );
  return { changes, container };
};

test('every section is an icon-only button named by its label', () => {
  const { container } = renderTabs('projects');

  for (const label of Object.values(LABELS)) {
    const button = screen.getByRole('button', { name: label });
    assert.equal(button.textContent, '', `${label} shows no visible text`);
  }
  assert.equal(container.querySelectorAll('button').length, 5, 'no overflow menu');
});

test('the open section is pressed and clicking another selects it', () => {
  const { changes } = renderTabs('recent');

  assert.equal(screen.getByRole('button', { name: 'Recent' }).getAttribute('aria-pressed'), 'true');
  assert.equal(screen.getByRole('button', { name: 'Projects' }).getAttribute('aria-pressed'), 'false');

  fireEvent.click(screen.getByRole('button', { name: 'Archive only' }));
  assert.deepEqual(changes, ['archived']);
});

test('the running tab keeps its session count badge', () => {
  renderTabs('projects', 120);

  assert.equal(screen.getByRole('button', { name: 'Running sessions' }).textContent, '99+');
});
