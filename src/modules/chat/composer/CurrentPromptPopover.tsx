import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowUpToLine } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { CurrentPrompt } from '@/modules/chat/utils/currentPrompt';

type CurrentPromptPopoverProps = {
  prompt: CurrentPrompt;
  onJumpToPrompt: (prompt: CurrentPrompt) => void;
  /** Classes for the trigger button, which takes the place of the status tab. */
  triggerClassName: string;
  /** The status tab's content, shown inside the trigger. */
  children: ReactNode;
};

/**
 * Rendered by ActivityIndicator around the running turn's status tab: clicking
 * the status opens the prompt being answered right above the composer, so it
 * can be re-read without scrolling the transcript back to it.
 */
export default function CurrentPromptPopover({
  prompt,
  onJumpToPrompt,
  triggerClassName,
  children,
}: CurrentPromptPopoverProps) {
  const { t } = useTranslation('chat');
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const label = t('claudeStatus.currentPrompt', { defaultValue: 'Current prompt' });

  // Dismissed by a click anywhere else or Escape, like the composer's other popovers.
  useEffect(() => {
    if (!isOpen) return undefined;
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
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
    <div ref={rootRef} className="pointer-events-auto relative min-w-0">
      {isOpen && (
        <div
          role="dialog"
          aria-label={label}
          className="absolute bottom-full left-0 mb-2 w-[min(32rem,calc(100vw-2rem))] rounded-lg border border-border/60 bg-popover p-3 text-popover-foreground shadow-lg"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onJumpToPrompt(prompt);
              }}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ArrowUpToLine className="h-3 w-3" />
              {t('claudeStatus.jumpToPrompt', { defaultValue: 'Jump to message' })}
            </button>
          </div>
          <p className="max-h-64 overflow-y-auto whitespace-pre-wrap break-words text-sm">{prompt.text}</p>
        </div>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        title={t('claudeStatus.showCurrentPrompt', { defaultValue: 'Show the current prompt' })}
        className={`${triggerClassName} cursor-pointer hover:bg-muted/40`}
      >
        {children}
      </button>
    </div>
  );
}
