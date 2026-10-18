import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CoreClient } from '../../integrations/core/core.client.js';
import type {
  CreateFleetVehicleGroupInput,
  FleetVehicleGroup,
  FleetVehicleGroupPage,
  FleetVehicleGroupSortField,
  QueryFleetVehicleGroupsArgs,
  UpdateFleetVehicleGroupInput,
} from '../../generated/graphql/types.js';
import { FleetGroupColor } from '../../generated/prisma/enums.js';
import type { RequestContext } from '../../graphql/request-context.js';
import {
  enumValue,
  type FieldError,
  type FleetScope,
  ids,
  invalid,
  optionalEnum,
  optionalText,
  pagination,
  persistenceError,
  requireScope,
  rethrowUniqueViolation,
  searchTokens,
  sortDirection,
  sortField,
  text,
  uuid,
} from '../../validation.js';
import {
  type VehicleGroupData,
  type VehicleGroupRow,
  VehicleGroupsRepository,
} from './vehicle-groups.repository.js';

const GROUP_COLORS = Object.values(FleetGroupColor);
const SORT_FIELDS: readonly FleetVehicleGroupSortField[] = ['NAME', 'CREATED_AT'];

const DUPLICATE_NAME: FieldError = {
  path: 'name',
  message: 'A vehicle group with this name already exists in this branch.',
};
const UNIQUE_INDEXES = new Map([['VehicleGroup_tenantId_branchId_name_key', DUPLICATE_NAME]]);
const DELETE_CONFLICT = 'Vehicle group still contains vehicles; move them first.';

function toGroup(row: VehicleGroupRow): FleetVehicleGroup {
  return {
    id: row.id,
    branchId: row.branchId,
    name: row.name,
    description: row.description,
    colorToken: row.colorToken,
    vehicleCount: row._count.vehicles,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class VehicleGroupsService {
  constructor(
    private readonly groups: VehicleGroupsRepository,
    private readonly core: CoreClient,
  ) {}

  async list(
    context: RequestContext,
    args: QueryFleetVehicleGroupsArgs,
  ): Promise<FleetVehicleGroupPage> {
    const scope = requireScope(context);
    const { offset, limit } = pagination(args);
    const tokens = searchTokens(args.search);
    const selected = args.ids == null ? undefined : ids(args.ids, 'ids');
    const sort = {
      field: sortField(args.sort?.field, SORT_FIELDS, 'NAME'),
      direction: sortDirection(args.sort?.direction, 'ASC'),
    };
    const page = await this.groups.list(scope, { offset, limit }, { tokens, ids: selected }, sort);
    return {
      items: page.items.map(toGroup),
      total: page.total,
      offset,
      limit,
      ungroupedVehicleCount: page.ungroupedVehicleCount,
    };
  }

  async find(context: RequestContext, id: string): Promise<FleetVehicleGroup> {
    const row = await this.groups.find(requireScope(context), uuid(id, 'id'));
    if (!row) throw new NotFoundException('Vehicle group not found');
    return toGroup(row);
  }

  async create(
    context: RequestContext,
    input: CreateFleetVehicleGroupInput,
  ): Promise<FleetVehicleGroup> {
    const scope = requireScope(context);
    const data: VehicleGroupData = {
      name: text(input.name, 'name', 64),
      description: optionalText(input.description, 'description', 500),
      colorToken: optionalEnum(input.colorToken, GROUP_COLORS, 'colorToken') ?? 'C1',
    };
    await this.requireUniqueName(scope, data.name, null);
    await this.core.requireBranch(scope.branchId, context);
    try {
      return toGroup(await this.groups.create(scope, data));
    } catch (error) {
      this.writeError(error);
    }
  }

  async update(
    context: RequestContext,
    id: string,
    input: UpdateFleetVehicleGroupInput,
  ): Promise<FleetVehicleGroup> {
    const scope = requireScope(context);
    const recordId = uuid(id, 'id');
    const data: Partial<VehicleGroupData> = {};
    if (input.name !== undefined) data.name = text(input.name, 'name', 64);
    if (input.description !== undefined)
      data.description = optionalText(input.description, 'description', 500);
    if (input.colorToken !== undefined)
      data.colorToken = enumValue(input.colorToken, GROUP_COLORS, 'colorToken');
    if (!Object.keys(data).length)
      throw new BadRequestException('Provide at least one vehicle group field to update');
    if (data.name !== undefined) await this.requireUniqueName(scope, data.name, recordId);
    try {
      return toGroup(await this.groups.update(scope, recordId, data));
    } catch (error) {
      this.writeError(error);
    }
  }

  async delete(context: RequestContext, id: string): Promise<FleetVehicleGroup> {
    const scope = requireScope(context);
    const recordId = uuid(id, 'id');
    try {
      return toGroup(await this.groups.delete(scope, recordId));
    } catch (error) {
      persistenceError(error, 'Vehicle group', DELETE_CONFLICT);
    }
  }

  private async requireUniqueName(
    scope: FleetScope,
    name: string,
    excludeId: string | null,
  ): Promise<void> {
    if (await this.groups.nameTaken(scope, name, excludeId))
      invalid(DUPLICATE_NAME.path, DUPLICATE_NAME.message);
  }

  private writeError(error: unknown): never {
    rethrowUniqueViolation(error, UNIQUE_INDEXES);
    persistenceError(error, 'Vehicle group');
  }
}
