import { config } from 'dotenv';
import pg from 'pg';

for (const path of ['.env', 'apps/core/.env', 'apps/products/.env']) {
  config({ path, quiet: true });
}

const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && args[0] !== '--test')) {
  throw new Error('Usage: npm run db:setup or npm run db:test:setup');
}
const suffix = args[0] === '--test' ? '_test' : '';
const port = Number(process.env.POSTGRES_PORT ?? '11084');
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('POSTGRES_PORT must be an integer from 1 to 65535');
}

const databases = ['core', 'products'].map((service) => {
  const name = `holita_${service}${suffix}`;
  const key = `${service.toUpperCase()}${suffix.toUpperCase()}_DATABASE_URL`;
  let url: URL;
  try {
    url = new URL(
      process.env[key] ?? `postgresql://${name}:${name}_local@127.0.0.1:${String(port)}/${name}`,
    );
  } catch {
    throw new Error(`${key} must be a valid PostgreSQL URL`);
  }
  if (
    !['postgresql:', 'postgres:'].includes(url.protocol) ||
    url.hostname !== '127.0.0.1' ||
    Number(url.port || '5432') !== port ||
    url.pathname !== `/${name}` ||
    url.username !== name ||
    !url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(`${key} must identify ${name} on the configured local PostgreSQL instance`);
  }
  return { name, password: decodeURIComponent(url.password), connectionString: url.toString() };
});

const admin = new pg.Client({
  host: '127.0.0.1',
  port,
  user: 'holita_admin',
  database: 'postgres',
  password: process.env.POSTGRES_PASSWORD ?? 'holita_admin_local',
  connectionTimeoutMillis: 5000,
});

try {
  await admin.connect();
  await admin.query("SELECT pg_advisory_lock(hashtext('holita-database-setup'))");
  for (const database of databases) {
    const role = await admin.query<{
      rolsuper: boolean;
      rolcreatedb: boolean;
      rolcreaterole: boolean;
      rolreplication: boolean;
      rolbypassrls: boolean;
      rolcanlogin: boolean;
    }>(
      'SELECT rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls, rolcanlogin FROM pg_roles WHERE rolname = $1',
      [database.name],
    );
    if (role.rows.length === 0) {
      await admin.query(
        `CREATE ROLE ${pg.escapeIdentifier(database.name)} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD ${pg.escapeLiteral(database.password)}`,
      );
    } else if (
      role.rows.some(
        (value) =>
          value.rolsuper ||
          value.rolcreatedb ||
          value.rolcreaterole ||
          value.rolreplication ||
          value.rolbypassrls ||
          !value.rolcanlogin,
      )
    ) {
      throw new Error(
        `Existing role ${database.name} has unexpected privileges; inspect it manually`,
      );
    }
    const existing = await admin.query<{ owner: string }>(
      'SELECT pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datname = $1',
      [database.name],
    );
    if (existing.rows.length === 0) {
      await admin.query(
        `CREATE DATABASE ${pg.escapeIdentifier(database.name)} OWNER ${pg.escapeIdentifier(database.name)}`,
      );
    } else if (existing.rows[0]?.owner !== database.name) {
      throw new Error(
        `Existing database ${database.name} has an unexpected owner; inspect it manually`,
      );
    }
    await admin.query(`REVOKE ALL ON DATABASE ${pg.escapeIdentifier(database.name)} FROM PUBLIC`);
    const check = new pg.Client({
      connectionString: database.connectionString,
      connectionTimeoutMillis: 5000,
    });
    try {
      await check.connect();
      await check.query('SELECT 1');
    } finally {
      await check.end();
    }
    console.info(`${database.name} is ready; existing data and passwords preserved`);
  }
} finally {
  await admin.end();
}
