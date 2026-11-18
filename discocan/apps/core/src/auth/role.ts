import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { UserRole } from '../generated/graphql/types.js';
import type { RequestContext } from '../graphql/request-context.js';
import { requireTenant } from './demo-auth.js';

export function requireAdministrator(context: RequestContext): void {
  requireTenant(context);
  if (context.role !== 'ADMINISTRATOR') {
    throw new ForbiddenException('Administrator role is required');
  }
}

export function setupUserRole(value: string | undefined): UserRole {
  if (value === undefined) {
    return 'VIEWER';
  }
  switch (value) {
    case 'VIEWER':
    case 'OPERATOR':
    case 'ENGINEER':
    case 'ADMINISTRATOR':
      return value;
    default:
      throw new BadRequestException('Role must be VIEWER, OPERATOR, ENGINEER or ADMINISTRATOR.');
  }
}
