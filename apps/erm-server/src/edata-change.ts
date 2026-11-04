import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { createPrismaClient } from './database/client.js';
import {
  runEdataChange,
  validateEdataChangeOptions,
  type EdataChangeOptions,
} from './modules/telemetry/edata-change.js';
import { splitEdataDefinitions } from './starlink/edata-configuration.js';

function argumentsFrom(argv: string[]): EdataChangeOptions | { split: string } {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index] ?? '';
    if (values.has(argument) || flags.has(argument)) {
      throw new Error('Repeated argument');
    }
    if (argument === '--read' || argument === '--restore-after') {
      flags.add(argument);
    } else if (
      ['--unit', '--parameter', '--interval', '--add', '--globals', '--split'].includes(argument)
    ) {
      const value = argv[++index];
      if (value === undefined || value.startsWith('--')) {
        throw new Error('Missing argument value');
      }
      values.set(argument, value);
    } else {
      throw new Error('Unknown argument');
    }
  }
  const split = values.get('--split');
  if (split !== undefined) {
    if (values.size !== 1 || flags.size !== 0) {
      throw new Error('--split must be used alone');
    }
    return { split };
  }
  const parameter = values.get('--parameter');
  const interval = values.get('--interval');
  const add = values.get('--add');
  const globals = values.get('--globals');
  if (
    (parameter !== undefined && !/^\d+$/.test(parameter)) ||
    (interval !== undefined && !/^\d+$/.test(interval))
  ) {
    throw new Error('Parameter and interval must be decimal integers');
  }
  const options: EdataChangeOptions = {
    unitId: values.get('--unit') ?? '',
    read: flags.has('--read'),
    restoreAfter: flags.has('--restore-after'),
    ...(parameter !== undefined && { parameter: Number(parameter) }),
    ...(interval !== undefined && { interval: Number(interval) }),
    ...(add !== undefined && { add }),
    ...(globals !== undefined && { globals }),
  };
  validateEdataChangeOptions(options);
  return options;
}

async function main(): Promise<void> {
  const options = argumentsFrom(process.argv.slice(2));
  if ('split' in options) {
    const input = /^[0-9a-f]+$/i.test(options.split)
      ? options.split
      : await readFile(options.split, 'utf8');
    for (const definition of splitEdataDefinitions(input)) {
      console.info(
        `${String(definition.parameter)} ${String(definition.interval)} ${definition.definition}`,
      );
    }
    return;
  }
  const client = createPrismaClient();
  try {
    const change = await runEdataChange(client, options);
    console.info(`Configuration record: ${change.id}; ${change.status}`);
    if (!['READ', 'VERIFIED', 'RESTORED'].includes(change.status)) {
      process.exitCode = 1;
    }
  } finally {
    await client.$disconnect();
  }
}

main().catch(() => {
  console.error(
    'ERM configuration command failed. Use --unit <15-digit IMEI> with --read, --parameter <id> --interval <0..65000>, or --add <44 hex digits>, or --globals <98 hex digits>; optionally --restore-after for a change. Use --split <file or 301 payload> alone for offline extraction. Check environment and database/gateway access.',
  );
  process.exitCode = 1;
});
