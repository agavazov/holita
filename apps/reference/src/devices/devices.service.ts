import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { requireTenant } from '../graphql/demo-auth.js';
import { CoreClient } from '../core/core.client.js';
import type {
  CreateReferenceDeviceInput,
  UpdateReferenceDeviceInput,
  QueryReferenceDevicesArgs,
  ReferenceDevice,
  ReferenceDevicePage,
} from '../generated/graphql/types.js';
import type { RequestContext } from '../graphql/request-context.js';
import { uuid, invalid, pagination, ids, persistenceError, optionalText } from '../validation.js';
import { Prisma } from '../generated/prisma/client.js';
import { DevicesRepository } from './devices.repository.js';
export type DeviceResult = Omit<ReferenceDevice, 'store' | 'vehicle'>;
@Injectable()
export class DevicesService {
  constructor(
    private readonly devices: DevicesRepository,
    private readonly core: CoreClient,
  ) {}
  list(
    context: RequestContext,
    args: QueryReferenceDevicesArgs,
  ): Promise<Omit<ReferenceDevicePage, 'items'> & { items: DeviceResult[] }> {
    const tenantId = requireTenant(context);
    const storeId = uuid(context.storeId, 'x-store-id');
    const { offset, limit } = pagination(args);
    const field: unknown = args.sort?.field ?? 'CREATED_AT';
    const direction: unknown = args.sort?.direction ?? 'DESC';
    if (field !== 'IMEI' && field !== 'CREATED_AT')
      invalid('sort.field', 'Choose a supported device sort field.');
    if (direction !== 'ASC' && direction !== 'DESC')
      invalid('sort.direction', 'Choose ASC or DESC.');
    return this.devices.list(
      tenantId,
      storeId,
      offset,
      limit,
      {
        search: optionalText(args.search, 'search', 200),
        ids: args.ids == null ? undefined : ids(args.ids, 'ids'),
      },
      { field, direction },
    );
  }
  async find(context: RequestContext, id: string): Promise<DeviceResult> {
    const row = await this.devices.find(
      requireTenant(context),
      uuid(context.storeId, 'x-store-id'),
      uuid(id, 'id'),
    );
    if (!row) throw new NotFoundException('Device not found');
    return row;
  }
  async create(context: RequestContext, input: CreateReferenceDeviceInput): Promise<DeviceResult> {
    const tenantId = requireTenant(context);
    const storeId = uuid(context.storeId, 'x-store-id');
    const data: CreateReferenceDeviceInput = {
      imei: this.imei(input.imei),
      vehicleId: uuid(input.vehicleId, 'vehicleId'),
    };
    await this.requireVehicle(tenantId, storeId, data.vehicleId);
    await this.core.requireStore(storeId, context);
    try {
      return await this.devices.create(tenantId, storeId, data);
    } catch (error) {
      this.writeError(error);
    }
  }
  async update(
    context: RequestContext,
    id: string,
    input: UpdateReferenceDeviceInput,
  ): Promise<DeviceResult> {
    const tenantId = requireTenant(context);
    const storeId = uuid(context.storeId, 'x-store-id'),
      recordId = uuid(id, 'id');
    const data: Partial<CreateReferenceDeviceInput> = {};
    if (input.imei !== undefined) data.imei = this.imei(input.imei);
    if (input.vehicleId !== undefined) {
      data.vehicleId = uuid(input.vehicleId, 'vehicleId');
      await this.requireVehicle(tenantId, storeId, data.vehicleId);
    }
    if (!Object.keys(data).length)
      throw new BadRequestException('Provide at least one device field to update');
    try {
      return await this.devices.update(tenantId, storeId, recordId, data);
    } catch (error) {
      this.writeError(error);
    }
  }
  private imei(value: unknown): string {
    const imei = typeof value === 'string' ? value.trim() : '';
    if (!/^[0-9]{15}$/.test(imei)) invalid('imei', 'Enter an IMEI of exactly 15 digits.');
    return imei;
  }
  private async requireVehicle(
    tenantId: string,
    storeId: string,
    vehicleId: string,
  ): Promise<void> {
    if (!(await this.devices.findVehicle(tenantId, storeId, vehicleId)))
      invalid('vehicleId', 'Choose a vehicle in this store.');
  }
  private writeError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') invalid('imei', 'IMEI is already used in this store.');
      if (error.code === 'P2003') invalid('vehicleId', 'Choose a vehicle in this store.');
    }
    persistenceError(error, 'Device');
  }
  async delete(context: RequestContext, id: string): Promise<DeviceResult> {
    const tenantId = requireTenant(context);
    const storeId = uuid(context.storeId, 'x-store-id'),
      recordId = uuid(id, 'id');
    try {
      return await this.devices.delete(tenantId, storeId, recordId);
    } catch (error) {
      this.writeError(error);
    }
  }
}
