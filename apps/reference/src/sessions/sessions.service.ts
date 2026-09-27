import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventHistoryRepository } from '../events/event-history.repository.js';
import { historyChanges, sessionHistoryValues } from '../events/event-history.js';
import { EventsRepository } from '../events/events.repository.js';
import type {
  CreateReferenceSessionInput,
  UpdateReferenceSessionInput,
  ReferenceSession,
  ReferenceSpeaker,
} from '../generated/graphql/types.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { RequestContext } from '../graphql/request-context.js';
import {
  ids,
  instant,
  invalid,
  optionalText,
  persistenceError,
  text,
  uuid,
} from '../validation.js';
import { SessionsRepository, type SessionRow } from './sessions.repository.js';

type SessionResult = Omit<ReferenceSession, 'speakers'> & {
  speakers: Omit<ReferenceSpeaker, 'store'>[];
};
function result(row: SessionRow): SessionResult {
  return {
    ...row,
    speakerIds: row.speakers.map((link) => link.speakerId),
    speakers: row.speakers.map((link) => link.speaker),
  };
}
function fields(
  input: CreateReferenceSessionInput | UpdateReferenceSessionInput,
  event: { startsAt: Date; endsAt: Date },
) {
  const startsAt = instant(input.startsAt, 'startsAt'),
    endsAt = instant(input.endsAt, 'endsAt');
  if (endsAt <= startsAt) invalid('endsAt', 'End must be after start.');
  if (startsAt < event.startsAt) invalid('startsAt', 'The session must start within the event.');
  if (endsAt > event.endsAt) invalid('endsAt', 'The session must end within the event.');
  return {
    title: text(input.title, 'title', 200),
    summary: optionalText(input.summary, 'summary', 2000),
    room: optionalText(input.room, 'room', 120),
    startsAt,
    endsAt,
  };
}

@Injectable()
export class SessionsService {
  constructor(
    private readonly sessions: SessionsRepository,
    private readonly events: EventsRepository,
    private readonly history: EventHistoryRepository,
  ) {}
  async list(context: RequestContext, parentId: string) {
    const storeId = uuid(context.storeId, 'x-store-id'),
      eventId = uuid(parentId, 'eventId');
    if (!(await this.events.find(storeId, eventId))) throw new NotFoundException('Event not found');
    return (await this.sessions.list(storeId, eventId)).map(result);
  }
  async find(context: RequestContext, parentId: string, id: string) {
    const row = await this.sessions.find(
      uuid(context.storeId, 'x-store-id'),
      uuid(parentId, 'eventId'),
      uuid(id, 'id'),
    );
    if (!row) throw new NotFoundException('Session not found');
    return result(row);
  }
  private async speakers(
    tx: Prisma.TransactionClient,
    storeId: string,
    value: unknown,
    existing?: SessionRow,
  ) {
    const selected = ids(value, 'speakerIds');
    const added = selected.filter(
      (id) => !existing?.speakers.some((link) => link.speakerId === id),
    );
    if (added.length) {
      const speakers = await this.sessions.speakers(tx, storeId, added);
      if (speakers.length !== added.length || speakers.some((speaker) => !speaker.active))
        invalid('speakerIds', 'Choose active speakers in this store.');
    }
    return selected;
  }
  async create(context: RequestContext, parentId: string, input: CreateReferenceSessionInput) {
    const storeId = uuid(context.storeId, 'x-store-id'),
      eventId = uuid(parentId, 'eventId');
    try {
      return await this.events.withLockedEvent(storeId, eventId, async (event, tx) => {
        const data = fields(input, event);
        const positions = await this.sessions.positions(tx, storeId, eventId);
        if (positions._count >= 100)
          throw new ConflictException('An event can have at most 100 sessions.');
        const speakerIds = await this.speakers(
          tx,
          storeId,
          input.speakerIds === undefined ? [] : input.speakerIds,
        );
        const row = await this.sessions.create(
          tx,
          storeId,
          eventId,
          data,
          speakerIds,
          (positions._max.position ?? -1) + 1,
        );
        await this.history.record(
          tx,
          storeId,
          eventId,
          'SESSION_CREATED',
          historyChanges({}, sessionHistoryValues(row)),
          row.title,
        );
        return result(row);
      });
    } catch (error) {
      persistenceError(error, 'Session');
    }
  }
  async update(
    context: RequestContext,
    parentId: string,
    sessionId: string,
    input: UpdateReferenceSessionInput,
  ) {
    const storeId = uuid(context.storeId, 'x-store-id'),
      eventId = uuid(parentId, 'eventId'),
      id = uuid(sessionId, 'id');
    if (!Object.keys(input).length)
      throw new BadRequestException('Provide at least one session field to update');
    try {
      return await this.events.withLockedEvent(storeId, eventId, async (event, tx) => {
        const row = await this.sessions.find(storeId, eventId, id, tx);
        if (!row) throw new NotFoundException('Session not found');
        const data = fields({ ...row, ...input }, event);
        const speakerIds =
          input.speakerIds === undefined
            ? undefined
            : await this.speakers(tx, storeId, input.speakerIds, row);
        const updated = await this.sessions.update(tx, storeId, eventId, id, data, speakerIds);
        const changes = historyChanges(sessionHistoryValues(row), sessionHistoryValues(updated));
        if (changes.length)
          await this.history.record(
            tx,
            storeId,
            eventId,
            'SESSION_UPDATED',
            changes,
            updated.title,
          );
        return result(updated);
      });
    } catch (error) {
      persistenceError(error, 'Session');
    }
  }
  async delete(context: RequestContext, parentId: string, sessionId: string) {
    const storeId = uuid(context.storeId, 'x-store-id'),
      eventId = uuid(parentId, 'eventId'),
      id = uuid(sessionId, 'id');
    try {
      return await this.events.withLockedEvent(storeId, eventId, async (_event, tx) => {
        const row = await this.sessions.delete(tx, storeId, eventId, id);
        await this.history.record(tx, storeId, eventId, 'SESSION_DELETED', [], row.title);
        return result(row);
      });
    } catch (error) {
      persistenceError(error, 'Session');
    }
  }
  async reorder(context: RequestContext, parentId: string, value: string[]) {
    const storeId = uuid(context.storeId, 'x-store-id'),
      eventId = uuid(parentId, 'eventId'),
      ordered = ids(value, 'ids');
    return this.events.withLockedEvent(storeId, eventId, async (_event, tx) => {
      const rows = await this.sessions.list(storeId, eventId, tx);
      if (rows.length !== ordered.length || rows.some((row) => !ordered.includes(row.id)))
        throw new ConflictException(
          'The session list changed. Cancel the draft to reload it, then arrange it again.',
        );
      const updated = await this.sessions.reorder(tx, storeId, eventId, ordered);
      const order = (items: SessionRow[]) =>
        items.map((row) => `${row.title} (${row.id})`).join(', ');
      const changes = historyChanges(
        { sessionOrder: order(rows) },
        { sessionOrder: order(updated) },
      );
      if (changes.length)
        await this.history.record(tx, storeId, eventId, 'SESSIONS_REORDERED', changes);
      return updated.map(result);
    });
  }
}
