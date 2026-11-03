import {
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { DeviceCommand } from '../devices/command.js';
import { DevicesService } from '../devices/devices.service.js';

export type LiveUnit = ReturnType<DevicesService['listUnits']>[number];

function liveUnit(value: unknown): LiveUnit {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('unitId' in value) ||
    typeof value.unitId !== 'string' ||
    !('mode' in value) ||
    (value.mode !== 'mirror' && value.mode !== 'primary') ||
    !('peer' in value) ||
    typeof value.peer !== 'string' ||
    !('connectedSince' in value) ||
    typeof value.connectedSince !== 'string' ||
    !('lastFrameAt' in value) ||
    typeof value.lastFrameAt !== 'string'
  ) {
    throw new ServiceUnavailableException('Invalid ERM gateway response');
  }
  return {
    unitId: value.unitId,
    mode: value.mode,
    peer: value.peer,
    connectedSince: value.connectedSince,
    lastFrameAt: value.lastFrameAt,
  };
}

@Injectable()
export class LiveDevicesService {
  constructor(@Optional() private readonly devices?: DevicesService) {}

  async listUnits(): Promise<LiveUnit[]> {
    if (this.devices) {
      return this.devices.listUnits();
    }
    const value = await this.request('/internal/units', 'GET', 5000);
    if (!Array.isArray(value)) {
      throw new ServiceUnavailableException('Invalid ERM gateway response');
    }
    return value.map(liveUnit);
  }

  async sendCommand(unitId: string, command: DeviceCommand): Promise<string> {
    if (this.devices) {
      try {
        return (await this.devices.sendCommand(unitId, command)).id;
      } catch (error) {
        if (error instanceof NotFoundException) {
          throw new ConflictException('Unit is not connected');
        }
        throw error;
      }
    }
    const value = await this.request(
      `/internal/units/${encodeURIComponent(unitId)}/commands`,
      'POST',
      35_000,
      command,
    );
    if (
      typeof value !== 'object' ||
      value === null ||
      !('id' in value) ||
      typeof value.id !== 'string'
    ) {
      throw new ServiceUnavailableException('Invalid ERM gateway response');
    }
    return value.id;
  }

  private async request(
    path: string,
    method: string,
    timeout: number,
    body?: DeviceCommand,
  ): Promise<unknown> {
    const token = process.env.ERM_INTERNAL_TOKEN;
    if (!token || token.length < 32) {
      throw new ServiceUnavailableException('ERM gateway access is not configured');
    }
    try {
      const response = await fetch(
        new URL(path, process.env.ERM_GATEWAY_URL ?? 'http://127.0.0.1:11015'),
        {
          method,
          redirect: 'error',
          signal: AbortSignal.timeout(timeout),
          headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
          ...(body && { body: JSON.stringify(body) }),
        },
      );
      if (method === 'POST' && (response.status === 404 || response.status === 409)) {
        throw new ConflictException('Unit is not connected in primary mode or is busy');
      }
      if (!response.ok) {
        throw new ServiceUnavailableException('ERM gateway is unavailable');
      }
      const value: unknown = await response.json();
      return value;
    } catch (error) {
      if (error instanceof ConflictException || error instanceof ServiceUnavailableException) {
        throw error;
      }
      throw new ServiceUnavailableException('ERM gateway request failed or timed out');
    }
  }
}
