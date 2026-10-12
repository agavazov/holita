import 'dotenv/config';
import { createPrismaClient } from '../src/database/client.js';
import { seedFleet } from './seed-data.js';

const client = createPrismaClient();
try {
  const result = await seedFleet(client);
  console.info(
    `fleet: inserted ${String(result.vehicles)} vehicles and ${String(result.devices)} devices; existing rows preserved`,
  );
} finally {
  await client.$disconnect();
}
