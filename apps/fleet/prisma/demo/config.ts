import { DEMO_ANCHOR } from './time.js';

const localHosts = ['127.0.0.1', 'localhost', '[::1]'];
interface DemoEnvironment {
  nodeEnv: string | undefined;
  databaseUrl: string;
  coreUrl: string;
}

/** CLI-only guard. Database specs call seedFleetDemo inside their own isolated schema helper. */
export function demoOptions(args: readonly string[], environment: DemoEnvironment, now: number) {
  if (environment.nodeEnv?.trim().toLowerCase() === 'production') {
    throw new Error('Fleet demo seed refuses NODE_ENV=production.');
  }
  let anchorValue = DEMO_ANCHOR;
  if (args.length) {
    if (args.length === 1 && args[0]?.startsWith('--as-of=')) {
      anchorValue = args[0].slice('--as-of='.length);
    } else if (args.length === 2 && args[0] === '--as-of' && args[1]) {
      anchorValue = args[1];
    } else {
      throw new Error('Fleet demo seed accepts only --as-of=<UTC ISO instant>.');
    }
  }
  const anchor = new Date(anchorValue);
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(anchorValue) ||
    !Number.isFinite(anchor.getTime()) ||
    anchor.toISOString().slice(0, 10) !== anchorValue.slice(0, 10)
  ) {
    throw new Error('Fleet demo seed needs a valid UTC ISO instant for --as-of.');
  }
  if (anchor.getTime() > now) {
    throw new Error('Fleet demo seed cannot run before its anchor.');
  }
  let database: URL;
  let core: URL;
  try {
    database = new URL(environment.databaseUrl);
    core = new URL(environment.coreUrl);
  } catch {
    throw new Error('Fleet demo seed requires valid local database and Core URLs.');
  }
  const development = database.pathname === '/holita_fleet' && database.username === 'holita_fleet';
  const test =
    database.pathname === '/holita_fleet_test' && database.username === 'holita_fleet_test';
  const schema = database.searchParams.get('schema') ?? 'public';
  if (
    !['postgres:', 'postgresql:'].includes(database.protocol) ||
    !localHosts.includes(database.hostname) ||
    !database.password ||
    database.hash ||
    (!development && !test) ||
    [...database.searchParams.keys()].some((key) => key !== 'schema') ||
    database.searchParams.getAll('schema').length > 1 ||
    (development && schema !== 'public') ||
    (test && !/^test_[0-9a-f]{32}$/.test(schema))
  ) {
    throw new Error(
      'Fleet demo seed requires local holita_fleet development scope or an isolated holita_fleet_test schema.',
    );
  }
  if (
    !['http:', 'https:'].includes(core.protocol) ||
    !localHosts.includes(core.hostname) ||
    core.username ||
    core.password ||
    core.search ||
    core.hash ||
    core.pathname !== '/graphql'
  ) {
    throw new Error('Fleet demo seed requires the local Core GraphQL endpoint.');
  }
  return { anchor, connectionString: database.toString(), schema };
}
