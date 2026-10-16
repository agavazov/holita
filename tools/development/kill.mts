import { readdirSync, readFileSync, readlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

if (process.platform !== 'linux') {
  throw new Error('npm run kill requires Linux (Ubuntu/WSL).');
}

const root = fileURLToPath(new URL('../../', import.meta.url)).replace(/\/$/, '');
const routerBinary = resolve(root, 'apps/gateway/router/dist/router');
const appDirectories = ['admin', 'gateway', 'core', 'fleet', 'karma-client'].map((app) =>
  resolve(root, 'apps', app),
);
const backendEntries = ['core', 'fleet', 'karma-client'].flatMap((app) => [
  resolve(root, 'apps', app, 'dist/main'),
  resolve(root, 'apps', app, 'dist/main.js'),
]);
const processes: { pid: number; parent: number; service: boolean }[] = [];

for (const entry of readdirSync('/proc')) {
  if (!/^\d+$/.test(entry)) continue;
  const pid = Number(entry);
  if (pid === process.pid) continue;
  try {
    const directory = readlinkSync(`/proc/${entry}/cwd`);
    const args = readFileSync(`/proc/${entry}/cmdline`, 'utf8').split('\0');
    const status = readFileSync(`/proc/${entry}/status`, 'utf8');
    const parent = Number(/^PPid:\s+(\d+)$/m.exec(status)?.[1]);
    const workspace = directory === root || appDirectories.includes(directory);
    const watcher =
      args.includes(resolve(root, 'node_modules/.bin/nest')) &&
      args.includes('start') &&
      args.includes('--watch');
    const group =
      args.includes(resolve(root, 'node_modules/.bin/concurrently')) &&
      args.includes('gateway,core,fleet,karma-client,admin');
    const admin =
      directory === appDirectories[0] &&
      (args.some((arg) => arg.startsWith('ng serve')) ||
        (args.includes(resolve(root, 'node_modules/.bin/ng')) && args.includes('serve')));
    const backend = args.slice(1).some((arg) => backendEntries.includes(resolve(directory, arg)));
    const router = readlinkSync(`/proc/${entry}/exe`) === routerBinary;
    processes.push({
      pid,
      parent,
      service: workspace && (watcher || group || admin || backend || router),
    });
  } catch (error) {
    // Processes may exit during discovery; inaccessible processes belong to another user.
    if (
      !(error instanceof Error) ||
      !('code' in error) ||
      !['ENOENT', 'ESRCH', 'EACCES', 'EPERM'].includes(String(error.code))
    )
      throw error;
  }
}

const targets = new Set(processes.filter((entry) => entry.service).map((entry) => entry.pid));
// Include child shells and workers; stop watchers together with their servers.
let previousSize = -1;
while (previousSize !== targets.size) {
  previousSize = targets.size;
  for (const entry of processes) {
    if (targets.has(entry.parent)) targets.add(entry.pid);
  }
}

function signal(pid: number, value: NodeJS.Signals | 0): boolean {
  try {
    process.kill(pid, value);
    return true;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ESRCH') return false;
    throw error;
  }
}

if (targets.size === 0) {
  console.log('No running holita applications found.');
} else {
  for (const pid of targets) signal(pid, 'SIGTERM');
  for (let attempt = 0; attempt < 20; attempt++) {
    await setTimeout(100);
    for (const pid of targets) {
      if (!signal(pid, 0)) targets.delete(pid);
    }
    if (targets.size === 0) break;
  }
  for (const pid of targets) signal(pid, 'SIGKILL');
  console.log('Stopped holita applications and their watchers. PostgreSQL remains running.');
}
