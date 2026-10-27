import { Activity, CircleCheck, Loader2, MessageCircleQuestion } from 'lucide-react';
import type { TFunction } from 'i18next';

import { Tooltip } from '@/shared/ui';
import type { SessionStatus } from '@/modules/sidebar/utils/sessionStatus';

type SessionStatusIconProps = {
  status: SessionStatus;
  t: TFunction;
};

/**
 * Rendered by SidebarSessionItem and SidebarRecentConversations on the row's
 * left edge, in the slot of the activity dot it replaces while shown.
 */
export default function SessionStatusIcon({ status, t }: SessionStatusIconProps) {
  if (!status) {
    return null;
  }

  const { label, icon } = {
    'awaiting-input': {
      label: t('tooltips.awaitingInputIndicator', { defaultValue: 'Waiting for your input' }),
      icon: <MessageCircleQuestion className="h-3 w-3 animate-pulse text-amber-500" />,
    },
    working: {
      label: t('tooltips.processingSessionIndicator', { defaultValue: 'Processing session' }),
      icon: <Loader2 className="h-3 w-3 animate-spin text-emerald-500 dark:text-emerald-400" />,
    },
    // No spinner: nothing is responding. The purple of the workflow and agent
    // cards says what is still running.
    background: {
      label: t('tooltips.backgroundWorkIndicator', { defaultValue: 'Background work running' }),
      icon: <Activity className="h-3 w-3 animate-pulse text-purple-500 dark:text-purple-400" />,
    },
    'unread-completed': {
      label: t('tooltips.unreadCompletedIndicator', { defaultValue: 'Finished, not read yet' }),
      icon: <CircleCheck className="h-3 w-3 text-sky-500 dark:text-sky-400" />,
    },
  }[status];

  return (
    <div className="absolute left-0 top-1/2 z-10 -translate-x-1.5 -translate-y-1/2 transform">
      <Tooltip content={label} position="right">
        <span
          role="status"
          aria-label={label}
          className="flex h-4 w-4 items-center justify-center rounded-full bg-background"
        >
          {icon}
        </span>
      </Tooltip>
    </div>
  );
}
