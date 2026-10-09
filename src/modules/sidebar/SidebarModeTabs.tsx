import { Activity, Archive, Clock, Folder, MessageSquare } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { TFunction } from 'i18next';

import { Tooltip } from '@/shared/ui';
import { cn } from '@/shared/utils';
import type { SidebarSearchMode } from '@/shared/types';

type ModeTab = {
  mode: SidebarSearchMode;
  /** Shown as the tooltip and the accessible name; the strip itself is icons only. */
  label: string;
  icon: LucideIcon;
};

type SidebarModeTabsProps = {
  searchMode: SidebarSearchMode;
  onSearchModeChange: (mode: SidebarSearchMode) => void;
  runningSessionsCount: number;
  t: TFunction;
};

/**
 * Used by SidebarHeader for the section strip above the search box, in both the
 * desktop and the mobile header.
 *
 * Every section is an icon with a tooltip, so all of them fit side by side at
 * any sidebar width and none has to hide behind an overflow menu.
 */
export default function SidebarModeTabs({
  searchMode,
  onSearchModeChange,
  runningSessionsCount,
  t,
}: SidebarModeTabsProps) {
  const tabs: ModeTab[] = [
    { mode: 'projects', label: t('search.modeProjects'), icon: Folder },
    { mode: 'conversations', label: t('search.modeConversations'), icon: MessageSquare },
    { mode: 'recent', label: t('search.modeRecent', 'Recent'), icon: Clock },
    { mode: 'running', label: t('search.runningTooltip', 'Running sessions'), icon: Activity },
    { mode: 'archived', label: t('search.archiveOnlyTooltip', 'Archive only'), icon: Archive },
  ];

  const runningBadgeText = runningSessionsCount > 99 ? '99+' : String(runningSessionsCount);

  return (
    // Each Tooltip wraps its button in an inline-block, so the wrappers are what share the width.
    <div className="flex rounded-lg bg-muted/50 p-0.5 [&>div]:flex-1">
      {tabs.map((tab) => {
        const isActive = tab.mode === searchMode;
        const Icon = tab.icon;

        return (
          <Tooltip key={tab.mode} content={tab.label} position="top">
            <button
              onClick={() => onSearchModeChange(tab.mode)}
              aria-pressed={isActive}
              aria-label={tab.label}
              className={cn(
                'flex w-full items-center justify-center rounded-md px-2 py-1.5 transition-all',
                isActive
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
                isActive && tab.mode === 'running' && 'ring-1 ring-emerald-500/15',
              )}
            >
              {tab.mode === 'running' ? (
                <span className="relative flex h-3.5 w-3.5 items-center justify-center">
                  <Activity className={cn('h-3.5 w-3.5', runningSessionsCount > 0 && 'text-emerald-500')} />
                  {runningSessionsCount > 0 && (
                    <span className="absolute -right-2.5 -top-2 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-emerald-500 px-0.5 text-[8px] font-semibold leading-none text-white shadow-sm ring-1 ring-background">
                      {runningBadgeText}
                    </span>
                  )}
                </span>
              ) : (
                <Icon className="h-3.5 w-3.5" />
              )}
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}
