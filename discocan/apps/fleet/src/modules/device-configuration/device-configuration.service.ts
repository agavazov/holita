import {
  DEVICE_CONFIGURATION_UNSUPPORTED,
  emptyDeviceParameterSnapshotsPage,
  type DeviceConfigurationAudit,
  type DeviceConfigurationOutcome,
} from '@discocan/device-contract';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { hasRole, type UserRole } from '../../auth/roles.js';
import type {
  FleetDeviceConfigurationBatch,
  FleetDeviceParameterSnapshotsInput,
  FleetDeviceType,
  QueryFleetDeviceParameterCatalogArgs,
  StartDeviceConfigurationBatchInput,
  StartDeviceMeasurementConfigurationChangeInput,
  StartDeviceParameterChangeInput,
  StartDeviceParameterSnapshotInput,
  StartDeviceParametersChangeInput,
} from '../../generated/graphql/types.js';
import type { RequestContext } from '../../graphql/request-context.js';
import type { DeviceAdapter, InspectionDevice } from '../../integrations/device-adapter.js';
import { DeviceAdapters } from '../../integrations/device-adapters.js';
import {
  enumValue,
  invalid,
  optionalText,
  pagination,
  requireScope,
  searchTokens,
  sortDirection,
  uuid,
  type FleetScope,
} from '../../validation.js';
import {
  measurementChangeInput,
  parameterWriteInput,
  parameterWritesInput,
} from './device-configuration-input.js';
import { deviceBatchIds, deviceHistoryPage } from '../devices/device-operation-input.js';
import { DevicesRepository } from '../devices/devices.repository.js';

type ConfigurationDevice = InspectionDevice & { type: FleetDeviceType };

function target({ id, imei }: InspectionDevice): InspectionDevice {
  return { id, imei };
}

@Injectable()
export class DeviceConfigurationService {
  constructor(
    private readonly devices: DevicesRepository,
    private readonly adapters: DeviceAdapters,
  ) {}

  parameterSnapshots(
    context: RequestContext,
    device: ConfigurationDevice,
    input: FleetDeviceParameterSnapshotsInput | null | undefined,
  ) {
    const request = {
      ...requireScope(context),
      ...deviceHistoryPage(input),
      device: target(device),
      direction: sortDirection(input?.direction, 'DESC'),
    };
    return this.adapters.enabled(device.type, 'parameterSnapshots')
      ? this.adapters.for(device.type).parameterSnapshots(request, context)
      : emptyDeviceParameterSnapshotsPage(request);
  }

  configurationChanges(context: RequestContext, device: ConfigurationDevice) {
    const scope = requireScope(context);
    return this.adapters.enabled(device.type, 'configurationChanges')
      ? this.adapters
          .for(device.type)
          .configurationChanges({ ...scope, device: target(device) }, context)
      : [];
  }

  async configurationWritesEnabled(context: RequestContext, device: ConfigurationDevice) {
    const scope = requireScope(context);
    return (
      this.adapters.enabled(device.type, 'configurationWritesEnabled') &&
      (await hasRole(context, 'ENGINEER')) &&
      this.adapters
        .for(device.type)
        .configurationWritesEnabled({ ...scope, device: target(device) }, context)
    );
  }

  parameterCatalog(
    context: RequestContext,
    { deviceType, input }: QueryFleetDeviceParameterCatalogArgs,
  ) {
    const scope = requireScope(context);
    const type = enumValue(deviceType, ['ERM', 'DISCOCAN'], 'deviceType');
    const page = pagination({
      offset: input?.offset ?? 0,
      limit: input?.limit ?? 20,
    });
    const search = searchTokens(input?.search).join(' ') || null;
    const ermFeature = optionalText(input?.ermFeature, 'ermFeature', 200);
    if (ermFeature && type !== 'ERM') {
      invalid('ermFeature', 'Choose ERM to filter by a StarLink feature.', 'UNSUPPORTED_VALUE');
    }
    return this.adapters.enabled(type, 'parameterCatalog')
      ? this.adapters.for(type).parameterCatalog(
          {
            ...scope,
            ...page,
            search,
            writableOnly: input?.writableOnly ?? false,
            ...(ermFeature && { ermFeature }),
          },
          context,
        )
      : { ...page, items: [], total: 0 };
  }

  async startSnapshot(context: RequestContext, input: StartDeviceParameterSnapshotInput) {
    const scope = await this.authorize(context, 'ENGINEER');
    const device = await this.device(scope, input.deviceId);
    return this.submit(device.type, 'startParameterSnapshot', 'deviceId', (adapter) =>
      adapter.startParameterSnapshot(
        {
          ...this.audit(context, scope, 'Read parameter snapshot'),
          device: target(device),
        },
        context,
      ),
    );
  }

  async startMeasurementChange(
    context: RequestContext,
    input: StartDeviceMeasurementConfigurationChangeInput,
  ) {
    const scope = await this.authorize(
      context,
      input.operation === 'READ' ? 'OPERATOR' : 'ENGINEER',
    );
    const device = await this.device(scope, input.deviceId);
    const change = measurementChangeInput(input);
    const intent = {
      READ: 'Read measurement configuration',
      INTERVAL: 'Change measurement interval',
      ADD_DEFINITION: 'Add measurement definition',
      GLOBALS: 'Change measurement globals',
    }[change.operation];
    return this.submit(device.type, 'startMeasurementConfigurationChange', 'operation', (adapter) =>
      adapter.startMeasurementConfigurationChange(
        {
          ...this.audit(context, scope, intent),
          device: target(device),
          ...change,
        },
        context,
      ),
    );
  }

  async startParameterChange(context: RequestContext, input: StartDeviceParameterChangeInput) {
    const scope = await this.authorize(context, 'ENGINEER');
    const device = await this.device(scope, input.deviceId);
    const write = parameterWriteInput(input);
    return this.submit(device.type, 'startParameterChange', 'parameterId', (adapter) =>
      adapter.startParameterChange(
        {
          ...this.audit(context, scope, 'Change parameter'),
          device: target(device),
          ...write,
          restoreAfter: input.restoreAfter ?? false,
        },
        context,
      ),
    );
  }

  async startParametersChange(context: RequestContext, input: StartDeviceParametersChangeInput) {
    const scope = await this.authorize(context, 'ENGINEER');
    const device = await this.device(scope, input.deviceId);
    const parameters = parameterWritesInput(input.parameters);
    return this.submit(device.type, 'startParametersChange', 'parameters', (adapter) =>
      adapter.startParametersChange(
        {
          ...this.audit(context, scope, 'Change parameter set'),
          device: target(device),
          parameters,
          restoreAfter: input.restoreAfter ?? false,
        },
        context,
      ),
    );
  }

  async startBatch(context: RequestContext, input: StartDeviceConfigurationBatchInput) {
    const scope = await this.authorize(context, 'ENGINEER');
    const ids = deviceBatchIds(input.deviceIds);
    const byId = new Map(
      (await this.devices.forIds(scope, ids)).map((device) => [device.id, device]),
    );
    const devices = ids.map((id) => {
      const device = byId.get(id);
      if (!device) {
        throw new NotFoundException('Device not found in the active Branch');
      }
      return device;
    });
    const type = devices[0]?.type;
    if (!type || devices.some((device) => device.type !== type)) {
      invalid('deviceIds', 'Choose Devices of one type.', 'UNSUPPORTED_VALUE');
    }
    const parameters = parameterWritesInput(input.parameters);
    return this.submit(type, 'startConfigurationBatch', 'deviceIds', (adapter) =>
      adapter.startConfigurationBatch(
        {
          ...this.audit(context, scope, 'Change parameter set in Device order'),
          devices: devices.map(target),
          parameters,
          restoreAfter: input.restoreAfter ?? false,
        },
        context,
      ),
    );
  }

  async batch(context: RequestContext, id: string) {
    const scope = requireScope(context);
    return this.lookupBatch(context, scope, uuid(id, 'id'));
  }

  async stopBatch(context: RequestContext, id: string) {
    const scope = await this.authorize(context, 'ENGINEER');
    const batchId = uuid(id, 'id');
    const batch = await this.lookupBatch(context, scope, batchId);
    if (!batch) {
      throw new NotFoundException('Configuration batch not found in the active Branch');
    }
    return this.submit(batch.deviceType, 'stopConfigurationBatch', 'id', (adapter) =>
      adapter.stopConfigurationBatch(
        {
          ...this.audit(context, scope, 'Stop configuration batch'),
          batchId,
        },
        context,
      ),
    );
  }

  private async device(scope: FleetScope, id: string) {
    const device = await this.devices.find(scope, uuid(id, 'deviceId'));
    if (!device) {
      throw new NotFoundException('Device not found in the active Branch');
    }
    return device;
  }

  private async authorize(context: RequestContext, role: UserRole): Promise<FleetScope> {
    const scope = requireScope(context);
    if (!(await hasRole(context, role))) {
      throw new ForbiddenException(
        role === 'OPERATOR'
          ? 'Device commands require the Operator role'
          : 'Device configuration requires the Engineer role',
      );
    }
    return scope;
  }

  private audit(
    context: RequestContext,
    scope: FleetScope,
    intent: string,
  ): DeviceConfigurationAudit {
    return { ...scope, actorId: context.userId ?? `demo-tenant:${scope.tenantId}`, intent };
  }

  private async lookupBatch(
    context: RequestContext,
    scope: FleetScope,
    batchId: string,
  ): Promise<FleetDeviceConfigurationBatch | null> {
    for (const type of this.adapters.enabledTypes('getConfigurationBatch')) {
      const batch = await this.adapters
        .for(type)
        .getConfigurationBatch({ ...scope, batchId }, context);
      if (batch) {
        const imeis = [...new Set(batch.changes.map(({ imei }) => imei))];
        if ((await this.devices.countByImeis(scope, type, imeis)) !== imeis.length) {
          throw new NotFoundException('Configuration batch Device not found in the active Branch');
        }
        return batch;
      }
    }
    return null;
  }

  private async submit<T extends object>(
    type: FleetDeviceType,
    method: keyof DeviceAdapter,
    path: string,
    operation: (adapter: DeviceAdapter) => Promise<DeviceConfigurationOutcome<T>>,
  ): Promise<T> {
    if (this.adapters.enabled(type, method)) {
      const outcome = await operation(this.adapters.for(type));
      if (!('code' in outcome)) {
        return outcome;
      }
    }
    return invalid(
      path,
      DEVICE_CONFIGURATION_UNSUPPORTED.message,
      DEVICE_CONFIGURATION_UNSUPPORTED.code,
    );
  }
}
