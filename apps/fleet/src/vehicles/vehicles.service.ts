import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { requireTenant } from '../graphql/demo-auth.js';
import { CoreClient } from '../core/core.client.js';
import type {
  CreateFleetVehicleInput,
  UpdateFleetVehicleInput,
  QueryFleetVehiclesArgs,
  FleetVehicle,
  FleetVehiclePage,
} from '../generated/graphql/types.js';
import type { RequestContext } from '../graphql/request-context.js';
import {
  uuid,
  text,
  invalid,
  pagination,
  ids,
  persistenceError,
  optionalText,
} from '../validation.js';
import { VehiclesRepository } from './vehicles.repository.js';
export type VehicleResult = Omit<FleetVehicle, 'store'>;
@Injectable()
export class VehiclesService {
  constructor(
    private readonly vehicles: VehiclesRepository,
    private readonly core: CoreClient,
  ) {}
  list(
    context: RequestContext,
    args: QueryFleetVehiclesArgs,
  ): Promise<Omit<FleetVehiclePage, 'items'> & { items: VehicleResult[] }> {
    const tenantId = requireTenant(context);
    const storeId = uuid(context.storeId, 'x-store-id');
    const { offset, limit } = pagination(args);
    const field: unknown = args.sort?.field ?? 'CREATED_AT';
    const direction: unknown = args.sort?.direction ?? 'DESC';
    if (field !== 'LICENSE_PLATE' && field !== 'CREATED_AT')
      invalid('sort.field', 'Choose a supported vehicle sort field.');
    if (direction !== 'ASC' && direction !== 'DESC')
      invalid('sort.direction', 'Choose ASC or DESC.');
    return this.vehicles.list(
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
  async find(context: RequestContext, id: string): Promise<VehicleResult> {
    const row = await this.vehicles.find(
      requireTenant(context),
      uuid(context.storeId, 'x-store-id'),
      uuid(id, 'id'),
    );
    if (!row) throw new NotFoundException('Vehicle not found');
    return row;
  }
  async create(context: RequestContext, input: CreateFleetVehicleInput): Promise<VehicleResult> {
    const tenantId = requireTenant(context);
    const storeId = uuid(context.storeId, 'x-store-id');
    const data: CreateFleetVehicleInput = {
      licensePlate: text(input.licensePlate, 'licensePlate', 32),
      notes: optionalText(input.notes, 'notes', 2000),
    };
    await this.core.requireStore(storeId, context);
    try {
      return await this.vehicles.create(tenantId, storeId, data);
    } catch (error) {
      persistenceError(error, 'Vehicle');
    }
  }
  async update(
    context: RequestContext,
    id: string,
    input: UpdateFleetVehicleInput,
  ): Promise<VehicleResult> {
    const tenantId = requireTenant(context);
    const storeId = uuid(context.storeId, 'x-store-id'),
      recordId = uuid(id, 'id');
    const data: Partial<CreateFleetVehicleInput> = {};
    if (input.licensePlate !== undefined)
      data.licensePlate = text(input.licensePlate, 'licensePlate', 32);
    if (input.notes !== undefined) data.notes = optionalText(input.notes, 'notes', 2000);
    if (!Object.keys(data).length)
      throw new BadRequestException('Provide at least one vehicle field to update');
    try {
      return await this.vehicles.update(tenantId, storeId, recordId, data);
    } catch (error) {
      persistenceError(error, 'Vehicle');
    }
  }
  async delete(context: RequestContext, id: string): Promise<VehicleResult> {
    const tenantId = requireTenant(context);
    const storeId = uuid(context.storeId, 'x-store-id'),
      recordId = uuid(id, 'id');
    try {
      return await this.vehicles.delete(tenantId, storeId, recordId);
    } catch (error) {
      persistenceError(error, 'Vehicle');
    }
  }
}
