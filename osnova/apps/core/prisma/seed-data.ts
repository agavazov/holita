import { normalizedEmail, userName, validatePassword } from '../src/auth/account-input.js';
import { hashPassword } from '../src/auth/password.js';
import type { PrismaClient } from '../src/generated/prisma/client.js';

export interface CoreSeedData {
  tenants: { id: string; name: string; kind?: 'CUSTOMER' | 'PLATFORM' }[];
  branches: { id: string; tenantId: string; name: string }[];
  users?: {
    id: string;
    tenantId: string;
    name: string;
    emailEnv: string;
    passwordEnv: string;
    role: 'ADMINISTRATOR' | 'OPERATOR' | 'SALES';
  }[];
}
export async function seedBranches(client: PrismaClient, data: CoreSeedData) {
  await client.tenant.createMany({ data: data.tenants, skipDuplicates: true });
  return client.branch.createMany({ data: data.branches, skipDuplicates: true });
}
export async function seedAccounts(client: PrismaClient, data: CoreSeedData): Promise<void> {
  for (const item of data.users ?? []) {
    const email = process.env[item.emailEnv];
    const password = process.env[item.passwordEnv];
    if (!email || !password) {
      throw new Error('Seed account email and password environment variables are required');
    }
    await client.user.createMany({
      data: [
        {
          id: item.id,
          tenantId: item.tenantId,
          name: userName(item.name),
          email: normalizedEmail(email),
          passwordHash: await hashPassword(validatePassword(password)),
          role: item.role,
        },
      ],
      skipDuplicates: true,
    });
  }
}
