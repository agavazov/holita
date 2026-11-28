import {
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { GraphQLError } from 'graphql';
import type { LeadHandoffInput } from '../generated/graphql/types.js';

const paths = ['merchantName', 'adminName', 'adminEmail', 'branchName', 'initialPassword'];

export function provisioningInputError(body: unknown) {
  const entries =
    typeof body === 'object' && body && 'fieldErrors' in body && Array.isArray(body.fieldErrors)
      ? body.fieldErrors
      : [];
  const fieldErrors = entries.flatMap((entry: unknown) => {
    if (
      typeof entry === 'object' &&
      entry &&
      'path' in entry &&
      typeof entry.path === 'string' &&
      paths.includes(entry.path) &&
      'code' in entry &&
      typeof entry.code === 'string' &&
      'message' in entry &&
      typeof entry.message === 'string'
    ) {
      return [{ path: entry.path, code: entry.code, message: entry.message }];
    }
    return [];
  });
  return {
    error: new GraphQLError('Core rejected the onboarding details', {
      extensions: { code: 'BAD_USER_INPUT', fieldErrors },
    }),
    passwordError: fieldErrors.some(({ path }) => path === 'initialPassword'),
  };
}

export interface MerchantDestination {
  merchantTenantId: string;
  branchId: string;
}

function isDestination(value: unknown): value is MerchantDestination {
  return (
    typeof value === 'object' &&
    value !== null &&
    'merchantTenantId' in value &&
    typeof value.merchantTenantId === 'string' &&
    isUUID(value.merchantTenantId) &&
    'branchId' in value &&
    typeof value.branchId === 'string' &&
    isUUID(value.branchId)
  );
}

@Injectable()
export class CoreMerchantProvisioning {
  async provision(
    authorization: string,
    operationId: string,
    input: LeadHandoffInput,
    initialPassword: string | undefined,
  ): Promise<
    | { destination: MerchantDestination }
    | ReturnType<typeof provisioningInputError>
    | { error: UnauthorizedException | ForbiddenException }
  > {
    const url = new URL(
      '/internal/platform/provision-merchant',
      process.env.CORE_AUTH_VERIFY_URL ?? 'http://127.0.0.1:12011/internal/auth/verify',
    );
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          authorization,
          'content-type': 'application/json',
          'x-core-internal-token': process.env.CORE_INTERNAL_AUTH_TOKEN ?? '',
        },
        body: JSON.stringify({ operationId, ...input, initialPassword }),
        signal: AbortSignal.timeout(3000),
        redirect: 'error',
      });
      if (response.status === 401) {
        return { error: new UnauthorizedException('Sign in first') };
      }
      if (response.status === 403) {
        return { error: new ForbiddenException('A platform Sales account is required') };
      }
      if (response.status === 400 || response.ok) {
        const body: unknown = await response.json();
        if (
          response.status === 400 &&
          typeof body === 'object' &&
          body &&
          'statusCode' in body &&
          body.statusCode === 400
        ) {
          return provisioningInputError(body);
        }
        // Nest uses the supplied response object verbatim for field validation.
        if (response.status === 400 && typeof body === 'object' && body && 'fieldErrors' in body) {
          return provisioningInputError(body);
        }
        if (response.ok && isDestination(body)) {
          return {
            destination: { merchantTenantId: body.merchantTenantId, branchId: body.branchId },
          };
        }
      }
    } catch {
      // An incomplete reply cannot establish whether Core committed.
    }
    throw new ServiceUnavailableException('Merchant provisioning could not be confirmed');
  }
}
