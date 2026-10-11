#!/usr/bin/env node
// Starts this fork on port 3001 for start-cloudcli.cmd: rebuilds the client or
// the server only when their sources changed since the last build, then serves
// the app and opens it in the default browser once it answers.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = 3001;
const APP_URL = `http://localhost:${PORT}`;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);

const IGNORED_DIRS = new Set(['node_modules', 'tests', '.git']);

/** Newest modification time of any file under the given paths. */
function newestMtime(paths) {
  let newest = 0;
  const visit = (target) => {
    let stat;
    try {
      stat = fs.statSync(target);
    } catch {
      return;
    }
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(target)) {
        if (!IGNORED_DIRS.has(entry)) visit(path.join(target, entry));
      }
    } else {
      newest = Math.max(newest, stat.mtimeMs);
    }
  };
  paths.forEach(visit);
  return newest;
}

function builtAt(file) {
  try {
    return fs.statSync(file).mtimeMs;
  } catch {
    return 0;
  }
}

function run(script) {
  console.log(`\n> npm run ${script}`);
  const result = spawnSync('npm', ['run', script], { stdio: 'inherit', shell: true });
  if (result.status !== 0) {
    console.error(`\n"npm run ${script}" failed.`);
    process.exit(result.status ?? 1);
  }
}

const sharedInputs = ['shared', 'package.json', 'package-lock.json'];
if (newestMtime(['src', 'public', 'index.html', 'vite.config.js', ...sharedInputs]) > builtAt('dist/index.html')) {
  run('build:client');
} else {
  console.log('Client is up to date, skipping its build.');
}
if (newestMtime(['server', ...sharedInputs]) > builtAt('dist-server/server/index.js')) {
  run('build:server');
} else {
  console.log('Server is up to date, skipping its build.');
}

const server = spawn('npm', ['run', 'server'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, SERVER_PORT: String(PORT) },
});
server.on('exit', (code) => process.exit(code ?? 0));

// Opens the browser once the server answers, giving up after a minute.
const startedAt = Date.now();
const waitAndOpen = () => {
  http.get(APP_URL, (response) => {
    response.resume();
    spawn('cmd', ['/c', 'start', '""', APP_URL], { stdio: 'ignore', detached: true }).unref();
  }).on('error', () => {
    if (Date.now() - startedAt < 60_000) setTimeout(waitAndOpen, 500);
  });
};
waitAndOpen();
