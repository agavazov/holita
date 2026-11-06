import 'dotenv/config';
import { parseArgs } from 'node:util';
import { isUUID } from 'class-validator';
import { BadRequestException } from '@nestjs/common';
import { normalizedEmail, userName, validatePassword } from '../src/auth/account-input.js';
import { hashPassword } from '../src/auth/password.js';
import { setupUserRole } from '../src/auth/role.js';
import { createPrismaClient } from '../src/database/client.js';
import { Prisma } from '../src/generated/prisma/client.js';

async function passwordFromInput(): Promise<string> {
  const environmentPassword = process.env.CORE_SETUP_PASSWORD;
  delete process.env.CORE_SETUP_PASSWORD;
  if (environmentPassword !== undefined) {
    return validatePassword(environmentPassword);
  }
  if (process.stdin.isTTY) {
    throw new BadRequestException(
      'Supply the password through stdin or CORE_SETUP_PASSWORD, never as an argument.',
    );
  }
  process.stdin.setEncoding('utf8');
  let input = '';
  for await (const chunk of process.stdin) {
    if (typeof chunk === 'string') {
      input += chunk;
    }
  }
  return validatePassword(input.replace(/\r?\n$/, ''));
}

async function createUser(): Promise<void> {
  let values: { tenant?: string; email?: string; name?: string; role?: string };
  try {
    ({ values } = parseArgs({
      options: {
        tenant: { type: 'string' },
        email: { type: 'string' },
        name: { type: 'string' },
        role: { type: 'string' },
      },
      strict: true,
      allowPositionals: false,
    }));
  } catch {
    throw new BadRequestException(
      'Use --tenant UUID --email EMAIL --name NAME [--role ROLE]. Passwords are accepted only through stdin or CORE_SETUP_PASSWORD.',
    );
  }
  if (!values.tenant || !isUUID(values.tenant) || !values.email || !values.name) {
    throw new BadRequestException('Use --tenant UUID --email EMAIL --name NAME [--role ROLE].');
  }
  const tenantId = values.tenant.toLowerCase();
  const email = normalizedEmail(values.email);
  const name = userName(values.name);
  const role = setupUserRole(values.role);
  const password = await passwordFromInput();
  const client = createPrismaClient();
  try {
    if (await client.user.findUnique({ where: { email }, select: { id: true } })) {
      throw new BadRequestException('A user with this email already exists; no changes were made.');
    }
    if (!(await client.tenant.findUnique({ where: { id: tenantId }, select: { id: true } }))) {
      throw new BadRequestException('Tenant not found; no changes were made.');
    }
    await client.user.create({
      data: { tenantId, email, name, role, passwordHash: await hashPassword(password) },
    });
    console.info('core: user created');
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new BadRequestException('A user with this email already exists; no changes were made.');
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new Error('User setup failed; check the Core database connection and migrations.', {
        cause: error,
      });
    }
    throw error;
  } finally {
    await client.$disconnect();
  }
}

try {
  await createUser();
} catch (error: unknown) {
  console.error(
    error instanceof BadRequestException
      ? error.message
      : 'User setup failed; check the Core database connection and migrations.',
  );
  process.exitCode = 1;
}
