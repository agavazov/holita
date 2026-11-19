import {
  DEVICE_COMMANDS_UNSUPPORTED,
  DEVICE_CONFIGURATION_UNSUPPORTED,
  parseDeviceConfigurationBatch,
  parseDeviceConfigurationBatchLookupResult,
  parseDeviceConfigurationChange,
  parseDeviceConfigurationHistory,
  parseDeviceConfigurationOutcome,
  parseDeviceConfigurationWritesEnabled,
  parseDeviceParameterCatalogPage,
  parseDeviceParameterDefinition,
  parseDeviceParameterDifference,
  parseDeviceParameterSnapshot,
  parseDeviceParameterSnapshotsPage,
  parseDeviceSnapshotValue,
  DEVICE_SERVER_ROUTES,
  parseDeviceActionCatalog,
  parseDeviceAnsweredFaultReads,
  parseDeviceCommand,
  parseDeviceCommandBatch,
  parseDeviceCommandLookup,
  parseDeviceCommandOutcome,
  parseDeviceCommandRequest,
  parseDeviceCommandRequestHistoryResult,
  parseDeviceCommandRequestsPage,
  parseDeviceCommandsPage,
  parseDeviceFaultReadOutcome,
  parseDeviceEventPage,
  parseDeviceEventsRequest,
  parseDeviceHealth,
  parseDeviceLiveSnapshot,
  parseDeviceMessagePage,
  parseDeviceMessagesRequest,
  parseDeviceNotificationPage,
  parseDeviceProblemPage,
  parseDeviceReportPage,
  parseDeviceStateSnapshot,
} from '@discocan/device-contract';
import { expect, it } from '@jest/globals';
import { NestFactory } from '@nestjs/core';
import { randomBytes, randomUUID } from 'node:crypto';
import { AppModule } from './app.module.js';

it('serves the device contract and rejects unauthenticated or malformed device requests', async () => {
  const previousToken = process.env.DEVICE_SERVER_TOKEN;
  const token = randomBytes(32).toString('hex');
  process.env.DEVICE_SERVER_TOKEN = token;
  const app = await NestFactory.create(AppModule, { logger: false });
  try {
    await app.listen(0, '127.0.0.1');
    const baseUrl = await app.getUrl();
    const imei = '123456789012345';
    const invalid = '12345';
    const scope = { tenantId: randomUUID(), branchId: randomUUID() };
    const from = new Date('2026-11-18T00:00:00.000Z');
    const to = new Date('2026-11-19T00:00:00.000Z');
    const reports = { imei, after: 7n, limit: 500 };
    const live = { imeis: [imei] };
    const events = { pageSize: '25', offset: '50', categories: 'ALARM', sortField: 'SEVERITY' };
    const messages = { pageSize: '100', direction: 'ASC' };
    const problems = { ...scope, ...live, from, to, offset: 0, limit: 500 };
    const deviceId = randomUUID();
    const notifications = { ...scope, deviceId, imei, since: from, after: null, limit: 500 };
    const notificationQuery = new URLSearchParams({
      ...scope,
      deviceId,
      since: from.toISOString(),
    });
    const device = { id: deviceId, imei };
    const requestId = randomUUID();
    const batchId = randomUUID();
    const actor = { ...scope, actorId: randomUUID() };
    const options = { expiresInSeconds: 7200, intent: 'Inspect unit' };
    const create = { ...actor, ...options, device, action: 'READ_PARAMETERS', parameters: [100] };
    const list = {
      ...scope,
      offset: 10,
      limit: 20,
      filter: {},
      sort: { field: 'REQUESTED_AT', direction: 'DESC' },
    };
    const requestLookup = { ...scope, requestId };
    const cancel = { ...actor, device, requestId };
    const retry = { ...actor, ...options, requestId };
    const start = { ...actor, ...options, devices: [device], action: 'READ_FAULTS' };
    const batchLookup = { ...scope, batchId };
    const stop = { ...actor, batchId };
    const deviceRequests = { ...scope, device };
    const history = { ...deviceRequests, pageSize: 25, offset: 0, cursor: null };
    const scheduled = {
      ...scope,
      device,
      actorId: 'system:fault-scan',
      intent: 'Scheduled fault read',
    };
    const answered = { ...scope, deviceIds: [deviceId], from, to, count: 20 };
    const parseCommandRequest = (value: unknown) =>
      parseDeviceCommandRequest(value, parseDeviceCommand);
    const parseBatch = (value: unknown) => parseDeviceCommandBatch(value, parseCommandRequest);
    const unsupportedRequest = (value: unknown) => {
      expect(parseDeviceCommandOutcome(value, parseCommandRequest)).toEqual(
        DEVICE_COMMANDS_UNSUPPORTED,
      );
    };
    const unsupportedBatch = (value: unknown) => {
      expect(parseDeviceCommandOutcome(value, parseBatch)).toEqual(DEVICE_COMMANDS_UNSUPPORTED);
    };
    const configuration = { ...actor, intent: 'Configuration fixture' };
    const configurationDevice = { ...configuration, device };
    const measurement = { ...configurationDevice, operation: 'READ', restoreAfter: false };
    const parameter = { parameterId: 'device.parameter-alpha', value: 'value' };
    const parameterChange = { ...configurationDevice, ...parameter, restoreAfter: false };
    const parameterSet = { ...configurationDevice, parameters: [parameter], restoreAfter: false };
    const configurationBatch = {
      ...configuration,
      devices: [device],
      parameters: [parameter],
      restoreAfter: false,
    };
    const stopConfigurationBatch = { ...configuration, batchId };
    const parseSnapshot = (value: unknown) =>
      parseDeviceParameterSnapshot(value, parseDeviceSnapshotValue, parseDeviceParameterDifference);
    const parseConfigurationBatch = (value: unknown) =>
      parseDeviceConfigurationBatch(value, parseDeviceConfigurationChange);
    const unsupportedConfiguration = (value: unknown, parse: (item: unknown) => object) => {
      expect(parseDeviceConfigurationOutcome(value, parse)).toEqual(
        DEVICE_CONFIGURATION_UNSUPPORTED,
      );
    };
    const cases = [
      {
        path: DEVICE_SERVER_ROUTES.health,
        parse: parseDeviceHealth,
      },
      {
        path: `${DEVICE_SERVER_ROUTES.reports}?after=7&limit=500`,
        malformedBody: undefined,
        parse: (value: unknown) => parseDeviceReportPage(value, reports),
      },
      {
        path: DEVICE_SERVER_ROUTES.live,
        body: live,
        malformedBody: { imeis: [invalid] },
        parse: (value: unknown) => parseDeviceLiveSnapshot(value, live),
      },
      {
        path: DEVICE_SERVER_ROUTES.state,
        body: live,
        malformedBody: { imeis: [invalid] },
        parse: (value: unknown) => {
          expect(parseDeviceStateSnapshot(value, live).devices).toEqual([]);
        },
      },
      {
        path: `${DEVICE_SERVER_ROUTES.events}?${new URLSearchParams(events).toString()}`,
        malformedBody: undefined,
        parse: (value: unknown) => {
          expect(parseDeviceEventPage(value, imei, parseDeviceEventsRequest(imei, events))).toEqual(
            {
              items: [],
              total: 0,
              offset: 50,
              limit: 25,
              cursor: null,
              nextCursor: null,
              hasMore: false,
            },
          );
        },
      },
      {
        path: `${DEVICE_SERVER_ROUTES.messages}?${new URLSearchParams(messages).toString()}`,
        malformedBody: undefined,
        parse: (value: unknown) => {
          expect(
            parseDeviceMessagePage(value, imei, parseDeviceMessagesRequest(imei, messages)),
          ).toEqual({
            items: [],
            total: 0,
            offset: 0,
            limit: 100,
            cursor: null,
            nextCursor: null,
            hasMore: false,
          });
        },
      },
      {
        path: DEVICE_SERVER_ROUTES.problems,
        body: problems,
        malformedBody: { ...problems, imeis: [invalid] },
        parse: (value: unknown) => parseDeviceProblemPage(value, problems),
      },
      {
        path: `${DEVICE_SERVER_ROUTES.notifications}?${notificationQuery.toString()}`,
        malformedBody: undefined,
        parse: (value: unknown) => parseDeviceNotificationPage(value, notifications),
      },
      {
        path: DEVICE_SERVER_ROUTES.createCommand,
        body: create,
        malformedBody: { ...create, action: '30' },
        parse: unsupportedRequest,
      },
      {
        path: DEVICE_SERVER_ROUTES.listCommands,
        body: list,
        malformedBody: { ...list, limit: 101 },
        parse: (value: unknown) => {
          expect(parseDeviceCommandRequestsPage(value, parseCommandRequest)).toEqual({
            items: [],
            total: 0,
            offset: 10,
            limit: 20,
          });
        },
      },
      {
        path: DEVICE_SERVER_ROUTES.getCommand,
        body: requestLookup,
        malformedBody: { ...requestLookup, requestId: invalid },
        parse: (value: unknown) => {
          expect(parseDeviceCommandLookup(value, parseCommandRequest)).toBeNull();
        },
      },
      {
        path: DEVICE_SERVER_ROUTES.cancelCommand,
        body: cancel,
        malformedBody: { ...cancel, actorId: '' },
        parse: unsupportedRequest,
      },
      {
        path: DEVICE_SERVER_ROUTES.retryCommand,
        body: retry,
        malformedBody: { ...retry, expiresInSeconds: 0 },
        parse: unsupportedRequest,
      },
      {
        path: DEVICE_SERVER_ROUTES.startCommandBatch,
        body: start,
        malformedBody: { ...start, devices: [device, device] },
        parse: unsupportedBatch,
      },
      {
        path: DEVICE_SERVER_ROUTES.getCommandBatch,
        body: batchLookup,
        malformedBody: { ...batchLookup, batchId: invalid },
        parse: (value: unknown) => {
          expect(parseDeviceCommandLookup(value, parseBatch)).toBeNull();
        },
      },
      {
        path: DEVICE_SERVER_ROUTES.stopCommandBatch,
        body: stop,
        malformedBody: { ...stop, branchId: invalid },
        parse: unsupportedBatch,
      },
      {
        path: DEVICE_SERVER_ROUTES.commandRequestHistory,
        body: deviceRequests,
        malformedBody: { ...deviceRequests, device: { id: deviceId, imei: invalid } },
        parse: (value: unknown) => {
          expect(parseDeviceCommandRequestHistoryResult(value, parseCommandRequest)).toEqual([]);
        },
      },
      {
        path: DEVICE_SERVER_ROUTES.commandHistory,
        body: history,
        malformedBody: { ...history, cursor: 'valid-format' },
        parse: (value: unknown) => {
          expect(parseDeviceCommandsPage(value, parseDeviceCommand)).toEqual({
            items: [],
            cursor: null,
            nextCursor: null,
            hasMore: false,
          });
        },
      },
      {
        path: DEVICE_SERVER_ROUTES.actionCatalog,
        body: scope,
        malformedBody: { ...scope, tenantId: invalid },
        parse: (value: unknown) => {
          expect(parseDeviceActionCatalog(value)).toEqual([]);
        },
      },
      {
        path: DEVICE_SERVER_ROUTES.startParameterSnapshot,
        body: configurationDevice,
        malformedBody: { ...configurationDevice, actorId: '' },
        parse: (value: unknown) => {
          unsupportedConfiguration(value, parseSnapshot);
        },
      },
      {
        path: DEVICE_SERVER_ROUTES.parameterSnapshots,
        body: { ...history, direction: 'DESC' },
        malformedBody: { ...history, direction: 'NEWEST' },
        parse: (value: unknown) => {
          expect(parseDeviceParameterSnapshotsPage(value, parseSnapshot)).toEqual({
            items: [],
            total: 0,
            offset: 0,
            limit: 25,
            cursor: null,
            nextCursor: null,
            hasMore: false,
          });
        },
      },
      {
        path: DEVICE_SERVER_ROUTES.parameterCatalog,
        body: { ...scope, search: 'parameter', writableOnly: true, offset: 10, limit: 20 },
        malformedBody: { ...scope, search: null, writableOnly: false, offset: 0, limit: 0 },
        parse: (value: unknown) => {
          expect(parseDeviceParameterCatalogPage(value, parseDeviceParameterDefinition)).toEqual({
            items: [],
            total: 0,
            offset: 10,
            limit: 20,
          });
        },
      },
      {
        path: DEVICE_SERVER_ROUTES.configurationChanges,
        body: deviceRequests,
        malformedBody: { ...deviceRequests, device: { id: deviceId, imei: invalid } },
        parse: (value: unknown) => {
          expect(parseDeviceConfigurationHistory(value, parseDeviceConfigurationChange)).toEqual(
            [],
          );
        },
      },
      {
        path: DEVICE_SERVER_ROUTES.configurationWritesEnabled,
        body: deviceRequests,
        malformedBody: { ...deviceRequests, tenantId: invalid },
        parse: (value: unknown) => {
          expect(parseDeviceConfigurationWritesEnabled(value)).toBe(false);
        },
      },
      ...[
        { operation: 'READ' },
        { operation: 'INTERVAL', parameterId: 662, intervalSeconds: 60 },
        { operation: 'ADD_DEFINITION', definitionHex: '00'.repeat(22) },
        { operation: 'GLOBALS', globalsHex: '00'.repeat(49) },
      ].map((change) => ({
        path: DEVICE_SERVER_ROUTES.startMeasurementConfigurationChange,
        body: { ...measurement, ...change },
        malformedBody: { ...measurement, ...change, command: '30' },
        parse: (value: unknown) => {
          unsupportedConfiguration(value, parseDeviceConfigurationChange);
        },
      })),
      {
        path: DEVICE_SERVER_ROUTES.startParameterChange,
        body: parameterChange,
        malformedBody: { ...parameterChange, parameterId: 49 },
        parse: (value: unknown) => {
          unsupportedConfiguration(value, parseDeviceConfigurationChange);
        },
      },
      {
        path: DEVICE_SERVER_ROUTES.startParametersChange,
        body: parameterSet,
        malformedBody: { ...parameterSet, parameters: [parameter, parameter] },
        parse: (value: unknown) => {
          unsupportedConfiguration(value, parseDeviceConfigurationChange);
        },
      },
      {
        path: DEVICE_SERVER_ROUTES.startConfigurationBatch,
        body: configurationBatch,
        malformedBody: { ...configurationBatch, devices: [device, device] },
        parse: (value: unknown) => {
          unsupportedConfiguration(value, parseConfigurationBatch);
        },
      },
      {
        path: DEVICE_SERVER_ROUTES.getConfigurationBatch,
        body: batchLookup,
        malformedBody: { ...batchLookup, batchId: invalid },
        parse: (value: unknown) => {
          expect(
            parseDeviceConfigurationBatchLookupResult(value, parseConfigurationBatch),
          ).toBeNull();
        },
      },
      {
        path: DEVICE_SERVER_ROUTES.stopConfigurationBatch,
        body: stopConfigurationBatch,
        malformedBody: { ...stopConfigurationBatch, intent: '' },
        parse: (value: unknown) => {
          unsupportedConfiguration(value, parseConfigurationBatch);
        },
      },
      {
        path: DEVICE_SERVER_ROUTES.requestFaultRead,
        body: scheduled,
        malformedBody: { ...scheduled, intent: '' },
        parse: (value: unknown) => {
          expect(parseDeviceFaultReadOutcome(value)).toEqual(DEVICE_COMMANDS_UNSUPPORTED);
        },
      },
      {
        path: DEVICE_SERVER_ROUTES.answeredFaultReads,
        body: answered,
        malformedBody: { ...answered, to: from },
        parse: (value: unknown) => {
          expect(parseDeviceAnsweredFaultReads(value)).toEqual({ items: [], total: 0 });
        },
      },
    ];

    for (const route of cases) {
      const request = (unit: string, body: object | undefined, bearer?: string) =>
        fetch(new URL(route.path.replace(':imei', unit), baseUrl), {
          headers: {
            ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
            ...(body ? { 'content-type': 'application/json' } : {}),
          },
          ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}),
        });
      const valid = await request(imei, route.body, token);
      expect(valid.status).toBe(200);
      const payload: unknown = await valid.json();
      expect(() => route.parse(payload)).not.toThrow();

      const unauthorized = await request(imei, route.body);
      expect(unauthorized.status).toBe(route.path === DEVICE_SERVER_ROUTES.health ? 200 : 401);
      await unauthorized.body?.cancel();

      if (route.path !== DEVICE_SERVER_ROUTES.health) {
        const malformed = await request(invalid, route.malformedBody, token);
        expect(malformed.status).toBe(400);
        await malformed.body?.cancel();
      }
    }
  } finally {
    await app.close();
    if (previousToken === undefined) {
      delete process.env.DEVICE_SERVER_TOKEN;
    } else {
      process.env.DEVICE_SERVER_TOKEN = previousToken;
    }
  }
});
