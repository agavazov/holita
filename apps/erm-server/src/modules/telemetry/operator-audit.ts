import { BadRequestException } from '@nestjs/common';
import { requireTenant } from '../../auth/demo-auth.js';
import type { RequestContext } from '../../graphql/request-context.js';

export interface OperatorScope {
  tenantId: string;
  branchId: string;
}

export interface OperatorAudit extends OperatorScope {
  deviceId: string;
  actorId: string;
  intent: string;
}

export function auditId(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)) {
    throw new BadRequestException('Expected a valid Device, Branch or request ID');
  }
  return value.toLowerCase();
}

export function operatorScope(context: RequestContext): OperatorScope {
  return { tenantId: requireTenant(context), branchId: auditId(context.branchId) };
}

export function operatorAudit(
  context: RequestContext,
  deviceId: string,
  intent: string,
): OperatorAudit {
  const scope = operatorScope(context);
  return {
    ...scope,
    deviceId: auditId(deviceId),
    actorId: `demo-tenant:${scope.tenantId}`,
    intent,
  };
}
