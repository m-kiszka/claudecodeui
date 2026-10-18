import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Smartphone, Terminal } from 'lucide-react';

import { api, readApiJson } from '@/shared/api';

type RemoteControlState = { enabled: boolean; shellOpen: boolean; shellBusy: boolean };

type RemoteControlToggleProps = {
  sessionId: string | null;
  /** Switches the workspace to the Shell tab, which opens the session's Claude CLI. */
  onOpenShell?: () => void;
};

/** How often the bridge state is re-read: it also changes from the Shell tab or the CLI itself. */
const REMOTE_CONTROL_POLL_MS = 5_000;

/**
 * Rendered by chat's ChatMessagesPane in the transcript's top bar for a Claude
 * session: whether the conversation is bridged to Claude Remote Control, and a
 * switch for it. The bridge lives in the session's Shell-tab CLI (the chat's
 * own process lasts one turn), so without that CLI the control offers to open
 * the Shell tab instead.
 */
export function RemoteControlToggle({ sessionId, onOpenShell }: RemoteControlToggleProps) {
  const { t } = useTranslation('chat');
  const [state, setState] = useState<RemoteControlState | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      return;
    }
    let cancelled = false;
    const read = async () => {
      if (document.visibilityState === 'hidden') {
        return;
      }
      try {
        const payload = await readApiJson<{ data: RemoteControlState }>(await api.remoteControl.get(sessionId));
        if (!cancelled) {
          setState(payload.data);
        }
      } catch {
        // A failed read keeps the last state; the next poll tries again.
      }
    };
    void read();
    const timer = setInterval(() => void read(), REMOTE_CONTROL_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [sessionId]);

  const toggle = useCallback(async () => {
    if (!sessionId || !state || pending) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const payload = await readApiJson<{ data: RemoteControlState }>(await api.remoteControl.set(sessionId, !state.enabled));
      setState(payload.data);
      if (payload.data.enabled === state.enabled) {
        setError(t('remoteControl.notConfirmed', 'The Shell-tab Claude did not confirm the change. Check the Shell tab.'));
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setPending(false);
    }
  }, [pending, sessionId, state, t]);

  if (!sessionId || !state) {
    return null;
  }

  const stateLabel = state.enabled
    ? t('remoteControl.on', 'Remote Control on')
    : t('remoteControl.off', 'Remote Control off');
  const pillClassName = 'flex h-7 items-center gap-1.5 rounded-md border border-border/60 bg-background/95 px-2 text-[11px] shadow-sm backdrop-blur transition-colors';
  const stateColor = state.enabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground';
  const switchTitle = state.shellBusy
    ? t('remoteControl.shellBusy', 'Wait for the Shell-tab Claude to finish its turn')
    : state.enabled
      ? t('remoteControl.turnOff', 'Turn Remote Control off')
      : t('remoteControl.turnOn', 'Turn Remote Control on');

  return (
    <div className="flex items-center gap-1">
      {state.shellOpen ? (
        <button
          type="button"
          role="switch"
          aria-checked={state.enabled}
          onClick={() => void toggle()}
          disabled={pending || state.shellBusy}
          title={error ?? switchTitle}
          className={`${pillClassName} ${stateColor} hover:bg-muted disabled:opacity-60`}
        >
          {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Smartphone className="h-3 w-3" />}
          <span>{stateLabel}</span>
          <span className={`h-1.5 w-1.5 rounded-full ${state.enabled ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`} aria-hidden />
        </button>
      ) : (
        <>
          <span className={`${pillClassName} ${stateColor}`}>
            <Smartphone className="h-3 w-3" />
            <span>{stateLabel}</span>
          </span>
          {onOpenShell && (
            <button
              type="button"
              onClick={onOpenShell}
              title={t('remoteControl.openShellHint', 'Remote Control is switched from the Claude CLI in the Shell tab')}
              className={`${pillClassName} text-muted-foreground hover:bg-muted hover:text-foreground`}
            >
              <Terminal className="h-3 w-3" />
              <span>{t('remoteControl.openShell', 'Open Shell to switch')}</span>
            </button>
          )}
        </>
      )}
      {error && <span className="max-w-[16rem] truncate text-[11px] text-destructive" title={error}>{error}</span>}
    </div>
  );
}
