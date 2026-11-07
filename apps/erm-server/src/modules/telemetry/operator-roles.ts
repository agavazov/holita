import { ForbiddenException } from '@nestjs/common';
import { requireTenant } from '../../auth/demo-auth.js';
import type { RequestContext } from '../../graphql/request-context.js';
import { protectedParameters } from '../devices/command.js';

export function requireOperator(context: RequestContext): void {
  requireTenant(context);
  if (
    context.role !== 'OPERATOR' &&
    context.role !== 'ENGINEER' &&
    context.role !== 'ADMINISTRATOR'
  ) {
    throw new ForbiddenException('Device commands require the Operator role');
  }
}

export function requireEngineer(context: RequestContext): void {
  requireTenant(context);
  if (context.role !== 'ENGINEER' && context.role !== 'ADMINISTRATOR') {
    throw new ForbiddenException('Device configuration requires the Engineer role');
  }
}

export function isViewer(context: RequestContext | undefined): boolean {
  return context?.role === 'VIEWER';
}

export function protectedParameter(parameter: number | string): boolean {
  return protectedParameters.has(Number(parameter));
}

export function maskParameterValue(
  parameter: number | string,
  value: string | null,
  context: RequestContext | undefined,
): string | null {
  return value !== null && isViewer(context) && protectedParameter(parameter)
    ? '[REDACTED]'
    : value;
}
