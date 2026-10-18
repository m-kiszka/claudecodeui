import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { closeConnection, initializeDatabase, sessionsDb } from '@/modules/database/index.js';
import { remoteControlService } from '@/modules/providers/services/remote-control.service.js';

test('remote control reads as on only while a live process of the conversation carries a bridge id', { concurrency: false }, async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'claude-remote-control-'));
  const previousConfigDir = process.env.CLAUDE_CONFIG_DIR;
  const previousDatabasePath = process.env.DATABASE_PATH;
  process.env.CLAUDE_CONFIG_DIR = tempRoot;
  process.env.DATABASE_PATH = path.join(tempRoot, 'auth.db');

  try {
    closeConnection();
    await initializeDatabase();
    const now = new Date().toISOString();
    const providerSessionId = 'c0ffee00-0000-4000-8000-000000000001';
    sessionsDb.createSession(providerSessionId, 'claude', tempRoot, 'RC session', now, now, path.join(tempRoot, `${providerSessionId}.jsonl`));
    const registry = path.join(tempRoot, 'sessions');
    await mkdir(registry, { recursive: true });

    // This test's own process stands in for a live CLI.
    const live = { pid: process.pid, sessionId: providerSessionId, entrypoint: 'cli', status: 'idle' };
    await writeFile(path.join(registry, `${process.pid}.json`), JSON.stringify(live), 'utf8');
    assert.deepEqual(await remoteControlService.readState(providerSessionId), { enabled: false, shellOpen: false, shellBusy: false });

    await writeFile(path.join(registry, `${process.pid}.json`), JSON.stringify({ ...live, bridgeSessionId: 'session_01abc' }), 'utf8');
    assert.equal((await remoteControlService.readState(providerSessionId)).enabled, true);

    // A registry file whose process is gone says nothing.
    await writeFile(path.join(registry, `${process.pid}.json`), JSON.stringify(live), 'utf8');
    await writeFile(path.join(registry, '999999.json'), JSON.stringify({ ...live, pid: 999999, bridgeSessionId: 'session_stale' }), 'utf8');
    assert.equal((await remoteControlService.readState(providerSessionId)).enabled, false);

    // Toggling needs the Shell-tab CLI.
    await assert.rejects(remoteControlService.setEnabled(providerSessionId, true), /Shell tab/);
  } finally {
    closeConnection();
    if (previousConfigDir === undefined) delete process.env.CLAUDE_CONFIG_DIR; else process.env.CLAUDE_CONFIG_DIR = previousConfigDir;
    if (previousDatabasePath === undefined) delete process.env.DATABASE_PATH; else process.env.DATABASE_PATH = previousDatabasePath;
    await rm(tempRoot, { recursive: true, force: true });
  }
});
