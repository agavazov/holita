import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { isEmail } from 'class-validator';
import { CoreClient } from '../core/core.client.js';
import type {
  CreateReferenceSpeakerInput,
  UpdateReferenceSpeakerInput,
  QueryReferenceSpeakersArgs,
  ReferenceSpeaker,
  ReferenceSpeakerPage,
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
} from '../validation.js';
import { SpeakersRepository } from './speakers.repository.js';
export type SpeakerResult = Omit<ReferenceSpeaker, 'store'>;
function email(value: unknown): string | null {
  const result = optionalText(value, 'email', 254);
  if (result && !isEmail(result)) invalid('email', 'Enter a valid email address.');
  return result;
}
@Injectable()
export class SpeakersService {
  constructor(
    private readonly speakers: SpeakersRepository,
    private readonly core: CoreClient,
  ) {}
  list(
    context: RequestContext,
    args: QueryReferenceSpeakersArgs,
  ): Promise<Omit<ReferenceSpeakerPage, 'items'> & { items: SpeakerResult[] }> {
    const storeId = uuid(context.storeId, 'x-store-id');
    const { offset, limit } = pagination(args);
    const field: unknown = args.sort?.field ?? 'CREATED_AT';
    const direction: unknown = args.sort?.direction ?? 'DESC';
    if (field !== 'NAME' && field !== 'EMAIL' && field !== 'ACTIVE' && field !== 'CREATED_AT')
      invalid('sort.field', 'Choose a supported speaker sort field.');
    if (direction !== 'ASC' && direction !== 'DESC')
      invalid('sort.direction', 'Choose ASC or DESC.');
    return this.speakers.list(storeId, offset, limit, lookup(args), { field, direction });
  }
  async find(context: RequestContext, id: string): Promise<SpeakerResult> {
    const row = await this.speakers.find(uuid(context.storeId, 'x-store-id'), uuid(id, 'id'));
    if (!row) throw new NotFoundException('Speaker not found');
    return row;
  }
  async create(
    context: RequestContext,
    input: CreateReferenceSpeakerInput,
  ): Promise<SpeakerResult> {
    const storeId = uuid(context.storeId, 'x-store-id');
    const data: CreateReferenceSpeakerInput = {
      name: text(input.name, 'name', 200),
      email: email(input.email),
      shortBio: optionalText(input.shortBio, 'shortBio', 2000),
      active: boolean(input.active === undefined ? true : input.active, 'active'),
    };
    await this.core.requireStore(storeId, context);
    try {
      return await this.speakers.create(storeId, data);
    } catch (error) {
      persistenceError(error, 'Speaker');
    }
  }
  async update(
    context: RequestContext,
    id: string,
    input: UpdateReferenceSpeakerInput,
  ): Promise<SpeakerResult> {
    const storeId = uuid(context.storeId, 'x-store-id'),
      recordId = uuid(id, 'id');
    const data: Partial<CreateReferenceSpeakerInput> = {};
    if (input.name !== undefined) data.name = text(input.name, 'name', 200);
    if (input.email !== undefined) data.email = email(input.email);
    if (input.shortBio !== undefined)
      data.shortBio = optionalText(input.shortBio, 'shortBio', 2000);
    if (input.active !== undefined) data.active = boolean(input.active, 'active');
    if (!Object.keys(data).length)
      throw new BadRequestException('Provide at least one speaker field to update');
    try {
      return await this.speakers.update(storeId, recordId, data);
    } catch (error) {
      persistenceError(error, 'Speaker');
    }
  }
  async delete(context: RequestContext, id: string): Promise<SpeakerResult> {
    const storeId = uuid(context.storeId, 'x-store-id'),
      recordId = uuid(id, 'id');
    try {
      return await this.speakers.delete(storeId, recordId);
    } catch (error) {
      persistenceError(error, 'Speaker');
    }
  }
}
