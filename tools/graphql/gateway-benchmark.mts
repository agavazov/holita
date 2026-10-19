import { execFile } from 'node:child_process';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { availableParallelism, cpus, loadavg, release, totalmem } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { isDeepStrictEqual, parseArgs, promisify } from 'node:util';
import { workspaceRoot } from './contracts.mjs';
import { createFederationFixture } from './federation-fixture.mjs';

const { values } = parseArgs({
  options: {
    seconds: { type: 'string', default: '8' },
    warmup: { type: 'string', default: '2' },
    rounds: { type: 'string', default: '3' },
  },
});
function positiveInteger(value: string, name: string, maximum: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new Error(`${name} must be an integer from 1 to ${String(maximum)}.`);
  }
  return parsed;
}
const seconds = positiveInteger(values.seconds, 'seconds', 60);
const warmup = positiveInteger(values.warmup, 'warmup', 30);
const rounds = positiveInteger(values.rounds, 'rounds', 10);
if (process.platform !== 'linux') {
  throw new Error('Run the benchmark on Linux/WSL for /proc metrics.');
}
const execute = promisify(execFile);
const ticksPerSecond = Number((await execute('getconf', ['CLK_TCK'])).stdout.trim());
if (!Number.isFinite(ticksPerSecond) || ticksPerSecond <= 0) {
  throw new Error('Invalid CLK_TCK.');
}
const cancellation = new AbortController();
function cancel() {
  cancellation.abort(new Error('Benchmark interrupted; cleaning up fixtures.'));
}
process.on('SIGINT', cancel);
process.on('SIGTERM', cancel);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function record(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error('Expected a GraphQL object.');
  }
  return value;
}
function string(value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error('Expected a GraphQL string.');
  }
  return value;
}
function processId(pid: number | undefined): number {
  if (pid === undefined) {
    throw new Error('Missing gateway process ID.');
  }
  return pid;
}
let requestNumber = 0;
async function request(url: string, body: string, headers: Record<string, string>) {
  const requestId = `benchmark-${String(++requestNumber)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers, 'x-request-id': requestId },
    body,
    signal: AbortSignal.any([cancellation.signal, AbortSignal.timeout(10000)]),
  });
  const result = record(await response.json());
  if (response.status !== 200 || result.errors !== undefined || !result.data) {
    throw new Error(
      `GraphQL request failed: HTTP ${String(response.status)} ${JSON.stringify(result)}`,
    );
  }
  if (response.headers.get('x-request-id') !== requestId) {
    throw new Error('Request ID was lost.');
  }
  return record(result.data);
}
async function resources(pid: number) {
  const [stat, status] = await Promise.all([
    readFile(`/proc/${String(pid)}/stat`, 'utf8'),
    readFile(`/proc/${String(pid)}/status`, 'utf8'),
  ]);
  // Fields 14/15 are process user/system CPU ticks; field 3 follows the last closing parenthesis.
  const fields = stat
    .slice(stat.lastIndexOf(')') + 2)
    .trim()
    .split(/\s+/);
  const ticks = Number(fields[11]) + Number(fields[12]);
  const rssKb = Number(/^VmRSS:\s+(\d+) kB$/m.exec(status)?.[1]);
  if (!Number.isFinite(ticks) || !Number.isFinite(rssKb)) {
    throw new Error('Missing /proc metrics.');
  }
  return { cpuMs: (ticks * 1000) / ticksPerSecond, rssMiB: rssKb / 1024 };
}
function percentile(sorted: number[], fraction: number): number {
  const value = sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)];
  if (value === undefined) {
    throw new Error('No completed requests.');
  }
  return value;
}
function rounded(value: number): number {
  return Number(value.toFixed(3));
}

type Scenario = { name: string; query: string; variables?: Record<string, unknown> };
type Endpoint = { name: 'router'; url: string; pid: number };
async function sample(
  endpoint: Endpoint,
  scenario: Scenario,
  headers: Record<string, string>,
  expected: Record<string, unknown>,
  concurrency: number,
  durationSeconds: number,
) {
  const body = JSON.stringify({ query: scenario.query, variables: scenario.variables ?? {} });
  const latencies: number[] = [];
  let failures = 0;
  let firstFailure: string | undefined;
  const initial = await resources(endpoint.pid);
  let peakRss = initial.rssMiB;
  const monitoring = new AbortController();
  const monitor = (async () => {
    while (!monitoring.signal.aborted) {
      await delay(100);
      peakRss = Math.max(peakRss, (await resources(endpoint.pid)).rssMiB);
    }
    return undefined;
  })().catch((error: unknown) => new Error('Resource sampling failed.', { cause: error }));
  let monitoringError: Error | undefined;
  const loadGeneratorBefore = process.cpuUsage();
  const started = performance.now();
  const deadline = started + durationSeconds * 1000;
  let completedAt: number;
  let loadGeneratorCpu: NodeJS.CpuUsage;
  let final: Awaited<ReturnType<typeof resources>>;
  try {
    await Promise.all(
      Array.from({ length: concurrency }, async () => {
        while (performance.now() < deadline && !cancellation.signal.aborted) {
          const sent = performance.now();
          try {
            const actual = await request(endpoint.url, body, headers);
            const elapsed = performance.now() - sent;
            if (!isDeepStrictEqual(actual, expected)) {
              throw new Error('Response data differs from preflight.');
            }
            latencies.push(elapsed);
          } catch (error) {
            failures++;
            firstFailure ??= error instanceof Error ? error.message : String(error);
          }
        }
      }),
    );
    completedAt = performance.now();
    loadGeneratorCpu = process.cpuUsage(loadGeneratorBefore);
    final = await resources(endpoint.pid);
  } finally {
    monitoring.abort();
    monitoringError = await monitor;
  }
  if (monitoringError instanceof Error) {
    throw monitoringError;
  }
  cancellation.signal.throwIfAborted();
  latencies.sort((a, b) => a - b);
  const elapsedMs = completedAt - started;
  const cpuMs = final.cpuMs - initial.cpuMs;
  return {
    runtime: endpoint.name,
    scenario: scenario.name,
    concurrency,
    requests: latencies.length,
    failures,
    firstFailure,
    elapsedSeconds: rounded(elapsedMs / 1000),
    requestsPerSecond: rounded((latencies.length * 1000) / elapsedMs),
    meanMs: rounded(latencies.reduce((sum, latency) => sum + latency, 0) / latencies.length),
    p50Ms: rounded(percentile(latencies, 0.5)),
    p95Ms: rounded(percentile(latencies, 0.95)),
    gatewayCpuPercent: rounded((cpuMs * 100) / elapsedMs),
    gatewayCpuMsPerRequest: rounded(cpuMs / latencies.length),
    gatewayRssPeakMiB: rounded(Math.max(peakRss, final.rssMiB)),
    harnessCpuPercent: rounded((loadGeneratorCpu.user + loadGeneratorCpu.system) / 10 / elapsedMs),
  };
}

async function main() {
  const directory = join(workspaceRoot, 'test-results/gateway-benchmark');
  await mkdir(directory, { recursive: true });
  const runId = new Date().toISOString().replaceAll(':', '-');
  const tracePath = join(directory, `${runId}.jsonl`);
  await appendFile(tracePath, JSON.stringify({ event: 'start', seconds, warmup, rounds }) + '\n');
  const fixture = await createFederationFixture({ observeSubgraphs: false });
  try {
    const endpoint: Endpoint = { name: 'router', url: fixture.url, pid: processId(fixture.pid) };
    const response = await fetch(endpoint.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: '{__typename}' }),
      signal: AbortSignal.any([cancellation.signal, AbortSignal.timeout(10000)]),
    });
    await response.arrayBuffer();
    const transport = {
      runtime: endpoint.name,
      contentEncoding: response.headers.get('content-encoding') ?? 'identity',
    };
    console.log(JSON.stringify({ transport }));
    await appendFile(tracePath, JSON.stringify({ event: 'transport', transport }) + '\n');
    const login = await request(
      fixture.url,
      JSON.stringify({
        query: 'mutation($id:ID!){demoLogin(tenantId:$id){token}}',
        variables: { id: '01000000-0000-4000-8000-000000000001' },
      }),
      {},
    );
    const headers = {
      authorization: `Bearer ${string(record(login.demoLogin).token)}`,
      'x-branch-id': '10000000-0000-4000-8000-000000000001',
    };
    for (let index = 0; index < 50; index++) {
      const vehicle = await request(
        fixture.url,
        JSON.stringify({
          query: 'mutation($input:CreateFleetVehicleInput!){createFleetVehicle(input:$input){id}}',
          variables: {
            input: {
              licensePlate: `BENCH ${String(index).padStart(3, '0')}`,
              notes: 'Representative fleet record',
            },
          },
        }),
        headers,
      );
      await request(
        fixture.url,
        JSON.stringify({
          query: 'mutation($input:CreateFleetDeviceInput!){createFleetDevice(input:$input){id}}',
          variables: {
            input: {
              imei: String(index).padStart(15, '0'),
              vehicleId: string(record(vehicle.createFleetVehicle).id),
            },
          },
        }),
        headers,
      );
    }
    const scenarios: Scenario[] = [
      { name: 'gateway-control', query: '{__typename}' },
      { name: 'core-branches', query: '{branches{id name}}' },
      {
        name: 'fleet-vehicles',
        query:
          'query($limit:Int!){fleetVehicles(limit:$limit,sort:{field:LICENSE_PLATE,direction:ASC}){items{id licensePlate notes branch{id name}} total offset limit}}',
        variables: { limit: 20 },
      },
      {
        name: 'fleet-devices',
        query:
          'query($limit:Int!){fleetDevices(limit:$limit,sort:{field:IMEI,direction:ASC}){items{id imei vehicle{id licensePlate} branch{id name}} total offset limit}}',
        variables: { limit: 20 },
      },
      { name: 'karma-cars', query: '{karmaCars{id carNumber deviceId}}' },
    ];
    const samples: (Awaited<ReturnType<typeof sample>> & { round: number })[] = [];
    const loadBefore = loadavg();
    for (const scenario of scenarios) {
      const body = JSON.stringify({ query: scenario.query, variables: scenario.variables ?? {} });
      const expected = await request(fixture.url, body, headers);
      if (scenario.name === 'fleet-vehicles' || scenario.name === 'fleet-devices') {
        const page = record(
          expected[scenario.name === 'fleet-vehicles' ? 'fleetVehicles' : 'fleetDevices'],
        );
        if (page.total !== 50 || !Array.isArray(page.items) || page.items.length !== 20) {
          throw new Error('Expected a complete 20-row page from 50 seeded records.');
        }
      }
      for (const concurrency of [1, 16]) {
        for (let round = 1; round <= rounds; round++) {
          const warmed = await sample(endpoint, scenario, headers, expected, concurrency, warmup);
          if (warmed.failures) {
            throw new Error(`Warmup failed: ${warmed.firstFailure ?? 'unknown error'}`);
          }
          fixture.karma.requests.length = 0;
          const result = {
            ...(await sample(endpoint, scenario, headers, expected, concurrency, seconds)),
            round,
          };
          samples.push(result);
          console.log(JSON.stringify(result));
          await appendFile(tracePath, JSON.stringify(result) + '\n');
          if (result.failures) {
            throw new Error(`Measured requests failed: ${result.firstFailure ?? 'unknown error'}`);
          }
          fixture.karma.requests.length = 0;
        }
      }
    }
    const summaries = scenarios.flatMap((scenario) =>
      [1, 16].map((concurrency) => {
        const matching = samples.filter(
          (row) => row.scenario === scenario.name && row.concurrency === concurrency,
        );
        const median = (select: (row: (typeof matching)[number]) => number) =>
          rounded(
            percentile(
              matching.map(select).sort((a, b) => a - b),
              0.5,
            ),
          );
        return {
          scenario: scenario.name,
          concurrency,
          runtime: endpoint.name,
          requests: matching.reduce((sum, row) => sum + row.requests, 0),
          failures: matching.reduce((sum, row) => sum + row.failures, 0),
          requestsPerSecond: median((row) => row.requestsPerSecond),
          rpsMin: Math.min(...matching.map((row) => row.requestsPerSecond)),
          rpsMax: Math.max(...matching.map((row) => row.requestsPerSecond)),
          meanMs: median((row) => row.meanMs),
          p50Ms: median((row) => row.p50Ms),
          p95Ms: median((row) => row.p95Ms),
          gatewayCpuPercent: median((row) => row.gatewayCpuPercent),
          gatewayCpuMsPerRequest: median((row) => row.gatewayCpuMsPerRequest),
          gatewayRssPeakMiB: Math.max(...matching.map((row) => row.gatewayRssPeakMiB)),
          harnessCpuPercent: median((row) => row.harnessCpuPercent),
        };
      }),
    );
    const path = join(directory, `${runId}.json`);
    await writeFile(
      path,
      JSON.stringify(
        {
          environment: {
            node: process.version,
            router: '2.18.0',
            kernel: release(),
            cpu: cpus()[0]?.model,
            availableCpus: availableParallelism(),
            memoryGiB: rounded(totalmem() / 1024 ** 3),
            loadBefore,
            loadAfter: loadavg(),
          },
          method: {
            seconds,
            warmup,
            rounds,
            concurrency: [1, 16],
            vehicles: 50,
            devices: 50,
            pageSize: 20,
            clockTicksPerSecond: ticksPerSecond,
            observers: false,
            seedRouting: 'router',
            clientAcceptEncoding: 'Node fetch default',
            localKarmaUpstream: true,
            mode: 'closed-loop, native Router, warm query plans',
            summary:
              'median of round metrics; maximum sampled RSS; CPU 100% = one logical core; RSS is approximate',
            latency: 'request start through complete JSON response, before data equality assertion',
            scope:
              'gateway CPU/RSS only; harness CPU includes local Karma fixture; subgraphs and database excluded',
          },
          transport,
          scenarios,
          summaries,
          samples,
        },
        null,
        2,
      ) + '\n',
    );
    console.table(summaries);
    console.log(`Benchmark report: ${path}`);
  } catch (error) {
    await appendFile(
      tracePath,
      JSON.stringify({
        event: 'failed',
        message: error instanceof Error ? error.message : String(error),
        logs: fixture.logs(),
      }) + '\n',
    );
    console.error(`Partial benchmark diagnostics: ${tracePath}`);
    throw error;
  } finally {
    await fixture.close();
  }
}
try {
  await main();
} finally {
  process.off('SIGINT', cancel);
  process.off('SIGTERM', cancel);
}
