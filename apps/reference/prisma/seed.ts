import 'dotenv/config';
import { createPrismaClient } from '../src/database/client.js';
import { seedReference } from './seed-data.js';

const client = createPrismaClient();
try {
  const result = await seedReference(client);
  console.info(
    `reference: inserted ${String(result.vehicles)} vehicles and ${String(result.devices)} devices; existing rows preserved`,
  );
} finally {
  await client.$disconnect();
}
