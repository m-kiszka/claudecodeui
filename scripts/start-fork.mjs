#!/usr/bin/env node
// Starts this fork on port 3001 for start-cloudcli.cmd: rebuilds the client or
// the server only when the content of their sources changed since the last
// build, then serves the app and opens it in the default browser once it answers.
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = 3001;
const APP_URL = `http://localhost:${PORT}`;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);

/**
 * Fingerprint of the sources under `paths`, from their content rather than
 * their modification times: git hooks, checkouts and merges rewrite files
 * without changing them, which used to trigger a rebuild after every commit.
 * Covers committed, staged, unstaged and untracked content alike.
 */
function sourceFingerprint(paths) {
  const pathspec = ['--', ...paths, ':(exclude,glob)**/tests/**'];
  const git = (...args) => {
    const result = spawnSync('git', [...args, ...pathspec], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
    if (result.status !== 0) throw new Error(result.stderr || `git ${args[0]} failed`);
    return result.stdout;
  };
  const hash = createHash('sha1');
  hash.update(git('ls-files', '-s'));
  hash.update(git('diff'));
  for (const file of git('ls-files', '--others', '--exclude-standard').split('\n').filter(Boolean)) {
    hash.update(file);
    hash.update(fs.readFileSync(file));
  }
  return hash.digest('hex');
}

function readStamp(file) {
  try {
    return fs.readFileSync(file, 'utf8').trim();
  } catch {
    return null;
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

/** Builds one part only when its sources differ from what its last build saw. */
function buildIfChanged({ name, script, inputs, entry, stampFile }) {
  let fingerprint = null;
  try {
    fingerprint = sourceFingerprint(inputs);
  } catch (error) {
    console.warn(`Could not fingerprint the ${name} sources, rebuilding it: ${error.message}`);
  }
  if (fingerprint && fs.existsSync(entry) && readStamp(stampFile) === fingerprint) {
    console.log(`${name} is up to date, skipping its build.`);
    return;
  }
  run(script);
  // Written after the build, which replaces the output directory.
  if (fingerprint) fs.writeFileSync(stampFile, `${fingerprint}\n`);
}

const sharedInputs = ['shared', 'package.json', 'package-lock.json'];
buildIfChanged({
  name: 'Client',
  script: 'build:client',
  inputs: ['src', 'public', 'index.html', 'vite.config.js', ...sharedInputs],
  entry: 'dist/index.html',
  stampFile: 'dist/.fork-build-stamp',
});
buildIfChanged({
  name: 'Server',
  script: 'build:server',
  inputs: ['server', ...sharedInputs],
  entry: 'dist-server/server/index.js',
  stampFile: 'dist-server/.fork-build-stamp',
});

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
