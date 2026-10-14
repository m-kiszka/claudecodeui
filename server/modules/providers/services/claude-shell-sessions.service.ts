import { normalizeProjectPath } from '@/shared/utils.js';

/**
 * Tracks which app session each Shell-tab Claude CLI belongs to, so a `/clear`
 * typed there continues that session instead of becoming a new one.
 *
 * The CLI writes the post-clear conversation to a brand-new transcript that
 * names no parent, so the only link back to the session is the terminal it was
 * typed in: the shell attaches each pty it starts with `claude --resume`, and
 * reports what the user types so a clear can be told apart when several
 * terminals share one project.
 */
type ShellAttachment = {
  sessionId: string;
  projectKey: string;
  /** What the user has typed since the last Enter, for spotting `/clear`. */
  pendingLine: string;
  clearTypedAt: number | null;
};

/** The CLI's own names for clearing the conversation. */
const CLEAR_COMMANDS = new Set(['/clear', '/reset', '/new']);
/** How long a typed clear may wait for its transcript to appear on disk. */
const CLEAR_MATCH_WINDOW_MS = 2 * 60 * 1000;
const MAX_PENDING_LINE_LENGTH = 512;
// Escape sequences arrow keys, focus reports and bracketed paste send through
// the same input stream; they are never part of a typed command.
const TERMINAL_ESCAPE_SEQUENCE = /\x1b(\[[0-9;?]*[ -/]*[@-~]|O.|.)/g;

const attachments = new Map<string, ShellAttachment>();

function toProjectKey(projectPath: string): string {
  const normalized = normalizeProjectPath(projectPath);
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

// claudeShellSessions: used by the websocket module's shell service to attach
// its Claude ptys, and by the Claude session synchronizer to find the session a
// post-clear transcript continues.
export const claudeShellSessions = {
  attach(ptyKey: string, sessionId: string, projectPath: string): void {
    attachments.set(ptyKey, {
      sessionId,
      projectKey: toProjectKey(projectPath),
      pendingLine: '',
      clearTypedAt: null,
    });
  },

  detach(ptyKey: string): void {
    attachments.delete(ptyKey);
  },

  /** Follows keystrokes line by line and notes when a clear command is entered. */
  recordInput(ptyKey: string, data: string): void {
    const attachment = attachments.get(ptyKey);
    if (!attachment) {
      return;
    }

    for (const char of data.replace(TERMINAL_ESCAPE_SEQUENCE, '')) {
      if (char === '\r' || char === '\n') {
        if (CLEAR_COMMANDS.has(attachment.pendingLine.trim().split(/\s+/)[0] ?? '')) {
          attachment.clearTypedAt = Date.now();
        }
        attachment.pendingLine = '';
      } else if (char === '\x7f' || char === '\b') {
        attachment.pendingLine = attachment.pendingLine.slice(0, -1);
      } else if (char === '\x03' || char === '\x15') {
        // Ctrl+C and Ctrl+U throw the line away.
        attachment.pendingLine = '';
      } else if (char >= ' ') {
        attachment.pendingLine = `${attachment.pendingLine}${char}`.slice(-MAX_PENDING_LINE_LENGTH);
      }
    }
  },

  /**
   * The app session a freshly cleared transcript in this project continues,
   * or null when that cannot be told.
   *
   * Only a terminal where a clear was just typed qualifies, the latest one
   * first. A clear run in a terminal outside the app also starts a transcript
   * with `/clear`; grafting that onto an open Shell tab's session would merge
   * two unrelated conversations, so it stays a session of its own.
   */
  claimClearedSession(projectPath: string): string | null {
    const projectKey = toProjectKey(projectPath);
    const now = Date.now();
    const [claimed] = [...attachments.values()]
      .filter((attachment) => attachment.projectKey === projectKey
        && attachment.clearTypedAt !== null
        && now - attachment.clearTypedAt <= CLEAR_MATCH_WINDOW_MS)
      .sort((a, b) => (b.clearTypedAt ?? 0) - (a.clearTypedAt ?? 0));

    if (!claimed) {
      return null;
    }

    claimed.clearTypedAt = null;
    return claimed.sessionId;
  },
};
