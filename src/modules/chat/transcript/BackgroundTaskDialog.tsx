import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowUpRight, Square, X } from 'lucide-react';

import { api, readApiJson } from '@/shared/api';
import { Dialog, DialogContent, DialogTitle } from '@/shared/ui';
import type { BackgroundTaskStatus, BackgroundTaskSummary, ChatMessage, DiffLine, Project, SubagentActivity } from '@/shared/types';
import { SubagentTimeline } from '@/modules/chat/tools/SubagentTimeline';
import { WorkflowPanel } from '@/modules/chat/tools/WorkflowPanel';
import { formatTaskDuration, readBackgroundTaskId, readBackgroundTaskStatus } from '@/modules/chat/utils/backgroundTasks';
import { parseToolPayload } from '@/modules/chat/utils/messageTransforms';

/** How often an open window re-reads a running task's timeline or output. */
const TASK_DETAILS_POLL_MS = 1_500;

type SubagentActivitySnapshot = {
  agent: { id: string; type?: string; description?: string; model?: string; status: BackgroundTaskStatus };
  activity: SubagentActivity[];
  activityCount: number;
};

type BackgroundCommandOutput = {
  taskId: string;
  output: string;
  size: number;
  truncated: boolean;
};

/** The task the window describes: its launch row when loaded, else what the activity map knows. */
export type BackgroundTaskSelection =
  | { kind: 'row'; message: ChatMessage }
  | { kind: 'summary'; task: BackgroundTaskSummary };

type BackgroundTaskDialogProps = {
  selection: BackgroundTaskSelection | null;
  onClose: () => void;
  sessionId: string | null;
  sendMessage: (message: unknown) => void;
  onReveal: (message: ChatMessage) => void;
  onLoadAll: () => void;
  createDiff?: (oldStr: string, newStr: string) => DiffLine[];
  onFileOpen?: (filePath: string, diffInfo?: unknown) => void;
  selectedProject?: Project | null;
};

/** Reads the session's record of one task: its output, or its timeline. */
const readCommandOutput = async (sessionId: string, taskId: string) =>
  (await readApiJson<{ data: BackgroundCommandOutput }>(await api.backgroundCommandOutput(sessionId, taskId))).data;
const readAgentActivity = async (sessionId: string, agentId: string) =>
  (await readApiJson<{ data: SubagentActivitySnapshot }>(await api.subagentActivity(sessionId, agentId))).data;

type PolledRead<T> = { key: string } & ({ data: T } | { error: string });

/**
 * Re-reads `read(sessionId, id)` while `active`, every TASK_DETAILS_POLL_MS,
 * and once more when it turns false so the window ends on the task's last
 * word. A failed read keeps what the last good one returned; a result for
 * another task is ignored, so switching tasks starts from "loading".
 */
function usePolledRead<T>(read: (sessionId: string, id: string) => Promise<T>, sessionId: string, id: string, active: boolean) {
  const key = `${sessionId}:${id}`;
  const [loaded, setLoaded] = useState<PolledRead<T> | null>(null);

  useEffect(() => {
    let cancelled = false;
    let nextRead: ReturnType<typeof setTimeout> | undefined;

    const run = async () => {
      try {
        const data = await read(sessionId, id);
        if (!cancelled) {
          setLoaded({ key, data });
        }
      } catch (error) {
        if (!cancelled) {
          setLoaded((previous) => previous?.key === key && 'data' in previous
            ? previous
            : { key, error: error instanceof Error ? error.message : String(error) });
        }
      }
      if (!cancelled && active) {
        nextRead = setTimeout(run, TASK_DETAILS_POLL_MS);
      }
    };
    void run();

    return () => {
      cancelled = true;
      clearTimeout(nextRead);
    };
  }, [read, sessionId, id, key, active]);

  return loaded?.key === key ? loaded : null;
}

/** A backgrounded command's output, tailed while it runs and kept scrolled to the end. */
function CommandOutput({ sessionId, taskId, isRunning }: { sessionId: string; taskId: string; isRunning: boolean }) {
  const { t } = useTranslation();
  const loaded = usePolledRead(readCommandOutput, sessionId, taskId, isRunning);
  const preRef = useRef<HTMLPreElement | null>(null);
  const output = loaded && 'data' in loaded ? loaded.data.output : '';

  useEffect(() => {
    const pre = preRef.current;
    if (pre) {
      pre.scrollTop = pre.scrollHeight;
    }
  }, [output]);

  if (!loaded) {
    return <div className="text-xs text-muted-foreground/60">{t('workflow.taskOutputLoading', 'Reading the output…')}</div>;
  }
  if ('error' in loaded) {
    return <div className="text-xs text-muted-foreground/60">{t('workflow.taskOutputUnavailable', 'Output unavailable: {{reason}}', { reason: loaded.error })}</div>;
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1">
      {loaded.data.truncated && (
        <div className="text-[11px] text-muted-foreground/60">
          {t('workflow.taskOutputTruncated', 'Showing the end of {{size}} KB of output', { size: Math.round(loaded.data.size / 1024) })}
        </div>
      )}
      <pre
        ref={preRef}
        className="min-h-32 flex-1 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border/60 bg-muted/40 p-2 font-mono text-[11px] leading-relaxed text-foreground"
      >
        {output || t('workflow.taskOutputEmpty', 'No output yet')}
      </pre>
    </div>
  );
}

/** A background agent's timeline, re-read from its transcript while it runs. */
function AgentTimeline({ sessionId, agentId, isRunning, createDiff, onFileOpen, selectedProject }: {
  sessionId: string;
  agentId: string;
  isRunning: boolean;
  createDiff?: (oldStr: string, newStr: string) => DiffLine[];
  onFileOpen?: (filePath: string, diffInfo?: unknown) => void;
  selectedProject?: Project | null;
}) {
  const { t } = useTranslation();
  const loaded = usePolledRead(readAgentActivity, sessionId, agentId, isRunning);

  if (!loaded) {
    return <div className="text-xs text-muted-foreground/60">{t('workflow.agentTimelineLoading', 'Reading the agent\'s steps…')}</div>;
  }
  if ('error' in loaded) {
    return <div className="text-xs text-muted-foreground/60">{t('workflow.agentTimelineUnavailable', 'Steps unavailable: {{reason}}', { reason: loaded.error })}</div>;
  }
  if (loaded.data.activity.length === 0) {
    return <div className="text-xs text-muted-foreground/60">{t('workflow.agentTimelineEmpty', 'Nothing recorded yet')}</div>;
  }
  return (
    <SubagentTimeline
      activity={loaded.data.activity}
      activityCount={loaded.data.activityCount}
      createDiff={createDiff ?? (() => [])}
      onFileOpen={onFileOpen}
      selectedProject={selectedProject}
    />
  );
}

/** Seconds since `startedAt`, ticking while `ticking`. */
function useElapsedMs(startedAt: number | null, ticking: boolean): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!ticking) {
      return;
    }
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [ticking]);
  return startedAt === null ? null : Math.max(0, now - startedAt);
}

/** Everything the window says about the task, read from whichever source it has. */
function describeSelection(selection: BackgroundTaskSelection) {
  if (selection.kind === 'summary') {
    const { task } = selection;
    return {
      taskType: task.taskType,
      taskId: task.taskId,
      status: 'running' as BackgroundTaskStatus,
      name: task.workflowName ?? task.description,
      description: task.description,
      summary: undefined as string | undefined,
      usage: undefined,
      startedAt: task.startedAt,
      command: undefined as string | undefined,
    };
  }

  const { message } = selection;
  const live = message.taskStatus;
  const input = parseToolPayload(message.toolInput) as { description?: unknown; command?: unknown } | null;
  const inputDescription = typeof input?.description === 'string' ? input.description : '';
  const taskType = live?.taskType
    ?? (message.toolName === 'Workflow' ? 'local_workflow' : message.toolName === 'Bash' ? 'local_bash' : 'local_agent');
  const startedAt = new Date(message.timestamp).getTime();
  return {
    taskType,
    taskId: readBackgroundTaskId(message),
    status: readBackgroundTaskStatus(message) ?? 'running',
    name: message.workflow?.name || live?.workflowName || message.subagent?.description || live?.description || inputDescription,
    description: message.workflow?.description || live?.description || message.subagent?.description || inputDescription,
    summary: live?.summary,
    usage: live?.usage,
    startedAt: Number.isFinite(startedAt) ? startedAt : null,
    command: typeof input?.command === 'string' ? input.command : undefined,
  };
}

const STATUS_CLASS: Record<BackgroundTaskStatus, string> = {
  running: 'bg-purple-500/10 text-purple-600 dark:text-purple-300',
  completed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
  failed: 'bg-destructive/10 text-destructive',
  stopped: 'bg-muted text-muted-foreground',
};

/**
 * Opened from a chip of the BackgroundTasksStrip: one background task in
 * detail — its status, time and spend up top, then what it is doing, live:
 * an agent's timeline, a command's output tail, a workflow's agents. The
 * timeline and output are re-read while the window is open and the task runs.
 */
export function BackgroundTaskDialog({
  selection,
  onClose,
  sessionId,
  sendMessage,
  onReveal,
  onLoadAll,
  createDiff,
  onFileOpen,
  selectedProject,
}: BackgroundTaskDialogProps) {
  const { t } = useTranslation();
  const details = selection ? describeSelection(selection) : null;
  const isRunning = details?.status === 'running';
  const elapsedMs = useElapsedMs(details?.startedAt ?? null, Boolean(selection) && isRunning);
  const durationMs = !isRunning && details?.usage ? details.usage.durationMs : elapsedMs;

  const kind = details?.taskType === 'local_workflow'
    ? t('workflow.title', 'Workflow')
    : details?.taskType === 'local_bash'
      ? t('workflow.backgroundCommand', 'Command')
      : t('workflow.backgroundAgent', 'Agent');
  const statusLabel = details ? t(`workflow.taskStatus.${details.status}`, details.status) : '';
  const stats = [
    durationMs !== null ? formatTaskDuration(durationMs) : '',
    details?.usage ? t('workflow.taskTokens', { count: details.usage.totalTokens, defaultValue: '{{count}} tokens' }) : '',
    details?.usage ? t('workflow.taskToolUses', { count: details.usage.toolUses, defaultValue_one: '{{count}} tool use', defaultValue_other: '{{count}} tool uses' }) : '',
  ].filter(Boolean);

  const renderBody = () => {
    if (!selection || !details) {
      return null;
    }
    if (details.taskType === 'local_bash') {
      return (
        <>
          {details.command && (
            <pre className="whitespace-pre-wrap break-words rounded-md bg-muted/40 px-2 py-1 font-mono text-[11px] text-muted-foreground">$ {details.command}</pre>
          )}
          {sessionId && details.taskId
            ? <CommandOutput sessionId={sessionId} taskId={details.taskId} isRunning={isRunning} />
            : <div className="text-xs text-muted-foreground/60">{t('workflow.taskOutputUnavailable', 'Output unavailable: {{reason}}', { reason: t('workflow.taskNotNamed', 'the task has no id yet') })}</div>}
        </>
      );
    }
    if (details.taskType === 'local_workflow') {
      if (selection.kind !== 'row') {
        return <div className="text-xs text-muted-foreground/60">{t('workflow.taskRowNotLoaded', 'Launched earlier in this conversation; click to load it')}</div>;
      }
      const { message } = selection;
      return (
        <WorkflowPanel
          toolInput={message.toolInput}
          toolResult={message.toolResult}
          workflow={message.workflow}
          taskStatus={message.taskStatus}
          createDiff={createDiff ?? (() => [])}
          onFileOpen={onFileOpen}
          selectedProject={selectedProject}
          defaultOpen
        />
      );
    }
    return sessionId && details.taskId
      ? (
        <AgentTimeline
          sessionId={sessionId}
          agentId={details.taskId}
          isRunning={isRunning}
          createDiff={createDiff}
          onFileOpen={onFileOpen}
          selectedProject={selectedProject}
        />
      )
      : <div className="text-xs text-muted-foreground/60">{t('workflow.agentTimelineEmpty', 'Nothing recorded yet')}</div>;
  };

  return (
    <Dialog open={Boolean(selection)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex h-[min(85dvh,44rem)] w-[calc(100vw-1rem)] max-w-3xl flex-col gap-3 overflow-hidden p-4 sm:w-[min(92vw,48rem)]">
        <DialogTitle>{[kind, details?.name].filter(Boolean).join(' · ')}</DialogTitle>
        {details && (
          <>
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-semibold text-foreground">{kind}</span>
                  {details.name && <span className="min-w-0 truncate text-foreground/80">{details.name}</span>}
                  <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${STATUS_CLASS[details.status]}`}>{statusLabel}</span>
                </div>
                {stats.length > 0 && (
                  <div className="mt-0.5 text-xs tabular-nums text-muted-foreground">{stats.join(' · ')}</div>
                )}
                {details.description && details.description !== details.name && (
                  <div className="mt-1 text-xs text-muted-foreground">{details.description}</div>
                )}
                {details.summary && details.summary !== details.description && details.summary !== details.name && (
                  <div className="mt-1 text-xs text-foreground/80">{details.summary}</div>
                )}
              </div>
              <div className="flex flex-shrink-0 items-center gap-1">
                {selection?.kind === 'row' ? (
                  <button
                    type="button"
                    onClick={() => {
                      onReveal(selection.message);
                      onClose();
                    }}
                    className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <ArrowUpRight className="h-3 w-3" />
                    {t('workflow.goToCard', 'Go to card')}
                  </button>
                ) : selection?.kind === 'summary' && !selection.task.nested ? (
                  <button
                    type="button"
                    onClick={onLoadAll}
                    className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    {t('workflow.loadConversation', 'Load conversation')}
                  </button>
                ) : null}
                {isRunning && sessionId && details.taskId && (
                  <button
                    type="button"
                    onClick={() => sendMessage({ type: 'chat.stop-task', sessionId, taskId: details.taskId })}
                    className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-destructive"
                  >
                    <Square className="h-2.5 w-2.5 fill-current" />
                    {t('workflow.stopTask', 'Stop')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  aria-label={t('workflow.closeTaskDetails', 'Close')}
                  className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">{renderBody()}</div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
