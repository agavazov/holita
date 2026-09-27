import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { CoreClient } from '../core/core.client.js';
import type {
  CreateReferenceEventInput,
  UpdateReferenceEventInput,
  QueryReferenceEventsArgs,
  QueryReferenceEventHistoryArgs,
  ReferenceEvent,
  ReferenceEventStatus,
  ReferenceEventFormat,
  ReferenceEventFilter,
  ReferenceEventSort,
  ReferenceVenue,
  ReferenceTag,
} from '../generated/graphql/types.js';
import type { RequestContext } from '../graphql/request-context.js';
import {
  uuid,
  text,
  optionalText,
  boolean,
  capacity,
  ids,
  pagination,
  invalid,
  instant,
  persistenceError,
} from '../validation.js';
import { EventHistoryRepository } from './event-history.repository.js';
import { eventHistoryValues, historyChanges } from './event-history.js';
import { descriptionHtml } from './description-html.js';
import { EventsRepository, type EventRow, type EventWrite } from './events.repository.js';

export type EventResult = Omit<ReferenceEvent, 'store' | 'venue' | 'tags'> & {
  venue: Omit<ReferenceVenue, 'store'> | null;
  tags: Omit<ReferenceTag, 'store'>[];
};
function result(row: EventRow): EventResult {
  const { tags, budget, registrationOpensOn, registrationClosesOn, ...fields } = row;
  return {
    ...fields,
    budget: budget?.toFixed(2) ?? null,
    registrationOpensOn: registrationOpensOn?.toISOString().slice(0, 10) ?? null,
    registrationClosesOn: registrationClosesOn?.toISOString().slice(0, 10) ?? null,
    tagIds: tags.map((tag) => tag.tagId),
    tags: tags.map((link) => link.tag),
  };
}
function status(value: unknown): ReferenceEventStatus {
  if (value !== 'DRAFT' && value !== 'PUBLISHED' && value !== 'ARCHIVED')
    invalid('status', 'Choose a valid status.');
  return value;
}
function format(value: unknown): ReferenceEventFormat {
  if (value !== 'IN_PERSON' && value !== 'ONLINE' && value !== 'HYBRID')
    invalid('format', 'Choose an event format.');
  return value;
}
function date(value: unknown, path: string): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    invalid(path, 'Use YYYY-MM-DD.');
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value)
    invalid(path, 'Enter a valid calendar date.');
  return value;
}
function budget(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' || !/^(0|[1-9]\d{0,9})(\.\d{1,2})?$/.test(value))
    invalid('budget', 'Enter an amount from 0 to 9999999999.99 with at most two decimals.');
  return value;
}
function meetingUrl(value: unknown): string | null {
  const raw = optionalText(value, 'meetingUrl', 2000);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol === 'http:' || url.protocol === 'https:') return raw;
  } catch {
    /* Report a field error below. */
  }
  invalid('meetingUrl', 'Enter an http or https meeting URL.');
}
function fields(
  input: CreateReferenceEventInput | (UpdateReferenceEventInput & { code: string }),
): { data: EventWrite; tagIds: string[] } {
  const kind = format(input.format);
  const startsAt = instant(input.startsAt, 'startsAt'),
    endsAt = instant(input.endsAt, 'endsAt');
  if (endsAt <= startsAt) invalid('endsAt', 'End must be after start.');
  const opens = date(input.registrationOpensOn, 'registrationOpensOn'),
    closes = date(input.registrationClosesOn, 'registrationClosesOn');
  const startDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Sofia',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(startsAt);
  if (Boolean(opens) !== Boolean(closes))
    invalid(
      opens ? 'registrationClosesOn' : 'registrationOpensOn',
      'Provide both registration dates.',
    );
  if (opens && closes && opens > closes)
    invalid('registrationClosesOn', 'Registration must close on or after opening.');
  if (closes && closes > startDate)
    invalid(
      'registrationClosesOn',
      'Registration must close by the event start date in Europe/Sofia.',
    );
  const venueId = kind === 'ONLINE' ? null : uuid(input.venueId, 'venueId');
  const url = kind === 'IN_PERSON' ? null : meetingUrl(input.meetingUrl);
  if (kind !== 'IN_PERSON' && !url) invalid('meetingUrl', 'Enter a meeting URL for this format.');
  return {
    tagIds: ids(input.tagIds === undefined ? [] : input.tagIds, 'tagIds'),
    data: {
      title: text(input.title, 'title', 200),
      code: text(input.code, 'code', 100),
      status: status(input.status === undefined ? 'DRAFT' : input.status),
      format: kind,
      capacity: capacity(input.capacity),
      budget: budget(input.budget),
      featured: boolean(input.featured === undefined ? false : input.featured, 'featured'),
      startsAt,
      endsAt,
      registrationOpensOn: opens ? new Date(`${opens}T00:00:00Z`) : null,
      registrationClosesOn: closes ? new Date(`${closes}T00:00:00Z`) : null,
      venueId,
      meetingUrl: url,
      summary: optionalText(input.summary, 'summary', 500),
      descriptionHtml: descriptionHtml(input.descriptionHtml),
    },
  };
}

@Injectable()
export class EventsService {
  constructor(
    private readonly events: EventsRepository,
    private readonly core: CoreClient,
    private readonly history: EventHistoryRepository,
  ) {}
  async list(context: RequestContext, args: QueryReferenceEventsArgs) {
    const storeId = uuid(context.storeId, 'x-store-id'),
      { offset, limit } = pagination(args);
    const filter: ReferenceEventFilter = { ...args.filter };
    filter.search = optionalText(filter.search, 'search', 200);
    if (filter.statuses) filter.statuses = filter.statuses.map(status);
    if (filter.formats) filter.formats = filter.formats.map(format);
    if (filter.venueIds) filter.venueIds = ids(filter.venueIds, 'venueIds');
    if (filter.tagIds) filter.tagIds = ids(filter.tagIds, 'tagIds');
    if (filter.featured != null) boolean(filter.featured, 'featured');
    if (filter.trashed != null) boolean(filter.trashed, 'trashed');
    for (const key of ['startsAtFrom', 'startsAtBefore'] as const)
      if (filter[key] != null) instant(filter[key], key);
    if (
      filter.startsAtFrom &&
      filter.startsAtBefore &&
      filter.startsAtFrom >= filter.startsAtBefore
    )
      invalid('startsAtBefore', 'The end boundary must be after the start.');
    for (const key of ['capacityMin', 'capacityMax'] as const) {
      const value = filter[key];
      if (value != null && (!Number.isInteger(value) || value < 1 || value > 2147483647))
        invalid(key, 'Enter a positive whole number up to 2147483647.');
    }
    if (
      filter.capacityMin != null &&
      filter.capacityMax != null &&
      filter.capacityMin > filter.capacityMax
    )
      invalid('capacityMax', 'Maximum capacity must be at least the minimum.');
    const sort: Required<ReferenceEventSort> = {
      field: args.sort?.field ?? 'STARTS_AT',
      direction: args.sort?.direction ?? 'ASC',
    };
    if (
      !['TITLE', 'STARTS_AT', 'STATUS', 'CAPACITY', 'BUDGET', 'CREATED_AT'].includes(sort.field) ||
      !['ASC', 'DESC'].includes(sort.direction)
    )
      invalid('sort', 'Choose a supported sort.');
    const page = await this.events.list(storeId, offset, limit, filter, sort);
    return { ...page, items: page.items.map(result) };
  }
  async find(context: RequestContext, id: string, includeDeleted = false): Promise<EventResult> {
    const row = await this.events.find(
      uuid(context.storeId, 'x-store-id'),
      uuid(id, 'id'),
      includeDeleted,
    );
    if (!row) throw new NotFoundException('Event not found');
    return result(row);
  }
  private async relations(
    storeId: string,
    venueId: string | null | undefined,
    tagIds: string[],
    existing?: EventResult,
    tx?: Prisma.TransactionClient,
  ) {
    if (venueId && venueId !== existing?.venueId) {
      const venue = await this.events.venue(storeId, venueId, tx);
      if (!venue?.active) invalid('venueId', 'Choose an active venue in this store.');
    }
    const added = tagIds.filter((id) => !existing?.tagIds.includes(id));
    if (added.length) {
      const tags = await this.events.tags(storeId, added, tx);
      if (tags.length !== added.length || tags.some((tag) => !tag.active))
        invalid('tagIds', 'Choose active tags in this store.');
    }
  }
  async create(context: RequestContext, input: CreateReferenceEventInput): Promise<EventResult> {
    const storeId = uuid(context.storeId, 'x-store-id');
    const { data, tagIds } = fields(input);
    await this.relations(storeId, data.venueId, tagIds);
    await this.core.requireStore(storeId, context);
    try {
      return result(await this.events.create(storeId, data, tagIds));
    } catch (error) {
      persistenceError(error, 'Event');
    }
  }
  async update(
    context: RequestContext,
    id: string,
    input: UpdateReferenceEventInput,
  ): Promise<EventResult> {
    const storeId = uuid(context.storeId, 'x-store-id');
    if (!Object.keys(input).length)
      throw new BadRequestException('Provide at least one event field to update');
    try {
      return await this.events.withLockedEvent(storeId, uuid(id, 'id'), async (row, tx) => {
        const existing = result(row);
        // GraphQL omits absent fields; explicit null still reaches the shared validators.
        const { data, tagIds } = fields({ ...existing, ...input, code: existing.code });
        if (input.startsAt !== undefined || input.endsAt !== undefined) {
          const bounds = await this.events.sessionBounds(tx, storeId, existing.id);
          if (bounds._min.startsAt && data.startsAt > bounds._min.startsAt)
            invalid(
              'startsAt',
              'Start must include all existing sessions. Update the sessions first.',
            );
          if (bounds._max.endsAt && data.endsAt < bounds._max.endsAt)
            invalid('endsAt', 'End must include all existing sessions. Update the sessions first.');
        }
        await this.relations(storeId, data.venueId, tagIds, existing, tx);
        const updated = await this.events.update(
          tx,
          storeId,
          existing.id,
          data,
          input.tagIds === undefined ? undefined : tagIds,
        );
        const changes = historyChanges(eventHistoryValues(row), eventHistoryValues(updated));
        if (changes.length) await this.history.record(tx, storeId, row.id, 'UPDATED', changes);
        return result(updated);
      });
    } catch (error) {
      persistenceError(error, 'Event');
    }
  }
  async historyPage(context: RequestContext, args: QueryReferenceEventHistoryArgs) {
    const storeId = uuid(context.storeId, 'x-store-id'),
      eventId = uuid(args.eventId, 'eventId');
    if (!(await this.events.find(storeId, eventId, true)))
      throw new NotFoundException('Event not found');
    const { offset, limit } = pagination(args);
    return this.history.list(storeId, eventId, offset, limit);
  }
  async delete(context: RequestContext, id: string): Promise<EventResult> {
    const storeId = uuid(context.storeId, 'x-store-id'),
      eventId = uuid(id, 'id');
    return this.events.withLockedEvent(storeId, eventId, async (_row, tx) => {
      const row = await this.events.setDeleted(tx, storeId, eventId, new Date());
      await this.history.record(tx, storeId, eventId, 'TRASHED', []);
      return result(row);
    });
  }
  async restore(context: RequestContext, id: string): Promise<EventResult> {
    const storeId = uuid(context.storeId, 'x-store-id'),
      eventId = uuid(id, 'id');
    return this.events.withLockedEvent(
      storeId,
      eventId,
      async (row, tx) => {
        if (!row.deletedAt) throw new ConflictException('The event is already active.');
        const restored = await this.events.setDeleted(tx, storeId, eventId, null);
        await this.history.record(tx, storeId, eventId, 'RESTORED', []);
        return result(restored);
      },
      true,
    );
  }
  async bulk(
    context: RequestContext,
    values: string[],
    action: 'trash' | 'restore' | ReferenceEventStatus,
  ) {
    const storeId = uuid(context.storeId, 'x-store-id'),
      selected = ids(values, 'ids');
    if (!selected.length) invalid('ids', 'Choose at least one event.');
    const nextStatus = action === 'trash' || action === 'restore' ? null : status(action);
    return this.events.withLockedEvents(storeId, selected, async (rows, tx) => {
      if (rows.some((row) => Boolean(row.deletedAt) !== (action === 'restore')))
        throw new ConflictException(
          'The selection changed. Refresh the list and select events again.',
        );
      const changed = nextStatus ? rows.filter((row) => row.status !== nextStatus) : rows;
      if (changed.length) {
        await this.events.bulk(
          tx,
          storeId,
          changed.map((row) => row.id),
          nextStatus
            ? { status: nextStatus }
            : { deletedAt: action === 'trash' ? new Date() : null },
        );
        await this.history.recordMany(
          tx,
          storeId,
          changed.map((row) => ({
            eventId: row.id,
            operation: nextStatus ? 'UPDATED' : action === 'trash' ? 'TRASHED' : 'RESTORED',
            changes: nextStatus
              ? historyChanges({ status: row.status }, { status: nextStatus })
              : [],
          })),
        );
      }
      return { ids: selected, count: selected.length };
    });
  }
}
