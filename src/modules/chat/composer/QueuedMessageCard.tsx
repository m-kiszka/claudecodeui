import { useTranslation } from 'react-i18next';
import { PencilIcon, XIcon, ZapIcon } from 'lucide-react';

type QueuedMessageCardProps = {
  content: string;
  attachmentCount?: number;
  onEdit: () => void;
  onDelete: () => void;
  /** Stops the running turn so the queued message goes out now; absent when the turn cannot be stopped. */
  onSendNow?: () => void;
};

/**
 * Rendered by chat's ChatComposer to show the message queued for a busy
 * session, with edit and delete actions before it is auto-sent, and a
 * "send now" action that interrupts the running turn instead of waiting.
 */
export default function QueuedMessageCard({
  content,
  attachmentCount = 0,
  onEdit,
  onDelete,
  onSendNow,
}: QueuedMessageCardProps) {
  const { t } = useTranslation('chat');

  return (
    <div className="settings-content-enter mx-auto mb-2 max-w-[54.25rem] rounded-xl rounded-t-none border border-dashed border-primary/25 bg-primary/[0.04] px-3 py-2">
      <div className="flex items-start gap-2.5">
        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" aria-hidden />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-primary/70">
            <span>{t('input.queue.label', { defaultValue: 'Queued' })}</span>
            <span className="normal-case text-muted-foreground/60">
              · {t('input.queue.willSend', { defaultValue: 'Will send when this finishes' })}
            </span>
          </div>
          <p className="mt-0.5 line-clamp-2 break-words text-sm text-foreground/90">{content}</p>
          {attachmentCount > 0 && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {attachmentCount} {attachmentCount === 1 ? 'file' : 'files'} attached
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          {onSendNow && (
            <button
              type="button"
              onClick={onSendNow}
              aria-label={t('input.queue.sendNow', { defaultValue: 'Stop the current response and send now' })}
              title={t('input.queue.sendNow', { defaultValue: 'Stop the current response and send now' })}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
            >
              <ZapIcon className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={onEdit}
            aria-label={t('input.queue.edit', { defaultValue: 'Edit queued message' })}
            title={t('input.queue.edit', { defaultValue: 'Edit queued message' })}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <PencilIcon className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={t('input.queue.delete', { defaultValue: 'Delete queued message' })}
            title={t('input.queue.delete', { defaultValue: 'Delete queued message' })}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <XIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
