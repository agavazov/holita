import 'dotenv/config';
import { createPrismaClient } from '../src/database/client.js';
import { getDatabaseUrl } from '../src/database/connection.js';
import { seedReference } from './seed-data.js';

const client = createPrismaClient(getDatabaseUrl());
try {
  await seedReference(client);
  console.info('Inserted missing Reference fixtures');
} finally {
  await client.$disconnect();
}
