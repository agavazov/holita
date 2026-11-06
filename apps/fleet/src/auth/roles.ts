import { ForbiddenException } from '@nestjs/common';
import type { RequestContext } from '../graphql/request-context.js';
import { readDemoTenant, requireTenant } from './demo-auth.js';
import { readSession } from './session-auth.js';

export type UserRole = 'VIEWER' | 'OPERATOR' | 'ENGINEER' | 'ADMINISTRATOR';

const ROLE_LEVEL: Record<UserRole, number> = {
  VIEWER: 0,
  OPERATOR: 1,
  ENGINEER: 2,
  ADMINISTRATOR: 3,
};

export async function hasRole(context: RequestContext, minimum: UserRole): Promise<boolean> {
  const tenantId = requireTenant(context);
  const identity = await readSession(context.authorization);
  const role =
    identity?.tenantId === tenantId
      ? identity.role
      : readDemoTenant(context.authorization) === tenantId
        ? 'ADMINISTRATOR'
        : undefined;
  return role !== undefined && ROLE_LEVEL[role] >= ROLE_LEVEL[minimum];
}

export async function requireRole(context: RequestContext, minimum: UserRole): Promise<void> {
  if (!(await hasRole(context, minimum))) {
    throw new ForbiddenException('Your role does not permit this action');
  }
}
