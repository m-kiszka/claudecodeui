import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CSSProperties, ReactNode, RefObject } from 'react';
import { History, MessageSquareText } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { CurrentPrompt } from '@/modules/chat/utils/currentPrompt';

/** Matches CommandMenu's geometry, so both menus open in the same spot. */
const MENU_EDGE_GAP = 16;
const MENU_WIDTH_PX = 440;
const MENU_MAX_HEIGHT_PX = 420;

/** CommandMenu's surface, so the two composer menus read as one family. */
const menuSurfaceStyle: CSSProperties = {
  overflowY: 'auto',
  borderRadius: '8px',
  boxShadow: '0 24px 60px rgba(2, 6, 23, 0.38), 0 0 0 1px rgba(148, 163, 184, 0.12)',
  zIndex: 1000,
  padding: '6px',
  backdropFilter: 'blur(12px)',
};

const latestAccentClass =
  'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-200';
const earlierAccentClass =
  'border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-500/20 dark:bg-gray-500/10 dark:text-gray-200';

/** Time of a prompt, with the date added when it is not from today. */
function formatPromptTime(timestamp: CurrentPrompt['timestamp']): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return date.toDateString() === new Date().toDateString()
    ? time
    : `${date.toLocaleDateString([], { day: 'numeric', month: 'short' })} ${time}`;
}

/** Placed like CommandMenu: above the input's top-left corner, inside the viewport. */
function getMenuPosition(anchor: HTMLElement | null): CSSProperties {
  const rect = anchor?.getBoundingClientRect();
  const bottom = rect ? window.innerHeight - rect.top + 8 : 90;
  const maxHeight = `min(${MENU_MAX_HEIGHT_PX}px, calc(100vh - ${bottom}px - ${MENU_EDGE_GAP}px))`;
  if (window.innerWidth < 640) {
    return { position: 'fixed', bottom, left: MENU_EDGE_GAP, right: MENU_EDGE_GAP, maxHeight };
  }
  const left = Math.max(
    MENU_EDGE_GAP,
    Math.min(rect?.left ?? MENU_EDGE_GAP, window.innerWidth - MENU_WIDTH_PX - MENU_EDGE_GAP),
  );
  return {
    position: 'fixed',
    bottom,
    left,
    width: `min(${MENU_WIDTH_PX}px, calc(100vw - ${MENU_EDGE_GAP * 2}px))`,
    maxHeight,
  };
}

type CurrentPromptPopoverProps = {
  /** The user's prompts in this transcript, newest first; never empty. */
  prompts: CurrentPrompt[];
  onJumpToPrompt: (prompt: CurrentPrompt) => void;
  /** The element the menu opens above; the composer passes its textarea, as for CommandMenu. */
  anchorRef: RefObject<HTMLElement>;
  /** Renders the button that opens the menu, so it can match its toolbar. */
  renderTrigger: (trigger: { isOpen: boolean; toggle: () => void }) => ReactNode;
};

/**
 * Rendered by ChatComposer in the input toolbar: a menu in the style and spot
 * of the slash-command menu, with the latest prompt in full and every earlier
 * one below it, each a link to its message in the transcript.
 */
export default function CurrentPromptPopover({
  prompts,
  onJumpToPrompt,
  anchorRef,
  renderTrigger,
}: CurrentPromptPopoverProps) {
  const { t } = useTranslation('chat');
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<CSSProperties | null>(null);
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [latestPrompt, ...earlierPrompts] = prompts;
  const label = t('claudeStatus.currentPrompt', { defaultValue: 'Current prompt' });

  const toggle = () => {
    if (!isOpen) setMenuPosition(getMenuPosition(anchorRef.current));
    setIsOpen((open) => !open);
  };

  const jumpTo = (prompt: CurrentPrompt) => {
    setIsOpen(false);
    onJumpToPrompt(prompt);
  };

  // Dismissed by a click anywhere else or Escape, like the composer's other menus.
  useEffect(() => {
    if (!isOpen) return undefined;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) setIsOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const renderPromptRow = (prompt: CurrentPrompt, number: number, isLatest: boolean) => (
    <button
      key={`${String(prompt.timestamp)}-${number}`}
      type="button"
      onClick={() => jumpTo(prompt)}
      title={t('claudeStatus.jumpToPrompt', { defaultValue: 'Jump to message' })}
      className="group relative mb-1 flex w-full items-start gap-2 rounded-md border border-transparent bg-transparent px-2.5 py-2 text-left transition-all hover:border-border hover:bg-accent"
    >
      <span
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${
          isLatest ? latestAccentClass : earlierAccentClass
        }`}
      >
        {isLatest
          ? <MessageSquareText aria-hidden="true" size={14} strokeWidth={2.2} />
          : <span className="text-[11px] font-semibold tabular-nums">{number}</span>}
      </span>
      <span className="min-w-0 flex-1 pr-1">
        <span
          className={`block break-words text-[13px] leading-5 text-foreground ${
            isLatest ? 'max-h-40 overflow-y-auto whitespace-pre-wrap' : 'line-clamp-2'
          }`}
        >
          {prompt.text}
        </span>
        <span className="mt-0.5 block text-[11px] tabular-nums text-muted-foreground">
          {formatPromptTime(prompt.timestamp)}
        </span>
      </span>
    </button>
  );

  return (
    <div ref={triggerRef} className="relative inline-flex">
      {isOpen && menuPosition && createPortal(
        <div
          ref={menuRef}
          role="dialog"
          aria-label={label}
          className="command-menu border border-border bg-popover/95 text-popover-foreground"
          style={{ ...menuSurfaceStyle, ...menuPosition }}
        >
          <div className="px-2 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </div>
          {renderPromptRow(latestPrompt, prompts.length, true)}

          {earlierPrompts.length > 0 && (
            <>
              <div className="flex items-center gap-1.5 px-2 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                <History aria-hidden="true" size={11} />
                <span className="flex-1">{t('claudeStatus.earlierPrompts', { defaultValue: 'Earlier prompts' })}</span>
                <span className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {earlierPrompts.length}
                </span>
              </div>
              {earlierPrompts.map((prompt, index) => renderPromptRow(prompt, earlierPrompts.length - index, false))}
            </>
          )}
        </div>,
        document.body,
      )}

      {renderTrigger({ isOpen, toggle })}
    </div>
  );
}
