import 'dotenv/config';
import { createPrismaClient } from '../src/database/client.js';
import { seedProducts } from './seed-data.js';

const client = createPrismaClient();
try {
  const result = await seedProducts(client);
  console.info(`products: inserted ${String(result.count)} seed rows; existing rows preserved`);
} finally {
  await client.$disconnect();
}
