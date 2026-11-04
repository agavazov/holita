import 'dotenv/config';
import { createPrismaClient } from './database/client.js';
import {
  runParameterChange,
  validateParameterChangeOptions,
  type ParameterChangeOptions,
} from './modules/telemetry/edata-change.js';

function argumentsFrom(argv: string[]): ParameterChangeOptions {
  const values = new Map<string, string>();
  let restoreAfter = false;
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index] ?? '';
    if (argument === '--restore-after' && !restoreAfter) {
      restoreAfter = true;
    } else if (['--unit', '--parameter', '--value'].includes(argument) && !values.has(argument)) {
      const value = argv[++index];
      if (value === undefined || value.startsWith('--')) {
        throw new Error('Missing argument value');
      }
      values.set(argument, value);
    } else {
      throw new Error('Unknown or repeated argument');
    }
  }
  const value = values.get('--value');
  if (value === undefined) {
    throw new Error('Missing --value');
  }
  const options: ParameterChangeOptions = {
    unitId: values.get('--unit') ?? '',
    parameter: values.get('--parameter') ?? '',
    value,
    restoreAfter,
  };
  validateParameterChangeOptions(options);
  return options;
}

async function main(): Promise<void> {
  const options = argumentsFrom(process.argv.slice(2));
  const client = createPrismaClient();
  try {
    const change = await runParameterChange(client, options);
    console.info(`Configuration record: ${change.id}; ${change.status}`);
    if (!['VERIFIED', 'RESTORED'].includes(change.status)) {
      process.exitCode = 1;
    }
  } finally {
    await client.$disconnect();
  }
}

main().catch(() => {
  console.error(
    'ERM parameter change failed. Use --unit <15-digit IMEI> --parameter <four digits> --value <value> [--restore-after]. Routing and protected parameters are refused. Check environment and database/gateway access.',
  );
  process.exitCode = 1;
});
