import {
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { readSession, type SessionIdentity } from '@osnova/auth';

export interface RequestContext {
  authorization: string | undefined;
  branchId: string | undefined;
}
export interface Scope {
  tenantId: string;
  branchId: string;
}

export async function requireScope(context: RequestContext, write: boolean): Promise<Scope> {
  const identity: SessionIdentity | undefined = await readSession(context.authorization);
  if (!identity) {
    throw new UnauthorizedException('Sign in first');
  }
  if (identity.platform || !['VIEWER', 'OPERATOR', 'ADMINISTRATOR'].includes(identity.role)) {
    throw new ForbiddenException('A merchant account is required');
  }
  if (write && !['OPERATOR', 'ADMINISTRATOR'].includes(identity.role)) {
    throw new ForbiddenException('Your role does not permit this action');
  }
  if (!context.branchId || !isUUID(context.branchId)) {
    throw new BadRequestException('Select a Branch with a valid x-branch-id');
  }
  const branchId = context.branchId.toLowerCase();
  let result: unknown;
  try {
    const response = await fetch(process.env.CORE_GRAPHQL_URL ?? 'http://127.0.0.1:12011/graphql', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: context.authorization ?? '' },
      body: JSON.stringify({
        query: 'query VerifyBranch($id: ID!) { branch(id: $id) { id } }',
        variables: { id: branchId },
      }),
      signal: AbortSignal.timeout(3000),
      redirect: 'error',
    });
    if (!response.ok) {
      throw new Error('Core returned an error');
    }
    result = await response.json();
  } catch {
    throw new ServiceUnavailableException('Branch verification is unavailable');
  }
  if (
    typeof result !== 'object' ||
    result === null ||
    !('data' in result) ||
    typeof result.data !== 'object' ||
    result.data === null ||
    !('branch' in result.data) ||
    typeof result.data.branch !== 'object' ||
    result.data.branch === null ||
    !('id' in result.data.branch) ||
    result.data.branch.id !== branchId
  ) {
    throw new ForbiddenException('Branch is unavailable');
  }
  return { tenantId: identity.tenantId, branchId };
}
