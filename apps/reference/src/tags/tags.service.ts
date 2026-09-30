import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { CoreClient } from '../core/core.client.js';
import type {
  CreateReferenceTagInput,
  UpdateReferenceTagInput,
  QueryReferenceTagsArgs,
  ReferenceTag,
  ReferenceTagPage,
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
} from '../validation.js';
import { TagsRepository } from './tags.repository.js';
export type TagResult = Omit<ReferenceTag, 'store'>;
function color(value: unknown): string {
  const result = text(value, 'color', 7);
  if (!/^#[0-9a-f]{6}$/i.test(result)) invalid('color', 'Use a six-digit hex color, e.g. #315ed0.');
  return result.toLowerCase();
}
@Injectable()
export class TagsService {
  constructor(
    private readonly tags: TagsRepository,
    private readonly core: CoreClient,
  ) {}
  list(
    context: RequestContext,
    args: QueryReferenceTagsArgs,
  ): Promise<Omit<ReferenceTagPage, 'items'> & { items: TagResult[] }> {
    const storeId = uuid(context.storeId, 'x-store-id');
    const { offset, limit } = pagination(args);
    const field: unknown = args.sort?.field ?? 'CREATED_AT';
    const direction: unknown = args.sort?.direction ?? 'DESC';
    if (field !== 'NAME' && field !== 'COLOR' && field !== 'ACTIVE' && field !== 'CREATED_AT')
      invalid('sort.field', 'Choose a supported tag sort field.');
    if (direction !== 'ASC' && direction !== 'DESC')
      invalid('sort.direction', 'Choose ASC or DESC.');
    return this.tags.list(storeId, offset, limit, lookup(args), { field, direction });
  }
  async find(context: RequestContext, id: string): Promise<TagResult> {
    const row = await this.tags.find(uuid(context.storeId, 'x-store-id'), uuid(id, 'id'));
    if (!row) throw new NotFoundException('Tag not found');
    return row;
  }
  async create(context: RequestContext, input: CreateReferenceTagInput): Promise<TagResult> {
    const storeId = uuid(context.storeId, 'x-store-id');
    const data: CreateReferenceTagInput = {
      name: text(input.name, 'name', 100),
      color: color(input.color),
      active: boolean(input.active === undefined ? true : input.active, 'active'),
    };
    await this.core.requireStore(storeId, context);
    try {
      return await this.tags.create(storeId, data);
    } catch (error) {
      persistenceError(error, 'Tag');
    }
  }
  async update(
    context: RequestContext,
    id: string,
    input: UpdateReferenceTagInput,
  ): Promise<TagResult> {
    const storeId = uuid(context.storeId, 'x-store-id'),
      recordId = uuid(id, 'id');
    const data: Partial<CreateReferenceTagInput> = {};
    if (input.name !== undefined) data.name = text(input.name, 'name', 100);
    if (input.color !== undefined) data.color = color(input.color);
    if (input.active !== undefined) data.active = boolean(input.active, 'active');
    if (!Object.keys(data).length)
      throw new BadRequestException('Provide at least one tag field to update');
    try {
      return await this.tags.update(storeId, recordId, data);
    } catch (error) {
      persistenceError(error, 'Tag');
    }
  }
  async delete(context: RequestContext, id: string): Promise<TagResult> {
    const storeId = uuid(context.storeId, 'x-store-id'),
      recordId = uuid(id, 'id');
    try {
      return await this.tags.delete(storeId, recordId);
    } catch (error) {
      persistenceError(error, 'Tag');
    }
  }
}
