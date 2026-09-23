import { spawn, execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';
import { config } from 'dotenv';
import pg from 'pg';
import { workspaceRoot } from './contracts.mjs';

const execute = promisify(execFile);

export function guardedTestUrl(service: 'core' | 'products', value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('A valid dedicated local test URL is required');
  }
  const name = `holita_${service}_test`;
  if (
    !['postgresql:', 'postgres:'].includes(url.protocol) ||
    !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
    url.pathname !== `/${name}` ||
    url.username !== name ||
    !url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(`Use only the dedicated local ${name} database and role without URL options`);
  }
  return url;
}

async function prepareDatabase(service: 'core' | 'products') {
  const name = `holita_${service}_test`;
  const url = guardedTestUrl(
    service,
    process.env[`${service.toUpperCase()}_TEST_DATABASE_URL`] ??
      `postgresql://${name}:${name}_local@127.0.0.1:11084/${name}`,
  );
  const schema = `test_${randomUUID().replaceAll('-', '')}`;
  const connection = new pg.Client({
    connectionString: url.toString(),
    connectionTimeoutMillis: 5000,
  });
  let created = false;
  async function close() {
    try {
      if (created) {
        await connection.query(`DROP SCHEMA ${pg.escapeIdentifier(schema)} CASCADE`);
        created = false;
      }
    } finally {
      await connection.end();
    }
  }
  try {
    await connection.connect();
    await connection.query(`CREATE SCHEMA ${pg.escapeIdentifier(schema)}`);
    created = true;
    url.searchParams.set('schema', schema);
    const env = { ...process.env, [`${service.toUpperCase()}_DATABASE_URL`]: url.toString() };
    const cwd = join(workspaceRoot, 'apps', service);
    await execute(
      process.execPath,
      [join(workspaceRoot, 'node_modules/prisma/build/index.js'), 'migrate', 'deploy'],
      { cwd, env, timeout: 30000 },
    );
    await execute(process.execPath, ['--import', 'tsx', 'prisma/seed.ts'], {
      cwd,
      env,
      timeout: 15000,
    });
    return { url: url.toString(), close };
  } catch (error) {
    await close();
    throw error;
  }
}

export async function availablePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing ephemeral port');
  const port = address.port;
  await new Promise<void>((resolve, reject) =>
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    }),
  );
  return port;
}

async function startApplication(service: string, env: NodeJS.ProcessEnv, selectedPort?: number) {
  const port = selectedPort ?? (await availablePort());
  const child = spawn(process.execPath, ['dist/main.js'], {
    cwd: join(workspaceRoot, 'apps', service),
    env: { ...process.env, ...env, PORT: String(port), NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  child.stdout.on('data', (chunk: Buffer) => {
    logs = (logs + chunk.toString()).slice(-12000);
  });
  child.stderr.on('data', (chunk: Buffer) => {
    logs = (logs + chunk.toString()).slice(-12000);
  });
  let finished = false;
  const exited = new Promise<void>((resolve) => {
    child.once('exit', () => {
      finished = true;
      resolve();
    });
    child.once('error', () => {
      finished = true;
      resolve();
    });
  });
  async function stop() {
    if (finished) return;
    child.kill('SIGTERM');
    const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
    try {
      await exited;
    } finally {
      clearTimeout(timer);
    }
  }
  const baseUrl = `http://127.0.0.1:${String(port)}`;
  const deadline = Date.now() + 15000;
  while (child.exitCode === null && child.signalCode === null && Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(300) });
      const health: unknown = await response.json();
      if (
        response.ok &&
        typeof health === 'object' &&
        health !== null &&
        'service' in health &&
        health.service === service
      )
        return { port, url: `${baseUrl}/graphql`, stop };
    } catch {
      /* The child has not started listening yet. */
    }
    await delay(100);
  }
  await stop();
  throw new Error(`${service} did not start:\n${logs}`);
}

async function observeRequests(target: string) {
  const requests: {
    requestId: string | string[] | undefined;
    storeId: string | string[] | undefined;
    body: string;
  }[] = [];
  async function forward(req: IncomingMessage, res: ServerResponse) {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      if (Buffer.isBuffer(chunk)) chunks.push(chunk);
      else if (typeof chunk === 'string') chunks.push(Buffer.from(chunk));
      else throw new Error('Unexpected HTTP chunk');
    }
    const body = Buffer.concat(chunks).toString();
    requests.push({
      requestId: req.headers['x-request-id'],
      storeId: req.headers['x-store-id'],
      body,
    });
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    for (const key of ['x-request-id', 'x-store-id']) {
      const value = req.headers[key];
      if (typeof value === 'string') headers[key] = value;
    }
    const response = await fetch(target, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(5000),
    });
    res.writeHead(response.status, { 'content-type': 'application/json' });
    res.end(await response.text());
  }
  const server = createServer((req, res) => {
    void forward(req, res).catch(() => {
      res.writeHead(503, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ errors: [{ message: 'Test upstream stopped' }] }));
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing observer port');
  return {
    url: `http://127.0.0.1:${String(address.port)}/graphql`,
    requests,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
        server.closeAllConnections();
      }),
  };
}

export async function createFederationFixture(options: { adminOrigin?: string } = {}) {
  config({
    path: [join(workspaceRoot, 'apps/core/.env'), join(workspaceRoot, 'apps/products/.env')],
    quiet: true,
  });
  const cleanup: (() => Promise<void>)[] = [];
  async function close() {
    const errors: unknown[] = [];
    for (const action of cleanup.reverse()) {
      try {
        await action();
      } catch (error) {
        errors.push(error);
      }
    }
    cleanup.length = 0;
    if (errors.length) throw new AggregateError(errors, 'Federation fixture cleanup failed');
  }
  try {
    const coreDatabase = await prepareDatabase('core');
    cleanup.push(coreDatabase.close);
    const productsDatabase = await prepareDatabase('products');
    cleanup.push(productsDatabase.close);
    let core = await startApplication('core', { CORE_DATABASE_URL: coreDatabase.url });
    cleanup.push(() => core.stop());
    const coreObserver = await observeRequests(core.url);
    cleanup.push(coreObserver.close);
    const products = await startApplication('products', {
      PRODUCTS_DATABASE_URL: productsDatabase.url,
      CORE_GRAPHQL_URL: coreObserver.url,
    });
    cleanup.push(products.stop);
    const productsObserver = await observeRequests(products.url);
    cleanup.push(productsObserver.close);
    const gateway = await startApplication('gateway', {
      ADMIN_ORIGIN: options.adminOrigin ?? 'http://127.0.0.1:11081',
      CORE_GRAPHQL_URL: coreObserver.url,
      PRODUCTS_GRAPHQL_URL: productsObserver.url,
    });
    cleanup.push(gateway.stop);
    return {
      url: gateway.url,
      productsUrl: products.url,
      coreRequests: coreObserver.requests,
      productRequests: productsObserver.requests,
      stopCore: () => core.stop(),
      restartCore: async () => {
        core = await startApplication('core', { CORE_DATABASE_URL: coreDatabase.url }, core.port);
      },
      close,
    };
  } catch (error) {
    await close();
    throw error;
  }
}
