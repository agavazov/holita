import type { CoreSeedData } from '../prisma/seed-data.js';

export const testSeedData: CoreSeedData = {
  tenants: [{ id: '01000000-0000-4000-8000-000000000001', name: 'Example tenant' }],
  branches: [
    {
      id: '10000000-0000-4000-8000-000000000001',
      tenantId: '01000000-0000-4000-8000-000000000001',
      name: 'First branch',
    },
    {
      id: '10000000-0000-4000-8000-000000000002',
      tenantId: '01000000-0000-4000-8000-000000000001',
      name: 'Second branch',
    },
  ],
};
