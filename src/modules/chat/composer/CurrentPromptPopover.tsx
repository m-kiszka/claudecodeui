import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import { ArrowUpToLine } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { CurrentPrompt } from '@/modules/chat/utils/currentPrompt';

/** Widest the dialog gets; also used to keep it inside the viewport. */
const DIALOG_MAX_WIDTH_PX = 704;

/** Time of a prompt, with the date added when it is not from today. */
function formatPromptTime(timestamp: CurrentPrompt['timestamp']): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return date.toDateString() === new Date().toDateString()
    ? time
    : `${date.toLocaleDateString([], { day: 'numeric', month: 'short' })} ${time}`;
}

type CurrentPromptPopoverProps = {
  /** The user's prompts in this transcript, newest first; never empty. */
  prompts: CurrentPrompt[];
  onJumpToPrompt: (prompt: CurrentPrompt) => void;
  /** Renders the button that opens the popover, so it can match its toolbar. */
  renderTrigger: (trigger: { isOpen: boolean; toggle: () => void }) => ReactNode;
};

/**
 * Rendered by ChatComposer in the input toolbar: opens, right above the
 * composer, the latest prompt in full and a list of every earlier one, each a
 * link to its message, so none needs the transcript scrolled back to find it.
 */
export default function CurrentPromptPopover({
  prompts,
  onJumpToPrompt,
  renderTrigger,
}: CurrentPromptPopoverProps) {
  const { t } = useTranslation('chat');
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const [anchor, setAnchor] = useState<{ left: number; bottom: number } | null>(null);

  // The composer clips its contents, so the dialog is portalled out and placed
  // just above the trigger, kept inside the viewport horizontally.
  useLayoutEffect(() => {
    if (!isOpen || !rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    const width = Math.min(DIALOG_MAX_WIDTH_PX, window.innerWidth - 32);
    setAnchor({
      left: Math.max(16, Math.min(rect.left, window.innerWidth - width - 16)),
      bottom: window.innerHeight - rect.top + 8,
    });
  }, [isOpen]);
  const label = t('claudeStatus.currentPrompt', { defaultValue: 'Current prompt' });
  const [latestPrompt] = prompts;

  const jumpTo = (prompt: CurrentPrompt) => {
    setIsOpen(false);
    onJumpToPrompt(prompt);
  };

  // Dismissed by a click anywhere else or Escape, like the composer's other popovers.
  useEffect(() => {
    if (!isOpen) return undefined;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !dialogRef.current?.contains(target)) setIsOpen(false);
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

  return (
    <div ref={rootRef} className="relative inline-flex">
      {isOpen && anchor && createPortal(
        <div
          ref={dialogRef}
          role="dialog"
          aria-label={label}
          style={{ left: anchor.left, bottom: anchor.bottom, maxWidth: DIALOG_MAX_WIDTH_PX }}
          className="fixed z-50 flex max-h-[min(75vh,44rem)] w-[calc(100vw-2rem)] flex-col rounded-lg border border-border/60 bg-popover text-popover-foreground shadow-lg"
        >
          <div className="shrink-0 border-b border-border/60 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
              <button
                type="button"
                onClick={() => jumpTo(latestPrompt)}
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <ArrowUpToLine className="h-3 w-3" />
                {t('claudeStatus.jumpToPrompt', { defaultValue: 'Jump to message' })}
              </button>
            </div>
            <p className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words text-sm">{latestPrompt.text}</p>
          </div>

          {prompts.length > 1 && (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="shrink-0 px-3 pb-1 pt-2 text-[11px] font-medium text-muted-foreground">
                {t('claudeStatus.allPrompts', { count: prompts.length, defaultValue: 'All prompts ({{count}})' })}
              </div>
              <ol className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-1.5 pb-1.5">
                {prompts.map((prompt, index) => (
                  <li key={`${String(prompt.timestamp)}-${index}`}>
                    <button
                      type="button"
                      onClick={() => jumpTo(prompt)}
                      className="flex w-full items-start gap-2 rounded-md px-1.5 py-1.5 text-left hover:bg-muted"
                    >
                      <span className="w-6 shrink-0 pt-px text-right text-[11px] tabular-nums text-muted-foreground/70">
                        {prompts.length - index}
                      </span>
                      <span className="line-clamp-2 min-w-0 flex-1 break-words text-xs text-foreground/90">
                        {prompt.text}
                      </span>
                      <span className="shrink-0 pt-px text-[11px] tabular-nums text-muted-foreground/70">
                        {formatPromptTime(prompt.timestamp)}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>,
        document.body,
      )}

      {renderTrigger({ isOpen, toggle: () => setIsOpen((open) => !open) })}
    </div>
  );
}
