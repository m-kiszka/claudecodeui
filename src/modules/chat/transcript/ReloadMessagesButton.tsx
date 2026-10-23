import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw } from 'lucide-react';

type ReloadMessagesButtonProps = {
  onReload: () => Promise<void>;
};

/**
 * Re-reads the conversation from its transcript on disk. Turns run in the
 * Shell-tab CLI reach the Chat through a file watcher, which can lag or fail
 * to stitch a large gap; this is the manual way to catch up.
 */
export function ReloadMessagesButton({ onReload }: ReloadMessagesButtonProps) {
  const { t } = useTranslation('chat');
  const [pending, setPending] = useState(false);

  const handleClick = useCallback(async () => {
    if (pending) return;
    setPending(true);
    try {
      await onReload();
    } finally {
      setPending(false);
    }
  }, [onReload, pending]);

  const label = t('reloadMessages.title', 'Reload the conversation from disk (picks up turns from the Shell tab)');

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      title={label}
      aria-label={label}
      className="flex h-7 w-7 items-center justify-center rounded-md border border-border/60 bg-background/95 text-muted-foreground shadow-sm backdrop-blur transition-colors hover:bg-muted hover:text-foreground disabled:opacity-60"
    >
      <RefreshCw className={`h-3 w-3 ${pending ? 'animate-spin' : ''}`} />
    </button>
  );
}
