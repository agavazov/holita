import 'dotenv/config';
import { createPrismaClient } from '../src/database/client.js';
import { seedBranches } from './seed-data.js';

const client = createPrismaClient();
try {
  const result = await seedBranches(client);
  console.info(`core: inserted ${String(result.count)} seed rows; existing rows preserved`);
} finally {
  await client.$disconnect();
}
