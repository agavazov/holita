import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { requireTenant } from '../../auth/demo-auth.js';
import type { RequestContext } from '../../graphql/request-context.js';

@Injectable()
export class FleetClient {
  async deviceImei(id: string, context: RequestContext): Promise<string> {
    requireTenant(context);
    let value: unknown;
    try {
      const response = await fetch(
        process.env.FLEET_GRAPHQL_URL ?? 'http://127.0.0.1:11013/graphql',
        {
          method: 'POST',
          redirect: 'error',
          signal: AbortSignal.timeout(5000),
          headers: {
            'content-type': 'application/json',
            authorization: context.authorization ?? '',
            'x-branch-id': context.branchId ?? '',
            'x-request-id': context.requestId,
          },
          body: JSON.stringify({
            query: 'query($id: ID!) { fleetDevice(id: $id) { id imei } }',
            variables: { id },
          }),
        },
      );
      if (response.status === 401) {
        throw new UnauthorizedException('Fleet session authentication required');
      }
      if (response.status === 403) {
        throw new ForbiddenException('Fleet device access is forbidden');
      }
      if (response.status === 404) {
        throw new NotFoundException('Fleet device not found in the active Branch');
      }
      if (!response.ok) {
        throw new ServiceUnavailableException('Fleet is unavailable');
      }
      value = await response.json();
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof ForbiddenException ||
        error instanceof NotFoundException ||
        error instanceof ServiceUnavailableException
      ) {
        throw error;
      }
      throw new ServiceUnavailableException('Fleet request failed or timed out');
    }
    if (typeof value === 'object' && value !== null) {
      if ('errors' in value && Array.isArray(value.errors) && value.errors.length > 0) {
        const errors: unknown[] = value.errors;
        for (const error of errors) {
          if (
            typeof error !== 'object' ||
            error === null ||
            !('extensions' in error) ||
            typeof error.extensions !== 'object' ||
            error.extensions === null ||
            !('code' in error.extensions)
          ) {
            continue;
          }
          switch (error.extensions.code) {
            case 'NOT_FOUND':
              throw new NotFoundException('Fleet device not found in the active Branch');
            case 'UNAUTHENTICATED':
              throw new UnauthorizedException('Fleet session authentication required');
            case 'FORBIDDEN':
              throw new ForbiddenException('Fleet device access is forbidden');
          }
        }
        throw new ServiceUnavailableException('Fleet could not verify device access');
      }
      if (
        'data' in value &&
        typeof value.data === 'object' &&
        value.data !== null &&
        'fleetDevice' in value.data
      ) {
        const device = value.data.fleetDevice;
        if (device === null) {
          throw new NotFoundException('Fleet device not found in the active Branch');
        }
        if (
          typeof device === 'object' &&
          'id' in device &&
          device.id === id &&
          'imei' in device &&
          typeof device.imei === 'string' &&
          /^\d{15}$/.test(device.imei)
        ) {
          return device.imei;
        }
      }
    }
    throw new ServiceUnavailableException('Invalid Fleet device response');
  }
}
