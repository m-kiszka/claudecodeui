import { readdir, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { sessionsDb } from '@/modules/database/index.js';
import { hasClaudeShell, writeToClaudeShell } from '@/modules/websocket/index.js';
import { AppError } from '@/shared/utils.js';

/** Where a Claude Remote Control session stands for one app session. */
export type RemoteControlState = {
  /** A live CLI process of this conversation is bridged to claude.ai. */
  enabled: boolean;
  /** A Shell-tab CLI is open for this session, the only place the bridge can be toggled. */
  shellOpen: boolean;
  /** That CLI is mid-turn, so a typed command would land in its input instead of running. */
  shellBusy: boolean;
};

/** How long a toggle waits for the CLI to report the bridge's new state. */
const TOGGLE_CONFIRM_TIMEOUT_MS = 8_000;
const TOGGLE_CONFIRM_POLL_MS = 400;

type ClaudeProcessRecord = {
  pid?: unknown;
  sessionId?: unknown;
  entrypoint?: unknown;
  status?: unknown;
  bridgeSessionId?: unknown;
};

const claudeConfigDir = (): string => process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM: alive, owned by someone else.
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

/**
 * The live Claude processes of one conversation, from the registry the CLI
 * keeps in `<config>/sessions/<pid>.json`. A file can outlive its process, so
 * each pid is checked. Undocumented CLI state: a missing or unreadable
 * registry reads as no processes.
 */
async function readConversationProcesses(providerSessionId: string): Promise<ClaudeProcessRecord[]> {
  const dir = path.join(claudeConfigDir(), 'sessions');
  let names: string[];
  try {
    names = (await readdir(dir)).filter((name) => name.endsWith('.json'));
  } catch {
    return [];
  }

  const records: ClaudeProcessRecord[] = [];
  for (const name of names) {
    try {
      const record = JSON.parse(await readFile(path.join(dir, name), 'utf8')) as ClaudeProcessRecord;
      if (record.sessionId === providerSessionId && typeof record.pid === 'number' && isProcessAlive(record.pid)) {
        records.push(record);
      }
    } catch {
      // Written while read, or not a registry entry.
    }
  }
  return records;
}

function requireSession(sessionId: string) {
  const session = sessionsDb.getSessionById(sessionId);
  if (!session) {
    throw new AppError(`Session "${sessionId}" was not found.`, { code: 'SESSION_NOT_FOUND', statusCode: 404 });
  }
  return session;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const remoteControlService = {
  /**
   * Reads whether the conversation is bridged to Remote Control. The CLI
   * marks a bridged process with `bridgeSessionId` in its registry entry and
   * drops the field when the bridge is turned off.
   */
  async readState(sessionId: string): Promise<RemoteControlState> {
    const session = requireSession(sessionId);
    const shellOpen = hasClaudeShell(sessionId);
    if (session.provider !== 'claude' || !session.provider_session_id) {
      return { enabled: false, shellOpen, shellBusy: false };
    }

    const processes = await readConversationProcesses(session.provider_session_id);
    const shellCli = processes.find((record) => record.entrypoint === 'cli');
    return {
      enabled: processes.some((record) => typeof record.bridgeSessionId === 'string' && record.bridgeSessionId),
      shellOpen,
      shellBusy: shellOpen && shellCli?.status === 'busy',
    };
  },

  /**
   * Turns the bridge on or off by typing `/remote-control` (a toggle) into
   * the session's Shell-tab CLI, then waits for the registry to confirm. The
   * chat's own SDK process lives for one turn, so it cannot hold a bridge.
   */
  async setEnabled(sessionId: string, enabled: boolean): Promise<RemoteControlState> {
    const current = await this.readState(sessionId);
    if (current.enabled === enabled) {
      return current;
    }
    if (!current.shellOpen) {
      throw new AppError('Open this session in the Shell tab to toggle Remote Control.', {
        code: 'SHELL_NOT_OPEN',
        statusCode: 409,
      });
    }
    if (current.shellBusy) {
      throw new AppError('The Shell-tab Claude is responding; try again once it is idle.', {
        code: 'SHELL_BUSY',
        statusCode: 409,
      });
    }

    writeToClaudeShell(sessionId, '/remote-control');

    const deadline = Date.now() + TOGGLE_CONFIRM_TIMEOUT_MS;
    let state = current;
    while (Date.now() < deadline) {
      await sleep(TOGGLE_CONFIRM_POLL_MS);
      state = await this.readState(sessionId);
      if (state.enabled === enabled) {
        return state;
      }
    }
    return state;
  },
};
