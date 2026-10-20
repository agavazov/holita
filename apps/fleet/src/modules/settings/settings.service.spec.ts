import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import type { UpdateFleetSettingsInput } from '../../generated/graphql/types.js';
import { CoreClient } from '../../integrations/core/core.client.js';
import { defaultFleetSettings } from './settings-defaults.js';
import { SettingsRepository } from './settings.repository.js';
import { SettingsService } from './settings.service.js';

describe('Fleet settings validation and scope', () => {
  const read = jest.fn<SettingsRepository['read']>();
  const replace = jest.fn<SettingsRepository['replace']>();
  const requireBranch = jest.fn<CoreClient['requireBranch']>();
  const context = {
    tenantId: randomUUID(),
    branchId: randomUUID(),
    requestId: randomUUID(),
    authorization: undefined,
    branchChecks: new Map<string, Promise<void>>(),
  };
  const scope = { tenantId: context.tenantId, branchId: context.branchId };
  let service: SettingsService;
  beforeEach(async () => {
    jest.resetAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: SettingsRepository, useValue: { read, replace } },
        { provide: CoreClient, useValue: { requireBranch } },
      ],
    }).compile();
    service = module.get(SettingsService);
    read.mockResolvedValue(null);
    replace.mockResolvedValue(defaultFleetSettings());
  });

  it('returns scoped defaults without creating a row or checking Core on a read', async () => {
    await expect(service.find(context)).resolves.toEqual(defaultFleetSettings());
    expect(read).toHaveBeenCalledWith(scope);
    expect(replace).not.toHaveBeenCalled();
    expect(requireBranch).not.toHaveBeenCalled();
  });

  it('validates and replaces all fields only after verifying the tenant-scoped Core Branch', async () => {
    const input: UpdateFleetSettingsInput = {
      timeZone: 'Europe/Belgrade',
      distanceUnit: 'MI',
      volumeUnit: 'US_GALLON',
      lowFuelPct: 1,
      notReportingHours: 168,
      speedLimitKph: 130,
    };
    replace.mockResolvedValue(input);
    await expect(service.update(context, input)).resolves.toEqual(input);
    expect(requireBranch).toHaveBeenCalledWith(scope.branchId, context);
    expect(replace).toHaveBeenCalledWith(scope, input);
    requireBranch.mockRejectedValue(new NotFoundException('Branch not found'));
    replace.mockClear();
    await expect(service.update(context, input)).rejects.toThrow('Branch not found');
    expect(replace).not.toHaveBeenCalled();
  });

  it.each([
    { timeZone: 'UTC' },
    { lowFuelPct: 0 },
    { lowFuelPct: 51 },
    { notReportingHours: 0 },
    { notReportingHours: 169 },
    { speedLimitKph: 29 },
    { speedLimitKph: 131 },
    { lowFuelPct: 1.5 },
  ] satisfies Partial<UpdateFleetSettingsInput>[])(
    'rejects invalid settings before Core or persistence: %j',
    async (fields) => {
      await expect(
        service.update(context, { ...defaultFleetSettings(), ...fields }),
      ).rejects.toThrow(BadRequestException);
      expect(requireBranch).not.toHaveBeenCalled();
      expect(replace).not.toHaveBeenCalled();
    },
  );

  it('rejects invalid Branch scope before reading', () => {
    expect(() => service.find({ ...context, branchId: 'invalid' })).toThrow(BadRequestException);
    expect(read).not.toHaveBeenCalled();
  });
});
