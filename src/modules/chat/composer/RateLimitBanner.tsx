import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, Play } from 'lucide-react';

import type { RateLimitInfo } from '@/shared/types';

type RateLimitBannerProps = {
  rateLimit: RateLimitInfo;
  /** Sends the continue prompt now. */
  onContinue: () => void;
  /** Schedules the continue prompt for just after the limit resets; absent without a reset time. */
  onContinueAtReset?: () => void;
  /** When a continue prompt is already scheduled for this reset, so the banner says so instead. */
  continueScheduledFor?: Date | null;
};

/** `1h 12m`, `12m`, `40s`. */
function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${totalSeconds}s`;
}

/** The reset as the user reads it: a time today, else a date and time. */
function formatReset(resetsAt: Date): string {
  const sameDay = resetsAt.toDateString() === new Date().toDateString();
  return sameDay
    ? resetsAt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : resetsAt.toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/**
 * Rendered by chat's ChatComposer while the session's latest turn was refused
 * for a usage limit: which limit, when it resets and how long that is away,
 * and two ways on — continue now, or have the server continue once it resets.
 * It stands in for the CLI's /rate-limit-options menu, which the chat never
 * receives.
 */
export default function RateLimitBanner({ rateLimit, onContinue, onContinueAtReset, continueScheduledFor }: RateLimitBannerProps) {
  const { t } = useTranslation('chat');
  const [now, setNow] = useState(() => Date.now());
  const resetsAt = rateLimit.resetsAt ? new Date(rateLimit.resetsAt) : null;
  const hasReset = resetsAt ? resetsAt.getTime() <= now : false;

  useEffect(() => {
    if (!resetsAt || hasReset) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [resetsAt, hasReset]);

  const limitName = rateLimit.rateLimitType === 'five_hour'
    ? t('rateLimit.session', 'Session limit')
    : rateLimit.rateLimitType?.startsWith('seven_day')
      ? t('rateLimit.weekly', 'Weekly limit')
      : t('rateLimit.generic', 'Usage limit');

  let detail = '';
  if (resetsAt && hasReset) {
    detail = t('rateLimit.hasReset', 'has reset, you can continue');
  } else if (resetsAt) {
    detail = t('rateLimit.resetsAt', 'resets at {{time}} (in {{remaining}})', {
      time: formatReset(resetsAt),
      remaining: formatRemaining(resetsAt.getTime() - now),
    });
  }

  const buttonClassName = 'flex items-center gap-1 rounded-md border border-border/60 px-2 py-1 text-xs text-foreground/80 transition-colors hover:bg-muted hover:text-foreground';

  return (
    <div
      role="status"
      className="mx-auto mb-2 flex max-w-[54.25rem] flex-wrap items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2 text-sm"
    >
      <Clock className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="font-medium text-foreground">{t('rateLimit.reached', '{{limit}} reached', { limit: limitName })}</span>
        {detail && <span className="text-muted-foreground"> · {detail}</span>}
      </span>
      <div className="flex shrink-0 items-center gap-1.5">
        {continueScheduledFor && !hasReset ? (
          <span className="text-xs text-muted-foreground">
            {t('rateLimit.continueScheduled', 'Continues at {{time}}', { time: formatReset(continueScheduledFor) })}
          </span>
        ) : (
          onContinueAtReset && resetsAt && !hasReset && (
            <button type="button" onClick={onContinueAtReset} className={buttonClassName}>
              <Clock className="h-3 w-3" />
              {t('rateLimit.continueAtReset', 'Continue when it resets')}
            </button>
          )
        )}
        <button type="button" onClick={onContinue} className={buttonClassName}>
          <Play className="h-3 w-3" />
          {t('rateLimit.continue', 'Continue')}
        </button>
      </div>
    </div>
  );
}
