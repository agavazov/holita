import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { CoreClient } from '../core/core.client.js';
import type {
  CreateReferenceVenueInput,
  UpdateReferenceVenueInput,
  QueryReferenceVenuesArgs,
  ReferenceVenue,
  ReferenceVenuePage,
} from '../generated/graphql/types.js';
import type { RequestContext } from '../graphql/request-context.js';
import {
  uuid,
  text,
  boolean,
  invalid,
  pagination,
  lookup,
  persistenceError,
  optionalText,
  capacity,
} from '../validation.js';
import { VenuesRepository } from './venues.repository.js';
export type VenueResult = Omit<ReferenceVenue, 'store'>;
function countryCode(value: unknown): string {
  const code = text(value, 'countryCode', 2).toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) invalid('countryCode', 'Use a two-letter country code.');
  return code;
}
@Injectable()
export class VenuesService {
  constructor(
    private readonly venues: VenuesRepository,
    private readonly core: CoreClient,
  ) {}
  list(
    context: RequestContext,
    args: QueryReferenceVenuesArgs,
  ): Promise<Omit<ReferenceVenuePage, 'items'> & { items: VenueResult[] }> {
    const storeId = uuid(context.storeId, 'x-store-id');
    const { offset, limit } = pagination(args);
    return this.venues.list(storeId, offset, limit, lookup(args));
  }
  async find(context: RequestContext, id: string): Promise<VenueResult> {
    const row = await this.venues.find(uuid(context.storeId, 'x-store-id'), uuid(id, 'id'));
    if (!row) throw new NotFoundException('Venue not found');
    return row;
  }
  async create(context: RequestContext, input: CreateReferenceVenueInput): Promise<VenueResult> {
    const storeId = uuid(context.storeId, 'x-store-id');
    const data: CreateReferenceVenueInput = {
      name: text(input.name, 'name', 200),
      city: text(input.city, 'city', 120),
      countryCode: countryCode(input.countryCode),
      description: optionalText(input.description, 'description', 2000),
      address: optionalText(input.address, 'address', 300),
      capacity: capacity(input.capacity),
      active: boolean(input.active === undefined ? true : input.active, 'active'),
    };
    await this.core.requireStore(storeId, context);
    try {
      return await this.venues.create(storeId, data);
    } catch (error) {
      persistenceError(error, 'Venue');
    }
  }
  async update(
    context: RequestContext,
    id: string,
    input: UpdateReferenceVenueInput,
  ): Promise<VenueResult> {
    const storeId = uuid(context.storeId, 'x-store-id'),
      recordId = uuid(id, 'id');
    const data: Partial<CreateReferenceVenueInput> = {};
    if (input.name !== undefined) data.name = text(input.name, 'name', 200);
    if (input.city !== undefined) data.city = text(input.city, 'city', 120);
    if (input.countryCode !== undefined) data.countryCode = countryCode(input.countryCode);
    if (input.description !== undefined)
      data.description = optionalText(input.description, 'description', 2000);
    if (input.address !== undefined) data.address = optionalText(input.address, 'address', 300);
    if (input.capacity !== undefined) data.capacity = capacity(input.capacity);
    if (input.active !== undefined) data.active = boolean(input.active, 'active');
    if (!Object.keys(data).length)
      throw new BadRequestException('Provide at least one venue field to update');
    try {
      return await this.venues.update(storeId, recordId, data);
    } catch (error) {
      persistenceError(error, 'Venue');
    }
  }
  async delete(context: RequestContext, id: string): Promise<VenueResult> {
    const storeId = uuid(context.storeId, 'x-store-id'),
      recordId = uuid(id, 'id');
    try {
      return await this.venues.delete(storeId, recordId);
    } catch (error) {
      persistenceError(error, 'Venue');
    }
  }
}
