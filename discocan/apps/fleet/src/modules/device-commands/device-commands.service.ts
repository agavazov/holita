import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  DEVICE_COMMANDS_UNSUPPORTED,
  type DeviceCommandActor,
  type DeviceCommandOutcome,
} from '@discocan/device-contract';
import { hasRole } from '../../auth/roles.js';
import type {
  CancelDeviceCommandInput,
  FleetDeviceCommandBatch,
  FleetDeviceCommandRequest,
  FleetDeviceCommandsInput,
  FleetDeviceType,
  QueryFleetDeviceCommandRequestsArgs,
  RetryDeviceCommandInput,
  SendDeviceCommandInput,
  StartDeviceCommandBatchInput,
} from '../../generated/graphql/types.js';
import type { RequestContext } from '../../graphql/request-context.js';
import type { DeviceAdapter } from '../../integrations/device-adapter.js';
import { DeviceAdapters } from '../../integrations/device-adapters.js';
import { invalid, requireScope, uuid, type FleetScope } from '../../validation.js';
import {
  commandAction,
  commandHistoryInput,
  commandOptions,
  commandParameters,
  commandQueueInput,
} from './device-commands-input.js';
import { deviceBatchIds } from '../devices/device-operation-input.js';
import { DevicesRepository } from '../devices/devices.repository.js';

function target({ id, imei }: { id: string; imei: string }) {
  return { id, imei };
}

function unsupported(path: string): never {
  return invalid(path, DEVICE_COMMANDS_UNSUPPORTED.message, DEVICE_COMMANDS_UNSUPPORTED.code);
}

@Injectable()
export class DeviceCommandsService {
  constructor(
    private readonly devices: DevicesRepository,
    private readonly adapters: DeviceAdapters,
  ) {}

  async send(context: RequestContext, input: SendDeviceCommandInput) {
    const scope = await this.operator(context);
    const device = await this.device(scope, uuid(input.deviceId, 'deviceId'));
    const action = commandAction(input.action);
    const parameters = commandParameters(action, input.parameters);
    const options = commandOptions(input);
    return this.submit(device.type, 'action', (adapter) =>
      adapter.createCommand(
        {
          ...this.audit(context, scope),
          device: target(device),
          action,
          parameters,
          ...options,
        },
        context,
      ),
    );
  }

  async cancel(context: RequestContext, input: CancelDeviceCommandInput) {
    const scope = await this.operator(context);
    const device = await this.device(scope, uuid(input.deviceId, 'deviceId'));
    const requestId = uuid(input.requestId, 'requestId');
    return this.submit(device.type, 'requestId', (adapter) =>
      adapter.cancelCommand(
        {
          ...this.audit(context, scope),
          device: target(device),
          requestId,
        },
        context,
      ),
    );
  }

  async retry(context: RequestContext, input: RetryDeviceCommandInput) {
    const scope = await this.operator(context);
    const requestId = uuid(input.requestId, 'requestId');
    const options = commandOptions(input);
    const request = await this.lookupRequest(context, scope, requestId);
    if (!request) {
      throw new NotFoundException('Command request not found in the active Branch');
    }
    await this.verifyDevice(scope, request);
    return this.submit(request.deviceType, 'requestId', (adapter) =>
      adapter.retryCommand({ ...this.audit(context, scope), requestId, ...options }, context),
    );
  }

  async startBatch(context: RequestContext, input: StartDeviceCommandBatchInput) {
    const scope = await this.operator(context);
    const ids = deviceBatchIds(input.deviceIds);
    const devices = await this.devices.forIds(scope, ids);
    const type = devices[0]?.type;
    if (!type || devices.length !== ids.length) {
      invalid('deviceIds', 'Choose Devices from the active Branch.');
    }
    if (devices.some((device) => device.type !== type)) {
      invalid('deviceIds', 'Choose Devices of one type.', 'UNSUPPORTED_VALUE');
    }
    const action = commandAction(input.action);
    if (action === 'READ_PARAMETERS') {
      invalid('action', 'Choose a fixed read for a command batch.', 'UNSUPPORTED_VALUE');
    }
    const options = commandOptions(input);
    const targets = new Map(devices.map((device) => [device.id, target(device)]));
    return this.submit(type, 'action', (adapter) =>
      adapter.startCommandBatch(
        {
          ...this.audit(context, scope),
          devices: ids.map((id) => {
            const device = targets.get(id);
            if (!device) {
              throw new NotFoundException('Device not found in the active Branch');
            }
            return device;
          }),
          action,
          ...options,
        },
        context,
      ),
    );
  }

  async stopBatch(context: RequestContext, id: string) {
    const scope = await this.operator(context);
    const batchId = uuid(id, 'id');
    const batch = await this.lookupBatch(context, scope, batchId);
    if (!batch) {
      throw new NotFoundException('Command batch not found in the active Branch');
    }
    await this.verifyBatch(scope, batch);
    return this.submit(batch.deviceType, 'id', (adapter) =>
      adapter.stopCommandBatch({ ...this.audit(context, scope), batchId }, context),
    );
  }

  async get(context: RequestContext, id: string) {
    const scope = requireScope(context);
    const request = await this.lookupRequest(context, scope, uuid(id, 'id'));
    if (request) {
      await this.verifyDevice(scope, request);
    }
    return request;
  }

  async list(context: RequestContext, args: QueryFleetDeviceCommandRequestsArgs) {
    const scope = requireScope(context);
    const input = commandQueueInput(args);
    const ids = input.filter.deviceIds;
    const devices = ids && (await this.devices.forIds(scope, ids));
    if (ids && devices?.length !== ids.length) {
      invalid('filter', 'filter.deviceIds: choose Devices from the active Branch.');
    }
    const types = this.adapters
      .enabledTypes('listCommands')
      .filter((type) => !devices || devices.some((device) => device.type === type));
    const pages = await Promise.all(
      types.map((type) => this.adapters.for(type).listCommands({ ...scope, ...input }, context)),
    );
    // ERM owns the populated queue in this phase. The Discocan page is empty.
    return {
      items: pages.flatMap((page) => page.items),
      total: pages.reduce((total, page) => total + page.total, 0),
      offset: input.offset,
      limit: input.limit,
    };
  }

  async batch(context: RequestContext, id: string) {
    const scope = requireScope(context);
    const batch = await this.lookupBatch(context, scope, uuid(id, 'id'));
    if (batch) {
      await this.verifyBatch(scope, batch);
    }
    return batch;
  }

  catalog(context: RequestContext, type: FleetDeviceType) {
    const scope = requireScope(context);
    return this.adapters.enabled(type, 'actionCatalog')
      ? this.adapters.for(type).actionCatalog(scope, context)
      : [];
  }

  requestHistory(
    context: RequestContext,
    device: { type: FleetDeviceType; id: string; imei: string },
  ) {
    const scope = requireScope(context);
    return this.adapters.enabled(device.type, 'commandRequestHistory')
      ? this.adapters
          .for(device.type)
          .commandRequestHistory({ ...scope, device: target(device) }, context)
      : [];
  }

  async faultReadHistory(context: RequestContext, deviceIds: readonly string[]) {
    const scope = requireScope(context);
    const ids = [...new Set(deviceIds.map((id) => uuid(id, 'deviceIds')))];
    const devices = await this.devices.forIds(scope, ids);
    const histories = await Promise.all(
      [...this.adapters.group(devices, 'faultReadHistory')].map(([type, group]) =>
        this.adapters.for(type).faultReadHistory(group.map(target), context),
      ),
    );
    return histories.flat();
  }

  commands(
    context: RequestContext,
    device: { type: FleetDeviceType; id: string; imei: string },
    input: FleetDeviceCommandsInput | null | undefined,
  ) {
    const request = {
      ...requireScope(context),
      ...commandHistoryInput(input),
      device: target(device),
    };
    return this.adapters.enabled(device.type, 'commandHistory')
      ? this.adapters.for(device.type).commandHistory(request, context)
      : { items: [], cursor: request.cursor, nextCursor: null, hasMore: false };
  }

  private async operator(context: RequestContext): Promise<FleetScope> {
    if (!(await hasRole(context, 'OPERATOR'))) {
      throw new ForbiddenException('Device commands require the Operator role');
    }
    return requireScope(context);
  }

  private audit(context: RequestContext, scope: FleetScope): DeviceCommandActor {
    return { ...scope, actorId: context.userId ?? `demo-tenant:${scope.tenantId}` };
  }

  private async device(scope: FleetScope, id: string) {
    const device = await this.devices.find(scope, id);
    if (!device) {
      throw new NotFoundException('Device not found in the active Branch');
    }
    return device;
  }

  private async verifyDevice(scope: FleetScope, request: FleetDeviceCommandRequest) {
    const device = await this.device(scope, request.deviceId);
    if (device.type !== request.deviceType || device.imei !== request.imei) {
      throw new NotFoundException('Command Device not found in the active Branch');
    }
  }

  private async verifyBatch(scope: FleetScope, batch: FleetDeviceCommandBatch) {
    const ids = [...new Set(batch.requests.map(({ deviceId }) => deviceId))];
    const devices = await this.devices.forIds(scope, ids);
    const imeis = new Map(
      devices.filter(({ type }) => type === batch.deviceType).map(({ id, imei }) => [id, imei]),
    );
    if (batch.requests.some((request) => imeis.get(request.deviceId) !== request.imei)) {
      throw new NotFoundException('Command batch Device not found in the active Branch');
    }
  }

  private async lookupRequest(context: RequestContext, scope: FleetScope, requestId: string) {
    for (const provider of this.adapters.enabledTypes('getCommand')) {
      const result = await this.adapters.for(provider).getCommand(
        {
          tenantId: scope.tenantId,
          branchId: scope.branchId,
          requestId,
        },
        context,
      );
      if (result) {
        return result;
      }
    }
    return null;
  }

  private async lookupBatch(context: RequestContext, scope: FleetScope, batchId: string) {
    for (const provider of this.adapters.enabledTypes('getCommandBatch')) {
      const result = await this.adapters.for(provider).getCommandBatch(
        {
          tenantId: scope.tenantId,
          branchId: scope.branchId,
          batchId,
        },
        context,
      );
      if (result) {
        return result;
      }
    }
    return null;
  }

  private async submit<T extends object>(
    type: FleetDeviceType,
    path: string,
    operation: (adapter: DeviceAdapter) => Promise<DeviceCommandOutcome<T>>,
  ): Promise<T> {
    if (!this.adapters.enabled(type, 'createCommand')) {
      unsupported(path);
    }
    const outcome = await operation(this.adapters.for(type));
    return 'code' in outcome ? unsupported(path) : outcome;
  }
}
