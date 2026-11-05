import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { print } from 'graphql';
import { requireTenant } from '../../auth/demo-auth.js';
import {
  ErmFleetDeviceDocument,
  type ErmFleetDeviceQueryVariables,
} from '../../generated/graphql/fleet-operations.js';
import type { RequestContext } from '../../graphql/request-context.js';

@Injectable()
export class FleetClient {
  async matchesDeviceTarget(target: {
    tenantId: string;
    branchId: string;
    deviceId: string;
    imei: string;
  }): Promise<boolean> {
    const token = process.env.ERM_TELEMETRY_TOKEN;
    if (!token || token.length < 32) {
      throw new ServiceUnavailableException('Fleet target verification is not configured');
    }
    try {
      const url = new URL(
        '/internal/erm-device-target',
        process.env.FLEET_GRAPHQL_URL ?? 'http://127.0.0.1:11013/graphql',
      );
      const response = await fetch(url, {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(5000),
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify(target),
      });
      if (!response.ok) {
        await response.body?.cancel();
        throw new ServiceUnavailableException('Fleet target verification is unavailable');
      }
      const value: unknown = await response.json();
      if (
        typeof value !== 'object' ||
        value === null ||
        !('matches' in value) ||
        typeof value.matches !== 'boolean'
      ) {
        throw new ServiceUnavailableException('Invalid Fleet target verification');
      }
      return value.matches;
    } catch {
      throw new ServiceUnavailableException('Fleet target verification failed or timed out');
    }
  }

  async deviceImei(id: string, context: RequestContext): Promise<string> {
    requireTenant(context);
    const variables: ErmFleetDeviceQueryVariables = { id };
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
            query: print(ErmFleetDeviceDocument),
            variables,
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
            case 'BAD_USER_INPUT':
              throw new BadRequestException('Invalid Fleet device request');
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
          typeof device.id === 'string' &&
          device.id.toLowerCase() === id.toLowerCase() &&
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
