import { spawn, execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';
import { config } from 'dotenv';
import { createKarmaFixture } from './karma-fixture.mjs';
import pg from 'pg';
import { workspaceRoot } from './contracts.mjs';

const execute = promisify(execFile);

export function guardedTestUrl(service: 'core' | 'fleet', value: string): URL {
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

async function prepareDatabase(service: 'core' | 'fleet') {
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
    const databaseUrl = url.toString();
    url.searchParams.set('schema', schema);
    const env = { ...process.env, [`${service.toUpperCase()}_DATABASE_URL`]: url.toString() };
    const cwd = join(workspaceRoot, 'apps', service);
    await execute(
      process.execPath,
      [join(workspaceRoot, 'node_modules/prisma/build/index.js'), 'migrate', 'deploy'],
      { cwd, env, timeout: 30000 },
    );
    if (service === 'core') {
      await execute(process.execPath, ['--import', 'tsx', 'prisma/seed.ts'], {
        cwd,
        env,
        timeout: 15000,
      });
    }
    return { url: url.toString(), databaseUrl, schema, close };
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
  if (!address || typeof address === 'string') {
    throw new Error('Missing ephemeral port');
  }
  const port = address.port;
  await new Promise<void>((resolve, reject) =>
    server.close((error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    }),
  );
  return port;
}

async function seedDeviceParameterCatalog(databaseUrl: string, schemaName: string) {
  const connection = new pg.Client({ connectionString: databaseUrl });
  await connection.connect();
  const schema = pg.escapeIdentifier(schemaName);
  const id = randomUUID();
  try {
    await connection.query('BEGIN');
    await connection.query(
      `INSERT INTO ${schema}."EdataCatalog"
       ("id", "sourceSha256", "extractorVersion", "schemaVersion", "packageLabel", "contentSha256", "metadata")
       VALUES ($1, $2, '1.0.0', 1, 'Monitor 9.56 fixture', $3, '{}')`,
      [id, '01dd13e50c55fdf84078ce298bde72320d55bee458baa4c0d2a06fca7c0ca1a0', '0'.repeat(64)],
    );
    await connection.query(
      `INSERT INTO ${schema}."EdataCatalogSource" ("catalogId", "key", "kind", "evidence")
       VALUES ($1, 'monitor', 'monitor', '{}')`,
      [id],
    );
    await connection.query(
      `INSERT INTO ${schema}."EdataCatalogParameter"
       ("catalogId", "key", "sourceKey", "parameterId", "category", "name", "details")
       VALUES ($1, 'monitor:0', 'monitor', 781, '3', 'Battery Voltage (Starlink)', '{"issues":[]}')`,
      [id],
    );
    await connection.query(
      `INSERT INTO ${schema}."EdataCatalogCategory" ("catalogId", "vendorId", "name")
       VALUES ($1, 3, 'FMS fixture')`,
      [id],
    );
    await connection.query(
      `INSERT INTO ${schema}."EdataCatalogSet" ("catalogId", "vendorId", "details")
       VALUES ($1, 135, '{}')`,
      [id],
    );
    await connection.query(
      `INSERT INTO ${schema}."EdataCatalogSetMember" ("catalogId", "setId", "position", "parameterId")
       VALUES ($1, 135, 0, 781)`,
      [id],
    );
    await connection.query(
      `INSERT INTO ${schema}."EdataCatalogProfile" ("catalogId", "vendorId", "setId", "categoryId", "name")
       VALUES ($1, 343, 135, 3, 'FMS Parameters (250k)')`,
      [id],
    );
    await connection.query('COMMIT');
  } catch (error) {
    await connection.query('ROLLBACK');
    throw error;
  } finally {
    await connection.end();
  }
}

export async function startRouter(options: {
  adminOrigin: string;
  subgraphUrls: { core: string; fleet: string; 'karma-client': string };
}) {
  const cwd = join(workspaceRoot, 'apps/gateway');
  const binary = join(cwd, 'router/dist/router');
  const version = await execute(binary, ['--version']);
  if (version.stdout.trim() !== '2.18.0') {
    throw new Error('Install Apollo Router 2.18.0 with npm run router:install.');
  }
  const port = await availablePort();
  let healthPort = await availablePort();
  while (healthPort === port) {
    healthPort = await availablePort();
  }
  const url = `http://127.0.0.1:${String(port)}/graphql`;
  const healthUrl = `http://127.0.0.1:${String(healthPort)}/health`;
  const child = spawn(
    binary,
    [
      '--anonymous-telemetry-disabled',
      '--config',
      'router/router.yaml',
      '--supergraph',
      'src/generated/graphql/supergraph.graphql',
    ],
    {
      cwd,
      env: {
        PATH: process.env.PATH,
        ROUTER_PORT: String(port),
        ROUTER_HEALTH_PORT: String(healthPort),
        CORE_GRAPHQL_URL: options.subgraphUrls.core,
        FLEET_GRAPHQL_URL: options.subgraphUrls.fleet,
        KARMA_CLIENT_GRAPHQL_URL: options.subgraphUrls['karma-client'],
        ADMIN_ORIGIN: options.adminOrigin,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  let logs = '';
  for (const stream of [child.stdout, child.stderr]) {
    stream.on('data', (chunk: Buffer) => {
      logs = (logs + chunk.toString()).slice(-12000);
    });
  }
  let finished = false;
  const exited = new Promise<void>((resolve) => {
    child.once('exit', () => {
      finished = true;
      resolve();
    });
    child.once('error', (error) => {
      logs += error.message;
      finished = true;
      resolve();
    });
  });
  async function stop() {
    if (finished) {
      return;
    }
    child.kill('SIGTERM');
    const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
    try {
      await exited;
    } finally {
      clearTimeout(timer);
    }
  }
  const deadline = Date.now() + 15000;
  while (child.exitCode === null && child.signalCode === null && Date.now() < deadline) {
    try {
      const response = await fetch(healthUrl, { signal: AbortSignal.timeout(300) });
      const health: unknown = await response.json();
      if (
        response.ok &&
        typeof health === 'object' &&
        health !== null &&
        'status' in health &&
        health.status === 'UP'
      ) {
        return { url, healthUrl, pid: child.pid, stop, logs: () => logs };
      }
    } catch {
      /* Wait for the Router's dedicated health listener. */
    }
    await delay(100);
  }
  await stop();
  throw new Error(`Apollo Router did not start:\n${logs}`);
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
    if (finished) {
      return;
    }
    child.kill('SIGTERM');
    const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
    try {
      await exited;
    } finally {
      clearTimeout(timer);
    }
  }
  const baseUrl = `http://127.0.0.1:${String(port)}`;
  const deadline = Date.now() + 30000;
  while (child.exitCode === null && child.signalCode === null && Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/health`, {
        signal: AbortSignal.timeout(Math.max(1, Math.min(1000, deadline - Date.now()))),
      });
      const health: unknown = await response.json();
      if (
        response.ok &&
        typeof health === 'object' &&
        health !== null &&
        'service' in health &&
        health.service === service
      ) {
        return {
          port,
          pid: child.pid,
          logs: () => logs,
          url: `${baseUrl}/graphql`,
          stop,
          pause: () => {
            if (!child.kill('SIGSTOP')) {
              throw new Error(`Could not pause ${service}`);
            }
          },
          resume: () => {
            if (!child.kill('SIGCONT')) {
              throw new Error(`Could not resume ${service}`);
            }
          },
        };
      }
    } catch {
      /* The child has not started listening yet. */
    }
    await delay(100);
  }
  await stop();
  throw new Error(`${service} did not start:\n${logs}`);
}

async function observeRequests(target: string) {
  let injectedResponse: { status: number; body: string } | undefined;
  const requests: {
    requestId: string | string[] | undefined;
    branchId: string | string[] | undefined;
    body: string;
  }[] = [];
  async function forward(req: IncomingMessage, res: ServerResponse) {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      if (Buffer.isBuffer(chunk)) {
        chunks.push(chunk);
      } else if (typeof chunk === 'string') {
        chunks.push(Buffer.from(chunk));
      } else {
        throw new Error('Unexpected HTTP chunk');
      }
    }
    const body = Buffer.concat(chunks).toString();
    requests.push({
      requestId: req.headers['x-request-id'],
      branchId: req.headers['x-branch-id'],
      body,
    });
    if (injectedResponse) {
      res.writeHead(injectedResponse.status, { 'content-type': 'application/json' });
      res.end(injectedResponse.body);
      return;
    }
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    for (const key of ['x-request-id', 'x-branch-id', 'authorization']) {
      const value = req.headers[key];
      if (typeof value === 'string') {
        headers[key] = value;
      }
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
  if (!address || typeof address === 'string') {
    throw new Error('Missing observer port');
  }
  return {
    url: `http://127.0.0.1:${String(address.port)}/graphql`,
    requests,
    setResponse: (response: typeof injectedResponse) => {
      injectedResponse = response;
    },
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
        server.closeAllConnections();
      }),
  };
}

export async function createFederationFixture(
  options: {
    adminOrigin?: string;
    fleetEnabled?: boolean;
    observeSubgraphs?: boolean;
    deviceOperations?: boolean;
    deviceConfigurationWrites?: boolean;
  } = {},
) {
  config({
    path: [join(workspaceRoot, 'apps/core/.env'), join(workspaceRoot, 'apps/fleet/.env')],
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
    if (errors.length) {
      throw new AggregateError(errors, 'Federation fixture cleanup failed');
    }
  }
  try {
    const coreDatabase = await prepareDatabase('core');
    cleanup.push(coreDatabase.close);
    const tenantConnection = new pg.Client({ connectionString: coreDatabase.url });
    await tenantConnection.connect();
    try {
      const schema = pg.escapeIdentifier(coreDatabase.schema);
      await tenantConnection.query(
        `INSERT INTO ${schema}."Tenant" ("id", "name", "updatedAt") VALUES ($1, $2, CURRENT_TIMESTAMP)`,
        ['01000000-0000-4000-8000-000000000002', 'Isolation tenant'],
      );
      await tenantConnection.query(
        `INSERT INTO ${schema}."Branch" ("id", "tenantId", "name", "updatedAt") VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
        [
          '10000000-0000-4000-8000-000000000003',
          '01000000-0000-4000-8000-000000000002',
          'Isolation branch',
        ],
      );
    } finally {
      await tenantConnection.end();
    }

    const fleetDatabase = await prepareDatabase('fleet');
    cleanup.push(fleetDatabase.close);
    if (options.deviceConfigurationWrites) {
      await seedDeviceParameterCatalog(fleetDatabase.databaseUrl, fleetDatabase.schema);
    }
    let core = await startApplication('core', { CORE_DATABASE_URL: coreDatabase.url });
    cleanup.push(() => core.stop());
    const coreObserver = await observeRequests(core.url);
    cleanup.push(coreObserver.close);
    const coreUrl = options.observeSubgraphs === false ? core.url : coreObserver.url;
    const internalToken = 'holita-fixture-device-configuration-token';
    const karma = await createKarmaFixture();
    cleanup.push(karma.close);
    const karmaClient = await startApplication('karma-client', {
      KARMA_API_URL: karma.url,
      KARMA_USER: 'fixture-user',
      KARMA_PASSWORD: 'fixture-password',
      KARMA_INTERNAL_TOKEN: internalToken,
    });
    cleanup.push(karmaClient.stop);
    const fleetEnv = {
      ADMIN_ORIGINS: options.adminOrigin ?? 'http://127.0.0.1:11000',
      ADMIN_ORIGIN: options.adminOrigin ?? 'http://127.0.0.1:11000',
      FLEET_DATABASE_URL: fleetDatabase.url,
      CORE_GRAPHQL_URL: coreUrl,
      FLEET_ENABLED: String(options.fleetEnabled ?? true),
      FLEET_DEVICE_OPERATIONS_ENABLED: String(
        options.deviceOperations ?? options.deviceConfigurationWrites ?? false,
      ),
      FLEET_DEVICE_CONFIGURATION_WRITES_ENABLED: String(options.deviceConfigurationWrites ?? false),
      FLEET_KARMA_INTERNAL_URL: new URL(karmaClient.url).origin,
      KARMA_INTERNAL_TOKEN: internalToken,
    };
    const fleetPort = await availablePort();
    let fleet = await startApplication('fleet', fleetEnv, fleetPort);
    cleanup.push(() => fleet.stop());
    const fleetObserver = await observeRequests(fleet.url);
    cleanup.push(fleetObserver.close);
    const subgraphUrls = {
      core: coreUrl,
      fleet: options.observeSubgraphs === false ? fleet.url : fleetObserver.url,
      'karma-client': karmaClient.url,
    };
    const adminOrigin = options.adminOrigin ?? 'http://127.0.0.1:11000';
    const gateway = await startRouter({ adminOrigin, subgraphUrls });
    cleanup.push(gateway.stop);
    return {
      url: gateway.url,
      pid: gateway.pid,
      logs: () => ({
        gateway: gateway.logs(),
        core: core.logs(),
        fleet: fleet.logs(),
        'karma-client': karmaClient.logs(),
      }),
      healthUrl: gateway.healthUrl,
      karma,
      karmaClientUrl: karmaClient.url,
      stopKarmaClient: karmaClient.stop,
      pauseKarmaClient: karmaClient.pause,
      resumeKarmaClient: karmaClient.resume,
      coreRequests: coreObserver.requests,
      setCoreResponse: coreObserver.setResponse,
      fleetUrl: fleet.url,
      // Guarded Fleet test database (without the schema option) and the per-run schema, for
      // specs that insert telemetry or event rows no API creates.
      fleetDatabaseUrl: fleetDatabase.databaseUrl,
      fleetSchema: fleetDatabase.schema,
      fleetRequests: fleetObserver.requests,
      restartFleet: async () => {
        await fleet.stop();
        fleet = await startApplication('fleet', fleetEnv, fleet.port);
      },
      setFleetEnabled: async (enabled: boolean) => {
        await fleet.stop();
        fleet = await startApplication(
          'fleet',
          { ...fleetEnv, FLEET_ENABLED: String(enabled) },
          fleet.port,
        );
      },
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
