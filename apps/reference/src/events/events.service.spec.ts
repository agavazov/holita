import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { CoreClient } from '../core/core.client.js';
import { EventHistoryRepository } from './event-history.repository.js';
import { EventsRepository } from './events.repository.js';
import { EventsService } from './events.service.js';
import type { RequestContext } from '../graphql/request-context.js';

describe('Event validation before writes', () => {
  const repository = {
    create: jest.fn<EventsRepository['create']>(),
    tags: jest.fn<EventsRepository['tags']>(),
    venue: jest.fn<EventsRepository['venue']>(),
  };
  const requireStore = jest.fn<CoreClient['requireStore']>();
  const input = {
    title: 'Forum',
    code: 'FORUM',
    format: 'ONLINE' as const,
    meetingUrl: 'https://example.com/meet',
    startsAt: new Date('2026-11-01T12:00:00Z'),
    endsAt: new Date('2026-11-01T14:00:00Z'),
  };
  let service: EventsService;
  let context: RequestContext;
  beforeEach(async () => {
    jest.resetAllMocks();
    repository.tags.mockResolvedValue([]);
    context = { requestId: randomUUID(), storeId: randomUUID(), storeChecks: new Map() };
    const module = await Test.createTestingModule({
      providers: [
        EventsService,
        { provide: EventHistoryRepository, useValue: {} },
        { provide: EventsRepository, useValue: repository },
        { provide: CoreClient, useValue: { requireStore } },
      ],
    }).compile();
    service = module.get(EventsService);
  });
  it('rejects scalar and cross-field errors before relation access or writes', async () => {
    for (const patch of [
      { title: ' ' },
      { budget: '0.001' },
      { startsAt: input.endsAt },
      { meetingUrl: 'file:///private' },
      { registrationOpensOn: '2026-01-01' },
    ])
      await expect(service.create(context, { ...input, ...patch })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    expect(repository.tags).not.toHaveBeenCalled();
    expect(requireStore).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
  });
  it('does not write when a relation belongs elsewhere or Core is unavailable', async () => {
    await expect(
      service.create(context, { ...input, tagIds: [randomUUID()] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(requireStore).not.toHaveBeenCalled();
    requireStore.mockRejectedValue(new ServiceUnavailableException());
    await expect(service.create(context, input)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(repository.create).not.toHaveBeenCalled();
  });
});
