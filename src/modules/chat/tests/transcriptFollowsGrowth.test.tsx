import assert from 'node:assert/strict';

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, test, vi } from 'vitest';

import type { Project, ProjectSession } from '@/shared/types';

/**
 * A reply streaming into its row, a tool result expanding or late markdown
 * grows the transcript without adding a message. The transcript follows that
 * growth while the user is at the bottom and "Follow new messages" is on; off,
 * it stays put and offers the scroll-to-bottom button instead.
 */

vi.mock('@/shared/api', () => ({
  api: {
    providers: {
      sessionTokenUsage: () => Promise.resolve({ ok: false, json: async () => ({}) }),
    },
    syncSession: () => Promise.resolve({ ok: false, json: async () => ({}) }),
  },
}));

const project: Project = {
  projectId: 'project-1',
  path: '/repo',
  fullPath: '/repo',
  displayName: 'Repo',
  isStarred: false,
};

const session = { id: 'session-a', __provider: 'claude' } as unknown as ProjectSession;

/**
 * jsdom has no layout: the heights are set by hand and scrollTop writes
 * recorded. A write is clamped to the scrollable range, as a browser does.
 */
function createContainer(clientHeight: number) {
  const element = document.createElement('div');
  element.appendChild(document.createElement('div'));
  const writes: number[] = [];
  let scrollHeight = 1000;
  let scrollTop = scrollHeight - clientHeight;

  Object.defineProperty(element, 'scrollHeight', { get: () => scrollHeight });
  Object.defineProperty(element, 'clientHeight', { get: () => clientHeight });
  Object.defineProperty(element, 'scrollTop', {
    get: () => scrollTop,
    set: (next: number) => {
      scrollTop = Math.max(0, Math.min(next, scrollHeight - clientHeight));
      writes.push(next);
    },
  });

  return {
    element: element as HTMLDivElement,
    writes,
    grow: (by: number) => {
      scrollHeight += by;
    },
  };
}

let resizeCallbacks: Array<() => void> = [];

function createStore() {
  const slot = { fetchedAt: 1, status: 'idle' as const, total: 0, hasMore: false, offset: 0 };
  return {
    fetchFromServer: vi.fn(async () => slot),
    fetchMore: vi.fn(async () => ({ slot, prependedCount: 0 })),
    appendRealtime: vi.fn(),
    refreshLatestFromServer: vi.fn(async () => ({ slot, applied: true, changed: false, deferred: false })),
    setActiveSession: vi.fn(),
    isStale: vi.fn(() => false),
    updateStreaming: vi.fn(),
    finalizeStreaming: vi.fn(),
    getMessages: vi.fn(() => []),
    getSessionSlot: vi.fn(() => slot),
  };
}

/** Mounts inactive, attaches the container, then activates, as the pane mounts before the chat is shown. */
async function renderWithContainer(autoScroll: boolean) {
  const { useChatSessionState } = await import('@/modules/chat/hooks/useChatSessionState');
  const store = createStore();
  const rendered = renderHook(
    ({ isActive }: { isActive: boolean }) =>
      useChatSessionState({
        isActive,
        autoScroll,
        selectedProject: project,
        selectedSession: session,
        ws: null,
        sendMessage: vi.fn(),
        resetStreamingState: vi.fn(),
        statusCheckSentAtRef: { current: new Map() },
        lastSeqRef: { current: new Map() },
        sessionStore: store as never,
      }),
    { initialProps: { isActive: false } },
  );

  const container = createContainer(400);
  (rendered.result.current.scrollContainerRef as { current: HTMLDivElement | null }).current = container.element;
  rendered.rerender({ isActive: true });
  await act(async () => {});
  container.writes.length = 0;
  return { rendered, container };
}

const reportResize = () => act(() => {
  for (const callback of resizeCallbacks) callback();
});

beforeEach(() => {
  resizeCallbacks = [];
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: () => void) {
      resizeCallbacks.push(callback);
    }
    observe() {}
    disconnect() {}
  });
  vi.stubGlobal('requestAnimationFrame', () => 0);
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

test('content growing at the bottom is followed', async () => {
  const { container } = await renderWithContainer(true);

  container.grow(300);
  await reportResize();

  assert.deepEqual(container.writes, [1300], 'scrolled to the new bottom');
});

test('growth is not followed once the user has scrolled up', async () => {
  const { rendered, container } = await renderWithContainer(true);
  act(() => rendered.result.current.setIsUserScrolledUp(true));

  container.grow(300);
  await reportResize();

  assert.deepEqual(container.writes, [], 'the reading position is kept');
});

test('with following off, growth stays put and brings up the scroll-to-bottom button', async () => {
  const { rendered, container } = await renderWithContainer(false);

  container.grow(300);
  await reportResize();

  assert.deepEqual(container.writes, [], 'the view does not move');
  assert.equal(rendered.result.current.isUserScrolledUp, true, 'the button shows');
});
