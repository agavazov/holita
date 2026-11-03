import { expect, it, jest } from '@jest/globals';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host.js';
import { Test, type TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, type Server } from 'node:http';
import { GraphQLError, graphql, parse, print, type GraphQLResolveInfo } from 'graphql';
import { buildSubgraphSchema } from '@apollo/subgraph';
import { PrismaService } from '../src/database/prisma.service.js';
import type { CaptureRecord } from '../src/modules/devices/capture-record.js';
import { DeviceCaptureService } from '../src/modules/devices/device-capture.service.js';
import { DevicesRepository } from '../src/modules/devices/devices.repository.js';
import { redecodeFrames } from '../src/modules/devices/redecode.js';
import { DEFAULT_EVENT_STRUCTURE } from '../src/starlink/event.js';
import { DevicesService } from '../src/modules/devices/devices.service.js';
import { InternalDevicesGuard } from '../src/modules/devices/internal-devices.guard.js';
import { validateCommand } from '../src/modules/devices/command.js';
import { LiveDevicesService } from '../src/modules/telemetry/live-devices.service.js';
import { FleetClient } from '../src/modules/telemetry/fleet.client.js';
import { ParameterSnapshotsRepository } from '../src/modules/telemetry/parameter-snapshots.repository.js';
import { ParameterSnapshotsService } from '../src/modules/telemetry/parameter-snapshots.service.js';
import { parameterCatalog } from '../src/starlink/parameter-catalog.js';
import { InternalTelemetryController } from '../src/modules/telemetry/internal-telemetry.controller.js';
import { InternalTelemetryGuard } from '../src/modules/telemetry/internal-telemetry.guard.js';
import {
  ErmDeviceResolver,
  ErmEventResolver,
} from '../src/modules/telemetry/telemetry.resolver.js';
import type { DeviceReference } from '../src/modules/telemetry/telemetry.service.js';
import type {
  ErmDeviceAction,
  ErmEventNameArgs,
  FleetDeviceErmEventsArgs,
  FleetDeviceErmFramesArgs,
  FleetDeviceErmCommandsArgs,
  FleetDeviceErmParameterSnapshotsArgs,
} from '../src/generated/graphql/types.js';
import type { RequestContext } from '../src/graphql/request-context.js';
import { formatGraphqlError } from '../src/graphql/errors.js';
import { ErmFleetDeviceDocument } from '../src/generated/graphql/fleet-operations.js';
import { TelemetryRepository } from '../src/modules/telemetry/telemetry.repository.js';
import { TelemetryService } from '../src/modules/telemetry/telemetry.service.js';
import { deviceTelemetryRequest } from '../src/modules/telemetry/device-request.js';
import { issueDemoToken, readDemoTenant } from '../src/auth/demo-auth.js';
import { createTestDatabase } from './test-database.js';

it('persists captured connection lifecycle and raw frames through the production repository', async () => {
  const database = await createTestDatabase();
  let module: TestingModule | undefined;
  let captureDirectory: string | undefined;
  let boundary: Server | undefined;
  let releaseSnapshotBatch: (() => void) | undefined;
  let snapshotService: ParameterSnapshotsService | undefined;
  const previousGatewayUrl = process.env.ERM_GATEWAY_URL;
  const previousFleetUrl = process.env.FLEET_GRAPHQL_URL;
  const previousInternalToken = process.env.ERM_INTERNAL_TOKEN;
  const previousTelemetryToken = process.env.ERM_TELEMETRY_TOKEN;
  try {
    const reviewDirectory = fileURLToPath(new URL('../../../.references/review/', import.meta.url));
    await mkdir(reviewDirectory, { recursive: true });
    captureDirectory = await mkdtemp(join(reviewDirectory, 'erm-server-'));
    module = await Test.createTestingModule({
      controllers: [InternalTelemetryController],
      providers: [
        DeviceCaptureService,
        DevicesRepository,
        TelemetryRepository,
        TelemetryService,
        LiveDevicesService,
        FleetClient,
        InternalTelemetryGuard,
        { provide: DevicesService, useValue: { listUnits: () => [] } },
        { provide: PrismaService, useValue: { client: database.client, schema: database.schema } },
      ],
    }).compile();
    const capture = module.get(DeviceCaptureService);
    const upstream = '127.0.0.1:42001';
    const peer = '127.0.0.1:42000';
    capture.config.captureDirectory = captureDirectory;
    capture.config.upstream = upstream;
    capture.config.eventStructure = DEFAULT_EVENT_STRUCTURE.split(',');
    const openedAt = new Date('2026-11-02T10:00:00Z');
    const forwardedAt = new Date('2026-11-02T10:00:01Z');
    const lastFrameAt = new Date('2026-11-02T10:00:03Z');
    const staleConnections = [];
    for (const fixture of [
      { forwardedAt, frameTimes: [lastFrameAt, forwardedAt], expectedClosedAt: lastFrameAt },
      { forwardedAt, frameTimes: [], expectedClosedAt: forwardedAt },
      { forwardedAt: null, frameTimes: [], expectedClosedAt: openedAt },
    ]) {
      const stale = await database.client.ermConnection.create({
        data: {
          peer,
          upstream,
          openedAt,
          forwardedAt: fixture.forwardedAt,
          frames: {
            create: fixture.frameTimes.map((receivedAt) => ({
              receivedAt,
              direction: 'DEVICE',
              checksum: 'ABSENT',
              raw: Buffer.from('$unfinished'),
            })),
          },
        },
      });
      staleConnections.push({ id: stale.id, closedAt: fixture.expectedClosedAt });
    }
    await capture.initialize();
    for (const stale of staleConnections) {
      expect(
        await database.client.ermConnection.findUnique({ where: { id: stale.id } }),
      ).toMatchObject({
        closedAt: stale.closedAt,
        closeReason: 'left open by a previous process',
      });
    }

    const connection = 1;
    const unitId = '862129080366630';
    const binary = Buffer.from([0x00, 0x10, 0x0d, 0x0a, 0x80, 0xff]);
    const holitaFrame = `$SRV${unitId},03,900000001,0774`;
    const eventFrame = `$SLU${unitId},06,2,261103142530,04,261103142520,+4238.9347,-07109.9017,002.3,180,12345.678,10052,8738,1,12.200,03.600`;
    const records = [
      {
        connection,
        from: 'server',
        unit: '123ABC',
        command: '02',
        reference: '1',
        checksum: 'ok',
        frame: '$SRV123ABC,02,1*00',
      },
      {
        connection,
        from: 'device',
        unit: unitId,
        command: '42',
        reference: '1',
        checksum: 'ok',
        frame: '$SLU862129080366630,42,1,data*00',
      },
      {
        connection,
        from: 'device',
        unit: '654321',
        command: '33',
        reference: '999999999',
        checksum: 'mismatch',
        frame: `$SLU654321,33,999999999,${binary.toString('latin1')}*00`,
      },
      { connection, from: 'device', partial: true, frame: binary.toString('latin1') },
      {
        connection,
        from: 'holita',
        unit: unitId,
        command: '03',
        reference: '900000001',
        checksum: 'absent',
        frame: holitaFrame,
      },
      {
        connection,
        from: 'device',
        unit: unitId,
        command: '06',
        reference: '2',
        checksum: 'absent',
        frame: eventFrame,
      },
    ] satisfies Extract<CaptureRecord, { from: string }>[];
    const started = Date.now();
    capture.record({ connection, event: 'open', peer });
    capture.record({ connection, event: 'forwarded', upstream });
    await capture.drain();
    const firstForwardedAt = (
      await database.client.ermConnection.findFirst({
        where: { closedAt: null },
      })
    )?.forwardedAt;
    capture.record({ connection, event: 'upstream-close', reason: 'upstream closed' });
    capture.record({ connection, event: 'forwarded', upstream });
    for (const record of records) {
      capture.record(record);
    }
    const sentAt = new Date();
    const response = Buffer.from(`$SLU${unitId},03,3,0774,value`, 'latin1');
    const statuses = ['sent', 'answered', 'timeout', 'failed'] as const;
    for (const [index, status] of statuses.entries()) {
      const id = randomUUID();
      capture.commandSent(connection, {
        id,
        unitId,
        reference: `90000000${String(index + 1)}`,
        command: '03',
        fields: ['0774'],
        sentAt,
      });
      if (status === 'answered') {
        capture.commandFinished(connection, id, {
          status,
          answeredAt: sentAt,
          resultCode: '01',
          response,
        });
      } else if (status !== 'sent') {
        capture.commandFinished(connection, id, { status });
      }
    }
    capture.record(
      { connection, event: 'close', seconds: 60, deviceBytes: 4_294_967_296, serverBytes: 7 },
      'device closed',
    );
    await capture.drain();
    const finished = Date.now();

    const [stored] = await database.client.ermConnection.findMany({
      where: { unitId },
      include: {
        frames: { orderBy: { id: 'asc' } },
        commands: { orderBy: { reference: 'asc' } },
        upstreamCloses: true,
      },
    });
    if (!stored) {
      throw new Error('Capture did not persist its connection.');
    }
    expect(await database.client.ermConnection.count()).toBe(4);
    expect(stored.forwardedAt).toEqual(firstForwardedAt);
    expect(stored.upstreamCloses).toHaveLength(1);
    expect(stored.upstreamCloses[0]).toMatchObject({
      id: expect.any(BigInt),
      connectionId: stored.id,
      reason: 'upstream closed',
    });
    expect(stored.upstreamCloses[0]?.closedAt.getTime()).toBeGreaterThanOrEqual(started);
    expect(stored.upstreamCloses[0]?.closedAt.getTime()).toBeLessThanOrEqual(finished);
    expect(stored).toMatchObject({
      peer,
      upstream,
      unitId,
      closeReason: 'device closed',
      deviceBytes: 4_294_967_296n,
      serverBytes: 7n,
    });
    for (const timestamp of [stored.openedAt, stored.forwardedAt, stored.closedAt]) {
      expect(timestamp?.getTime()).toBeGreaterThanOrEqual(started);
      expect(timestamp?.getTime()).toBeLessThanOrEqual(finished);
    }
    expect(
      stored.frames.map(
        ({ direction, unitId: unit, command, reference, checksum, partial, raw }) => ({
          direction,
          unit,
          command,
          reference,
          checksum,
          partial,
          raw: Buffer.from(raw),
        }),
      ),
    ).toEqual([
      {
        direction: 'UPSTREAM',
        unit: '123ABC',
        command: '02',
        reference: '1',
        checksum: 'OK',
        partial: false,
        raw: Buffer.from('$SRV123ABC,02,1*00', 'latin1'),
      },
      {
        direction: 'DEVICE',
        unit: unitId,
        command: '42',
        reference: '1',
        checksum: 'OK',
        partial: false,
        raw: Buffer.from('$SLU862129080366630,42,1,data*00', 'latin1'),
      },
      {
        direction: 'DEVICE',
        unit: '654321',
        command: '33',
        reference: '999999999',
        checksum: 'MISMATCH',
        partial: false,
        raw: Buffer.concat([Buffer.from('$SLU654321,33,999999999,'), binary, Buffer.from('*00')]),
      },
      {
        direction: 'DEVICE',
        unit: null,
        command: null,
        reference: null,
        checksum: 'ABSENT',
        partial: true,
        raw: binary,
      },
      {
        direction: 'HOLITA',
        unit: unitId,
        command: '03',
        reference: '900000001',
        checksum: 'ABSENT',
        partial: false,
        raw: Buffer.from(holitaFrame, 'latin1'),
      },
      {
        direction: 'DEVICE',
        unit: unitId,
        command: '06',
        reference: '2',
        checksum: 'ABSENT',
        partial: false,
        raw: Buffer.from(eventFrame, 'latin1'),
      },
    ]);
    for (const frame of stored.frames) {
      expect(typeof frame.id).toBe('bigint');
      expect(frame.connectionId).toBe(stored.id);
      expect(frame.receivedAt.getTime()).toBeGreaterThanOrEqual(started);
      expect(frame.receivedAt.getTime()).toBeLessThanOrEqual(finished);
    }
    expect(stored.commands.map(({ status }) => status)).toEqual([
      'SENT',
      'ANSWERED',
      'TIMEOUT',
      'FAILED',
    ]);
    for (const command of stored.commands) {
      expect(command).toMatchObject({
        unitId,
        connectionId: stored.id,
        command: '03',
        fields: ['0774'],
        sentAt,
      });
      expect(command.answeredAt).toEqual(command.status === 'ANSWERED' ? sentAt : null);
      expect(command.resultCode).toBe(command.status === 'ANSWERED' ? '01' : null);
      expect(command.response === null ? null : Buffer.from(command.response)).toEqual(
        command.status === 'ANSWERED' ? response : null,
      );
    }
    const events = await database.client.ermEvent.findMany();
    expect(events).toHaveLength(1);
    const [event] = events;
    if (!event) {
      throw new Error('Expected the captured event');
    }
    expect(event).toMatchObject({
      frameId: stored.frames.at(-1)?.id,
      unitId,
      eventId: '04',
      eventTime: new Date('2026-11-03T14:25:30Z'),
      positionTime: new Date('2026-11-03T14:25:20Z'),
      speedKmh: 2.3 * 1.852,
      heading: 180,
      odometer: 12345.678,
      engineOn: true,
      mainVoltage: 12.2,
      backupVoltage: 3.6,
      fields: { '#EDT#': '261103142530', '#CSS#': null, extra: [] },
    });
    expect(event.latitude?.toNumber()).toBeCloseTo(42.6489117, 7);
    expect(event.longitude?.toNumber()).toBeCloseTo(-71.1650283, 7);

    const telemetry = module.get(TelemetryService);
    const tenantId = randomUUID();
    const context = {
      requestId: randomUUID(),
      tenantId: readDemoTenant(`Bearer ${issueDemoToken(tenantId)}`),
    };
    const unauthenticated = { requestId: randomUUID(), tenantId: undefined };
    const reference = (imei = unitId): DeviceReference => ({
      id: randomUUID(),
      imei,
      telemetryRequest: deviceTelemetryRequest([imei]),
    });
    const device = reference();
    for (const read of [
      () => telemetry.deviceState(device, unauthenticated),
      () => telemetry.deviceEvents(device, undefined, unauthenticated),
      () => telemetry.deviceFrames(device, undefined, unauthenticated),
      () => telemetry.deviceCommands(device, undefined, unauthenticated),
    ]) {
      await expect(read()).rejects.toThrow('Sign in to a tenant first');
    }
    const state = await telemetry.deviceState(device, context);
    expect(state).toMatchObject({
      unitId,
      online: false,
      mode: null,
      connectedSince: null,
      latestEvent: {
        frameId: String(event.frameId),
        engineOn: true,
        fields: { '#EDT#': '261103142530' },
      },
      mainVoltage: { value: 12.2, observedAt: '2026-11-03T14:25:30.000Z' },
      backupVoltage: { value: 3.6, observedAt: '2026-11-03T14:25:30.000Z' },
      signalQuality: null,
      firmwareVersion: null,
    });
    expect(state?.lastFrameAt).not.toBeNull();
    const framePage = await telemetry.deviceFrames(reference('654321'), undefined, context);
    expect(framePage?.items[0]?.displayText).toBe(
      `$SLU654321,33,999999999,\\x00\\x10\\x0d\\x0a\\x80ÿ*00`,
    );
    const unitFrames = (await telemetry.deviceFrames(device, undefined, context))?.items ?? [];
    expect(unitFrames.map((frame) => frame.direction)).toContain('HOLITA');
    expect(unitFrames).toContainEqual(
      expect.objectContaining({
        unitId: null,
        partial: true,
        displayText: '\\x00\\x10\\x0d\\x0a\\x80ÿ',
      }),
    );
    expect(unitFrames.some((frame) => frame.unitId === '654321' || frame.unitId === '123ABC')).toBe(
      false,
    );
    expect(
      (await telemetry.deviceCommands(device, undefined, context))?.items.find(
        (command) => command.status === 'ANSWERED',
      ),
    ).toMatchObject({
      resultCode: '01',
      responseText: response.toString('latin1'),
    });
    const fixtureTime = new Date('2000-01-01T00:00:00Z');
    for (let index = 0; index < 26; index++) {
      const time = new Date(fixtureTime.getTime() + index);
      const frame = await database.client.ermFrame.create({
        data: {
          connectionId: stored.id,
          unitId,
          receivedAt: time,
          direction: 'DEVICE',
          checksum: 'OK',
          command: '06',
          reference: String(index + 20),
          raw: Buffer.from(eventFrame),
        },
      });
      await database.client.ermEvent.create({
        data: {
          frameId: frame.id,
          unitId,
          eventId: String(index).padStart(2, '0'),
          eventTime: time,
          fields: { extra: [] },
        },
      });
      await database.client.ermCommand.create({
        data: {
          connectionId: stored.id,
          unitId,
          reference: String(900000020 + index),
          command: '03',
          fields: ['0774'],
          sentAt: time,
        },
      });
    }
    // Later ingestion of historical events must not move the latest position backwards.
    expect((await telemetry.deviceState(reference(), context))?.latestEvent?.id).toBe(
      String(event.id),
    );
    expect((await telemetry.deviceEvents(reference(), undefined, context))?.items[0]?.id).toBe(
      String(event.id),
    );
    for (const read of [
      (cursor: string | null = null) =>
        telemetry.deviceEvents(reference(), { pageSize: 25, cursor }, context),
      (cursor: string | null = null) =>
        telemetry.deviceFrames(reference(), { pageSize: 25, cursor }, context),
      (cursor: string | null = null) =>
        telemetry.deviceCommands(reference(), { pageSize: 25, cursor }, context),
    ]) {
      const first = await read();
      if (!first?.nextCursor) {
        throw new Error('Expected a paginated device history');
      }
      expect(first.items).toHaveLength(25);
      expect(first.hasMore).toBe(true);
      const second = await read(first.nextCursor);
      if (!second) {
        throw new Error('Expected the next device page');
      }
      expect(second.items.length).toBeGreaterThan(0);
      expect(second.hasMore).toBe(false);
      expect(first.items.some((item) => second.items.some((other) => other.id === item.id))).toBe(
        false,
      );
    }
    for (const input of [{ pageSize: 101 }, { cursor: 'invalid' }]) {
      await expect(telemetry.deviceEvents(reference(), input, context)).rejects.toThrow(
        'Invalid ERM unit',
      );
    }
    await expect(telemetry.deviceEvents(reference('invalid'), undefined, context)).rejects.toThrow(
      'Invalid ERM unit',
    );

    // Exercise the api -> Fleet scope check -> gateway contract on loopback, never on real units.
    const deviceId = randomUUID();
    const branchId = randomUUID();
    const scopedContext = {
      ...context,
      branchId,
      authorization: `Bearer ${issueDemoToken(tenantId)}`,
    };
    let fleetError: string | undefined;
    let gatewayStatus = 200;
    let fleetCalls = 0;
    let gatewayReads = 0;
    const sent: unknown[] = [];
    const snapshotCommands: ReturnType<typeof validateCommand>[] = [];
    let snapshotBatch = 0;
    let snapshotFallbackParameters: string[] = [];
    let snapshotBatchSeen: (() => void) | undefined;
    const firstSnapshotBatch = new Promise<void>((resolve) => {
      snapshotBatchSeen = resolve;
    });
    const snapshotGate = new Promise<void>((resolve) => {
      releaseSnapshotBatch = resolve;
    });
    boundary = createServer((req, res) => {
      void (async () => {
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          if (!Buffer.isBuffer(chunk)) {
            throw new Error('Expected a request buffer');
          }
          chunks.push(chunk);
        }
        const body: unknown = chunks.length
          ? JSON.parse(Buffer.concat(chunks).toString('utf8'))
          : null;
        res.setHeader('content-type', 'application/json');
        if (req.url === '/graphql') {
          fleetCalls++;
          expect(body).toEqual({
            query: print(ErmFleetDeviceDocument),
            variables: { id: deviceId },
          });
          expect(req.headers.authorization).toBe(scopedContext.authorization);
          expect(req.headers['x-request-id']).toBe(scopedContext.requestId);
          const code =
            fleetError ?? (req.headers['x-branch-id'] === branchId ? undefined : 'NOT_FOUND');
          res.end(
            JSON.stringify(
              code
                ? { errors: [{ message: 'Private upstream details', extensions: { code } }] }
                : { data: { fleetDevice: { id: deviceId, imei: unitId } } },
            ),
          );
          return;
        }
        expect(req.headers.authorization).toBe('Bearer erm-cross-service-test-token-32-characters');
        if (req.method === 'GET' && req.url === '/internal/units') {
          gatewayReads++;
          res.end(
            JSON.stringify([
              {
                unitId,
                mode: 'primary',
                peer,
                connectedSince: sentAt.toISOString(),
                lastFrameAt: sentAt.toISOString(),
              },
            ]),
          );
          return;
        }
        expect(req.url).toBe(`/internal/units/${unitId}/commands`);
        if (gatewayStatus !== 200) {
          res.statusCode = gatewayStatus;
          res.end('{}');
          return;
        }
        const command = validateCommand(body);
        sent.push(command);
        let resultCode: string | null = null;
        let fields: string[] = [];
        if (command.command === '45' || command.command === '03') {
          snapshotCommands.push(command);
          if (command.command === '45') {
            snapshotBatch++;
            if (snapshotBatch === 1) {
              snapshotBatchSeen?.();
              await snapshotGate;
            }
            if (snapshotBatch === 2) {
              snapshotFallbackParameters = command.fields;
              resultCode = '02';
            } else {
              fields = command.fields
                .filter((_, index) => snapshotBatch !== 1 || index !== command.fields.length - 1)
                .flatMap((parameter) => [parameter, `"read-${parameter}"`]);
            }
          } else if (command.fields[0] === snapshotFallbackParameters[1]) {
            resultCode = '02';
          } else {
            fields = [command.fields[0] ?? '', '"single,reply"'];
          }
        }
        const recorded = await database.client.ermCommand.create({
          data: {
            connectionId: stored.id,
            unitId,
            reference: String(900001000 + sent.length),
            ...command,
            sentAt: new Date(),
            status: 'ANSWERED',
            answeredAt: new Date(),
          },
        });
        res.end(
          JSON.stringify({
            id: recorded.id,
            reference: recorded.reference,
            status: 'answered',
            resultCode,
            fields,
          }),
        );
      })().catch(() => {
        res.statusCode = 500;
        res.end('{}');
      });
    });
    await new Promise<void>((resolve) => {
      boundary?.listen(0, '127.0.0.1', resolve);
    });
    const address = boundary.address();
    if (address === null || typeof address === 'string') {
      throw new Error('Expected loopback HTTP listener');
    }
    process.env.ERM_GATEWAY_URL = `http://127.0.0.1:${String(address.port)}`;
    process.env.FLEET_GRAPHQL_URL = `${process.env.ERM_GATEWAY_URL}/graphql`;
    process.env.ERM_INTERNAL_TOKEN = 'erm-cross-service-test-token-32-characters';
    const api = new TelemetryService(
      module.get(TelemetryRepository),
      new LiveDevicesService(),
      new FleetClient(),
    );
    await expect(
      api.sendDeviceCommand({ deviceId, action: 'READ_STATUS' }, unauthenticated),
    ).rejects.toThrow('Sign in');
    expect(fleetCalls).toBe(0);
    await expect(
      api.sendDeviceCommand(
        { deviceId, action: 'READ_STATUS' },
        { ...scopedContext, branchId: randomUUID() },
      ),
    ).rejects.toMatchObject({ status: 404 });
    for (const [code, status] of [
      ['NOT_FOUND', 404],
      ['UNAUTHENTICATED', 401],
      ['FORBIDDEN', 403],
      ['BAD_USER_INPUT', 400],
    ] as const) {
      fleetError = code;
      try {
        await api.sendDeviceCommand({ deviceId, action: 'READ_STATUS' }, scopedContext);
        throw new Error('Expected Fleet rejection');
      } catch (error) {
        expect(error).toMatchObject({ status });
        if (!(error instanceof Error)) {
          throw error;
        }
        const formatted = formatGraphqlError(
          { message: 'Upstream' },
          new GraphQLError('Upstream', { originalError: error, path: ['sendErmDeviceCommand'] }),
        );
        expect(formatted.extensions?.['code']).toBe(code);
        expect(formatted.message).not.toContain('Private upstream details');
      }
    }
    expect(sent).toHaveLength(0);
    fleetError = undefined;
    const actions: [ErmDeviceAction, string, string[]][] = [
      ['REQUEST_LOCATION', '05', []],
      ['READ_STATUS', '48', ['IGN=#IGN#;ENG=#ENG#;VIN=#VIN#;VBAT=#VBAT#;CSS=#CSS#;JAM=#JAM#']],
      ['READ_VERSION', '48', ['VER=#VER#']],
      ['READ_ACCESSORIES', '56', []],
      ['READ_EDATA_DIAGNOSTICS', '30', ['19', '0', '19', '306', '0', '1', '1', '']],
      ['READ_EDATA_FAULTS', '30', ['19', '0', '19', '301', '0', '1', '1', '19']],
    ];
    for (const [action, command, fields] of actions) {
      const recorded = await api.sendDeviceCommand({ deviceId, action }, scopedContext);
      expect(sent.at(-1)).toEqual({ command, fields });
      expect(recorded).toMatchObject({ unitId, command, fields, status: 'ANSWERED' });
      expect(
        await database.client.ermCommand.findUnique({ where: { id: recorded.id } }),
      ).not.toBeNull();
    }
    gatewayStatus = 404;
    await expect(
      api.sendDeviceCommand({ deviceId, action: 'REQUEST_LOCATION' }, scopedContext),
    ).rejects.toMatchObject({ status: 409 });

    // Federation resolves the complete representation set, including absent units, in fixed batches.
    const now = new Date();
    const voltageObservedAt = new Date(now.getTime() - 60_000);
    await database.client.ermEvent.update({
      where: { id: event.id },
      data: { eventTime: voltageObservedAt },
    });
    const fallbackObservedAt = new Date(now.getTime() - 5000);
    const readingFrame = await database.client.ermFrame.create({
      data: {
        connectionId: stored.id,
        unitId,
        receivedAt: fallbackObservedAt,
        direction: 'DEVICE',
        command: '06',
        checksum: 'ABSENT',
        raw: Buffer.from(eventFrame),
      },
    });
    await database.client.ermEvent.createMany({
      data: [
        {
          frameId: stored.frames.at(-1)?.id ?? 0n,
          unitId,
          eventId: '09',
          eventTime: now,
          fields: {},
        },
        {
          frameId: stored.frames.at(-1)?.id ?? 0n,
          unitId,
          eventId: '70',
          eventTime: now,
          fields: { '#CSS#': '23' },
        },
        {
          frameId: stored.frames.at(-1)?.id ?? 0n,
          unitId,
          eventId: '999',
          eventTime: now,
          fields: {},
        },
        {
          frameId: readingFrame.id,
          unitId,
          eventId: '04',
          eventTime: null,
          mainVoltage: 13.8,
          fields: { '#CSS#': 'unavailable' },
        },
      ],
    });
    const firmwareObservedAt = new Date(now.getTime() - 4000);
    await database.client.ermCommand.createMany({
      data: [
        {
          connectionId: stored.id,
          unitId,
          command: '48',
          reference: '900002001',
          fields: ['VER=#VER#'],
          status: 'ANSWERED',
          sentAt: firmwareObservedAt,
          answeredAt: firmwareObservedAt,
          response: Buffer.from(`$SLU${unitId},48,800,VER=StarLink 1.2.3;CSS=23`),
        },
        {
          connectionId: stored.id,
          unitId,
          command: '48',
          reference: '900002002',
          fields: ['CSS=#CSS#'],
          status: 'ANSWERED',
          sentAt: now,
          answeredAt: now,
          response: Buffer.from(`$SLU${unitId},48,801,CSS=24`),
        },
      ],
    });
    const routingFrame = await database.client.ermFrame.create({
      data: {
        connectionId: stored.id,
        unitId,
        receivedAt: now,
        direction: 'UPSTREAM',
        command: '46',
        reference: '802',
        checksum: 'ABSENT',
        raw: Buffer.from(`$SRV${unitId},46,802,0049,backup.example,0050,11500`),
      },
    });
    const overdueUnitId = '862129080366631';
    const lastClosedAt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const overdueConnection = await database.client.ermConnection.create({
      data: {
        unitId: overdueUnitId,
        peer,
        upstream,
        openedAt: new Date(lastClosedAt.getTime() - 60_000),
        closedAt: lastClosedAt,
        closeReason: 'upstream closed',
      },
    });
    await database.client.ermUpstreamClose.create({
      data: {
        connectionId: overdueConnection.id,
        closedAt: new Date(lastClosedAt.getTime() - 30_000),
        reason: 'upstream closed',
      },
    });
    const overdueFrameAt = new Date(lastClosedAt.getTime() - 1000);
    const overdueFrame = await database.client.ermFrame.create({
      data: {
        connectionId: overdueConnection.id,
        unitId: overdueUnitId,
        receivedAt: overdueFrameAt,
        direction: 'DEVICE',
        command: '06',
        checksum: 'ABSENT',
        raw: Buffer.from(eventFrame.replace(unitId, overdueUnitId)),
      },
    });
    await database.client.ermEvent.createMany({
      data: [
        {
          frameId: overdueFrame.id,
          unitId: overdueUnitId,
          eventTime: new Date(overdueFrameAt.getTime() - 60_000),
          engineOn: false,
          speedKmh: 0,
          fields: {},
        },
        {
          frameId: overdueFrame.id,
          unitId: overdueUnitId,
          engineOn: true,
          speedKmh: 0,
          fields: {},
        },
      ],
    });
    const snapshotRepository = new ParameterSnapshotsRepository(module.get(PrismaService));
    snapshotService = new ParameterSnapshotsService(
      snapshotRepository,
      new LiveDevicesService(),
      new FleetClient(),
    );
    const snapshots = snapshotService;
    const resolver = new ErmDeviceResolver(api, snapshots);
    const eventResolver = new ErmEventResolver();
    const schema = buildSubgraphSchema([
      {
        typeDefs: parse(
          await readFile(
            new URL('../src/modules/telemetry/telemetry.graphql', import.meta.url),
            'utf8',
          ),
        ),
        resolvers: {
          FleetDevice: {
            __resolveReference: (
              ref: Pick<DeviceReference, 'id' | 'imei'>,
              ctx: RequestContext,
              info: GraphQLResolveInfo,
            ) => resolver.reference(ref, ctx, info),
            ermState: (ref: DeviceReference, _args: unknown, ctx: RequestContext) =>
              resolver.state(ref, ctx),
            ermEvents: (
              ref: DeviceReference,
              args: FleetDeviceErmEventsArgs,
              ctx: RequestContext,
            ) => resolver.events(ref, args, ctx),
            ermFrames: (
              ref: DeviceReference,
              args: FleetDeviceErmFramesArgs,
              ctx: RequestContext,
            ) => resolver.frames(ref, args, ctx),
            ermCommands: (
              ref: DeviceReference,
              args: FleetDeviceErmCommandsArgs,
              ctx: RequestContext,
            ) => resolver.commands(ref, args, ctx),
            ermParameterSnapshots: (
              ref: DeviceReference,
              args: FleetDeviceErmParameterSnapshotsArgs,
              ctx: RequestContext,
            ) => resolver.parameterSnapshots(ref, args, ctx),
          },
          ErmEvent: {
            name: (parent: { eventId: string | null }, args: ErmEventNameArgs) =>
              eventResolver.name(parent, args),
          },
        },
      },
    ]);
    const source = `query($representations: [_Any!]!) { _entities(representations: $representations) { ... on FleetDevice {
      id ermState {
        online mode lastFrameAt latestEvent { eventId category } lastPosition { id } alarmsLast24h latestAlarm { eventId category name(language: BG) }
        mainVoltage { value observedAt } backupVoltage { value observedAt } signalQuality { value observedAt } firmwareVersion { value observedAt }
        health { lastFrameAgeSeconds expectedIntervalSeconds overdue lastCloseReason lastClosedAt upstreamClosesLast24h karmaRoutingWritesLast24h latestKarmaRoutingWrite { id command } }
      }
      ermEvents(input: { pageSize: 25 }) { items { id } hasMore nextCursor }
      alarms: ermEvents(input: { categories: [ALARM] }) { items { eventId category } }
      other: ermEvents(input: { categories: [OTHER] }) { items { eventId } }
      ermFrames(input: { pageSize: 25 }) { items { id } hasMore }
      ermCommands(input: { pageSize: 25 }) { items { id } hasMore }
    } } }`;
    const result = await graphql({
      schema,
      source,
      variableValues: {
        representations: [
          { __typename: 'FleetDevice', id: deviceId, imei: unitId },
          { __typename: 'FleetDevice', id: 'never-connected', imei: '123456789012345' },
          { __typename: 'FleetDevice', id: 'overdue', imei: overdueUnitId },
        ],
      },
      contextValue: { ...scopedContext },
    });
    expect(result.errors).toBeUndefined();
    expect(result.data?.['_entities']).toMatchObject([
      {
        id: deviceId,
        ermState: {
          online: true,
          mode: 'PRIMARY',
          lastPosition: { id: String(event.id) },
          alarmsLast24h: 1,
          mainVoltage: { value: 13.8, observedAt: fallbackObservedAt.toISOString() },
          backupVoltage: { value: 3.6, observedAt: voltageObservedAt.toISOString() },
          signalQuality: { value: 23, observedAt: now.toISOString() },
          firmwareVersion: {
            value: 'StarLink 1.2.3',
            observedAt: firmwareObservedAt.toISOString(),
          },
          health: {
            lastFrameAgeSeconds: expect.any(Number),
            expectedIntervalSeconds: 3600,
            overdue: false,
            lastCloseReason: 'device closed',
            lastClosedAt: stored.closedAt?.toISOString(),
            upstreamClosesLast24h: 1,
            karmaRoutingWritesLast24h: 1,
            latestKarmaRoutingWrite: { id: String(routingFrame.id), command: '46' },
          },
          latestAlarm: {
            eventId: '09',
            category: 'ALARM',
            name: 'Акумулаторът на автомобила е разкачен',
          },
        },
        ermEvents: { hasMore: true },
        alarms: { items: expect.arrayContaining([{ eventId: '09', category: 'ALARM' }]) },
        other: { items: [{ eventId: '999' }, { eventId: '00' }] },
        ermFrames: { hasMore: true },
        ermCommands: { hasMore: true },
      },
      {
        id: 'never-connected',
        ermState: null,
        ermEvents: { items: [] },
        ermFrames: { items: [] },
        ermCommands: { items: [] },
      },
      {
        id: 'overdue',
        ermState: {
          online: false,
          mode: null,
          mainVoltage: null,
          backupVoltage: null,
          signalQuality: null,
          firmwareVersion: null,
          health: {
            lastFrameAgeSeconds: expect.any(Number),
            expectedIntervalSeconds: 300,
            overdue: true,
            lastCloseReason: 'upstream closed',
            lastClosedAt: lastClosedAt.toISOString(),
            upstreamClosesLast24h: 2,
            karmaRoutingWritesLast24h: 0,
            latestKarmaRoutingWrite: null,
          },
        },
      },
    ]);
    expect(gatewayReads).toBe(1);

    // A cursor for one IMEI must not poison that page through another entity's field.
    for (const [field, read] of [
      [
        'ermEvents',
        (cursor: string | null = null) =>
          api.deviceEvents(reference(), { pageSize: 25, cursor }, scopedContext),
      ],
      [
        'ermFrames',
        (cursor: string | null = null) =>
          api.deviceFrames(reference(), { pageSize: 25, cursor }, scopedContext),
      ],
      [
        'ermCommands',
        (cursor: string | null = null) =>
          api.deviceCommands(reference(), { pageSize: 25, cursor }, scopedContext),
      ],
    ] as const) {
      const first = await read();
      if (!first?.nextCursor) {
        throw new Error(`Expected a cursor for ${field}`);
      }
      const second = await read(first.nextCursor);
      if (!second) {
        throw new Error(`Expected the second page of ${field}`);
      }
      const cursorResult = await graphql({
        schema,
        source: `query($representations: [_Any!]!, $cursor: String!) {
          _entities(representations: $representations) { ... on FleetDevice {
            id ${field}(input: {pageSize: 25, cursor: $cursor}) { items { id } hasMore }
          } }
        }`,
        variableValues: {
          representations: [
            { __typename: 'FleetDevice', id: 'never-connected', imei: '123456789012345' },
            { __typename: 'FleetDevice', id: deviceId, imei: unitId },
            { __typename: 'FleetDevice', id: 'overdue', imei: overdueUnitId },
          ],
          cursor: first.nextCursor,
        },
        contextValue: { ...scopedContext },
      });
      expect(cursorResult.data?.['_entities']).toEqual([
        null,
        {
          id: deviceId,
          [field]: { items: second.items.map(({ id }) => ({ id })), hasMore: second.hasMore },
        },
        null,
      ]);
      expect(cursorResult.errors).toHaveLength(2);
      expect(
        cursorResult.errors?.map((error) => ({
          path: error.path,
          code: formatGraphqlError(error.toJSON(), error).extensions?.['code'],
        })),
      ).toEqual(
        expect.arrayContaining([
          { path: ['_entities', 0, field], code: 'BAD_USER_INPUT' },
          { path: ['_entities', 2, field], code: 'BAD_USER_INPUT' },
        ]),
      );
    }

    // Snapshot jobs keep their gateway reads sequential and preserve unsupported/missing values.
    gatewayStatus = 200;
    const snapshotParameters = [...parameterCatalog.keys()]
      .filter(
        (parameter) => parameter >= 1 && parameter <= 9999 && (parameter < 49 || parameter > 54),
      )
      .sort((left, right) => left - right);
    const previousSnapshot = await database.client.ermParameterSnapshot.create({
      data: {
        unitId,
        status: 'COMPLETE',
        startedAt: new Date(Date.now() - 2000),
        finishedAt: new Date(Date.now() - 1000),
        parameterCount: 2,
        readCount: 2,
        values: {
          create: [
            { parameter: 1, value: 'previous unit id' },
            { parameter: 2, value: 'read-0002' },
          ],
        },
      },
    });
    let runningSnapshotId: string;
    try {
      await expect(snapshots.start(deviceId, unauthenticated)).rejects.toThrow('Sign in');
      const running = await snapshots.start(deviceId, scopedContext);
      runningSnapshotId = running.id;
      expect(running).toMatchObject({
        status: 'RUNNING',
        parameterCount: snapshotParameters.length,
        readCount: 0,
        finishedAt: null,
        values: [],
      });
      await firstSnapshotBatch;
      expect(snapshotCommands).toHaveLength(1);
      expect(snapshotCommands[0]).toEqual({
        command: '45',
        fields: snapshotParameters
          .slice(0, 20)
          .map((parameter) => String(parameter).padStart(4, '0')),
      });
      await expect(snapshots.start(deviceId, scopedContext)).rejects.toMatchObject({ status: 409 });
      releaseSnapshotBatch?.();
      await snapshots.onModuleDestroy();
    } finally {
      releaseSnapshotBatch?.();
      await snapshots.onModuleDestroy();
    }
    const snapshotPage = await snapshots.deviceSnapshots(
      reference(),
      { pageSize: 25 },
      scopedContext,
    );
    if (!snapshotPage) {
      throw new Error('Expected a parameter snapshot page');
    }
    expect(snapshotPage.items.map(({ id }) => id)).toEqual([
      runningSnapshotId,
      previousSnapshot.id,
    ]);
    const completedSnapshot = snapshotPage.items[0];
    expect(completedSnapshot).toMatchObject({
      id: runningSnapshotId,
      status: 'COMPLETE',
      parameterCount: snapshotParameters.length,
      readCount: snapshotParameters.length,
      failureReason: null,
      finishedAt: expect.any(String),
      values: expect.arrayContaining([
        { parameter: 1, title: 'Unit ID selection', value: 'read-0001', resultCode: null },
        { parameter: 2, title: 'High communication rate', value: 'read-0002', resultCode: null },
        {
          parameter: snapshotParameters[19],
          title: parameterCatalog.get(snapshotParameters[19] ?? 0),
          value: null,
          resultCode: null,
        },
        {
          parameter: snapshotParameters[20],
          title: parameterCatalog.get(snapshotParameters[20] ?? 0),
          value: 'single,reply',
          resultCode: null,
        },
        {
          parameter: snapshotParameters[21],
          title: parameterCatalog.get(snapshotParameters[21] ?? 0),
          value: null,
          resultCode: '02',
        },
        { parameter: 593, title: parameterCatalog.get(593), value: 'read-0593', resultCode: null },
      ]),
      changes: expect.arrayContaining([
        {
          parameter: 1,
          title: 'Unit ID selection',
          previousValue: 'previous unit id',
          value: 'read-0001',
        },
      ]),
    });
    expect(completedSnapshot?.values).toHaveLength(snapshotParameters.length);
    expect(completedSnapshot?.changes.some(({ parameter }) => parameter === 2)).toBe(false);
    expect(snapshotCommands.filter(({ command }) => command === '45')).toHaveLength(
      Math.ceil(snapshotParameters.length / 20),
    );
    expect(
      snapshotCommands.filter(({ command }) => command === '03').map(({ fields }) => fields[0]),
    ).toEqual(snapshotFallbackParameters);
    expect(
      snapshotCommands
        .flatMap(({ fields }) => fields)
        .some((parameter) => Number(parameter) >= 49 && Number(parameter) <= 54),
    ).toBe(false);
    const snapshotResult = await graphql({
      schema,
      source: `query($representations: [_Any!]!) {
        _entities(representations: $representations) { ... on FleetDevice {
          ermParameterSnapshots(input: {pageSize: 25}) {
            items { id status values { parameter title value resultCode } changes { parameter previousValue value } }
            hasMore
          }
        } }
      }`,
      variableValues: {
        representations: [
          { __typename: 'FleetDevice', id: deviceId, imei: unitId },
          { __typename: 'FleetDevice', id: 'never-connected', imei: '123456789012345' },
        ],
      },
      contextValue: { ...scopedContext },
    });
    expect(snapshotResult.errors).toBeUndefined();
    expect(snapshotResult.data?.['_entities']).toMatchObject([
      {
        ermParameterSnapshots: {
          items: [{ id: runningSnapshotId, status: 'COMPLETE' }, { id: previousSnapshot.id }],
          hasMore: false,
        },
      },
      { ermParameterSnapshots: { items: [], hasMore: false } },
    ]);
    const interrupted = await database.client.ermParameterSnapshot.create({
      data: { unitId, status: 'RUNNING', parameterCount: snapshotParameters.length },
    });
    await snapshots.onModuleInit();
    expect(
      await database.client.ermParameterSnapshot.findUnique({ where: { id: interrupted.id } }),
    ).toMatchObject({
      status: 'FAILED',
      failureReason: 'interrupted by an api restart',
      finishedAt: expect.any(Date),
    });

    // Re-decode only old, complete DEVICE frames and retain each stored frame byte for byte.
    const redecodeStartedAt = new Date('2000-01-01T00:00:00Z');
    const oldReceivedAt = new Date(redecodeStartedAt.getTime() - 60_000);
    const redecodeFixture = {
      connectionId: stored.id,
      unitId,
      receivedAt: oldReceivedAt,
      direction: 'DEVICE',
      command: '06',
      checksum: 'ABSENT',
      raw: Buffer.from(eventFrame),
    } as const;
    const missingFrame = await database.client.ermFrame.create({ data: redecodeFixture });
    const changedFrame = await database.client.ermFrame.create({ data: redecodeFixture });
    await database.client.ermFrame.create({
      data: { ...redecodeFixture, raw: Buffer.from('$invalid') },
    });
    const excludedFrames = [];
    for (const fixture of [
      { ...redecodeFixture, partial: true },
      { ...redecodeFixture, direction: 'UPSTREAM' },
      { ...redecodeFixture, receivedAt: new Date(oldReceivedAt.getTime() + 1) },
    ] as const) {
      excludedFrames.push(await database.client.ermFrame.create({ data: fixture }));
    }
    const changedEvent = await database.client.ermEvent.create({
      data: { frameId: changedFrame.id, unitId, eventId: '99', fields: {} },
    });
    const surplusEvent = await database.client.ermEvent.create({
      data: { frameId: changedFrame.id, unitId, eventId: '998', fields: { retained: true } },
    });
    const framesBefore = await database.client.ermFrame.findMany({ orderBy: { id: 'asc' } });
    const structure = DEFAULT_EVENT_STRUCTURE.split(',');
    expect(await redecodeFrames(database.client, structure, redecodeStartedAt)).toEqual({
      framesScanned: 3,
      eventsUpdated: 1,
      eventsInserted: 1,
      surplusEvents: 1,
      decodeFailures: 1,
    });
    expect(await redecodeFrames(database.client, structure, redecodeStartedAt)).toEqual({
      framesScanned: 3,
      eventsUpdated: 0,
      eventsInserted: 0,
      surplusEvents: 1,
      decodeFailures: 1,
    });
    expect(await database.client.ermFrame.findMany({ orderBy: { id: 'asc' } })).toEqual(
      framesBefore,
    );
    expect(await database.client.ermEvent.count({ where: { frameId: missingFrame.id } })).toBe(1);
    expect(
      await database.client.ermEvent.findUnique({ where: { id: changedEvent.id } }),
    ).toMatchObject({
      frameId: changedFrame.id,
      eventId: '04',
      mainVoltage: 12.2,
      backupVoltage: 3.6,
    });
    expect(await database.client.ermEvent.findUnique({ where: { id: surplusEvent.id } })).toEqual(
      surplusEvent,
    );
    expect(
      await database.client.ermEvent.count({
        where: { frameId: { in: excludedFrames.map(({ id }) => id) } },
      }),
    ).toBe(0);

    // Fleet pulls a separate read-only contract, without the gateway's command token.
    const telemetryController = module.get(InternalTelemetryController);
    const telemetryGuard = module.get(InternalTelemetryGuard);
    const telemetryToken = 'erm-telemetry-read-only-test-token-32-characters';
    process.env.ERM_TELEMETRY_TOKEN = telemetryToken;
    const telemetryContext = (authorization?: string, remoteAddress = '127.0.0.1') =>
      new ExecutionContextHost([{ headers: { authorization }, socket: { remoteAddress } }]);
    const authorized = telemetryContext(`Bearer ${telemetryToken}`);
    expect(telemetryGuard.canActivate(authorized)).toBe(true);
    expect(() => new InternalDevicesGuard().canActivate(authorized)).toThrow(
      expect.objectContaining({ status: 401 }),
    );
    for (const authorization of [
      undefined,
      `Bearer ${process.env.ERM_INTERNAL_TOKEN}`,
      'Bearer wrong-telemetry-token',
    ]) {
      expect(() => telemetryGuard.canActivate(telemetryContext(authorization))).toThrow(
        expect.objectContaining({ status: 401 }),
      );
    }
    expect(() =>
      telemetryGuard.canActivate(telemetryContext(`Bearer ${telemetryToken}`, '192.0.2.1')),
    ).toThrow(expect.objectContaining({ status: 403 }));
    for (const token of [undefined, 'short']) {
      if (token === undefined) {
        delete process.env.ERM_TELEMETRY_TOKEN;
      } else {
        process.env.ERM_TELEMETRY_TOKEN = token;
      }
      expect(() => telemetryGuard.canActivate(authorized)).toThrow(
        expect.objectContaining({ status: 503 }),
      );
    }
    process.env.ERM_TELEMETRY_TOKEN = telemetryToken;

    const telemetryUnitId = '862129080366632';
    const telemetryRequestedAt = Date.now();
    const telemetryReceivedAt = new Date(telemetryRequestedAt - 10_000);
    const telemetryFrame = await database.client.ermFrame.create({
      data: {
        connectionId: stored.id,
        unitId: telemetryUnitId,
        receivedAt: telemetryReceivedAt,
        direction: 'DEVICE',
        checksum: 'ABSENT',
        raw: Buffer.from(eventFrame.replace(unitId, telemetryUnitId)),
      },
    });
    const telemetryEventTime = new Date('2026-11-03T14:25:30.123Z');
    const firstTelemetryEvent = await database.client.ermEvent.create({
      data: {
        frameId: telemetryFrame.id,
        unitId: telemetryUnitId,
        eventId: '04',
        eventTime: telemetryEventTime,
        latitude: 42.6489117,
        longitude: -71.1650283,
        speedKmh: 4.2596,
        heading: 180,
        odometer: 12345.678,
        engineOn: true,
        mainVoltage: 12.2,
        backupVoltage: 3.6,
        fields: { private: 'not part of the Fleet contract' },
      },
    });
    const secondTelemetryEvent = await database.client.ermEvent.create({
      data: { frameId: telemetryFrame.id, unitId: telemetryUnitId, fields: {} },
    });
    const thirdTelemetryEvent = await database.client.ermEvent.create({
      data: {
        frameId: telemetryFrame.id,
        unitId: telemetryUnitId,
        eventId: '33',
        fields: {
          edata: {
            type: 419,
            payload: '21000010f30701000004df0b01',
            faults: [
              { spn: 4339, fmi: 7, status: 1 },
              { spn: 1247, fmi: 11, status: 1 },
            ],
          },
        },
      },
    });
    const delayedFrame = await database.client.ermFrame.create({
      data: {
        connectionId: stored.id,
        unitId: telemetryUnitId,
        receivedAt: new Date(telemetryRequestedAt - 9999),
        direction: 'DEVICE',
        checksum: 'ABSENT',
        raw: Buffer.from(eventFrame.replace(unitId, telemetryUnitId)),
      },
    });
    await database.client.ermEvent.create({
      data: { frameId: delayedFrame.id, unitId: telemetryUnitId, fields: {} },
    });
    const telemetryClock = jest.spyOn(Date, 'now').mockReturnValue(telemetryRequestedAt);
    try {
      const exported = await telemetryController.events(telemetryUnitId, undefined, undefined);
      expect(exported.events.map(({ id }) => id)).toEqual([
        String(firstTelemetryEvent.id),
        String(secondTelemetryEvent.id),
        String(thirdTelemetryEvent.id),
      ]);
      expect(exported.next).toBe(String(thirdTelemetryEvent.id));
      expect(exported.events[0]).toEqual({
        id: String(firstTelemetryEvent.id),
        eventId: '04',
        eventTime: telemetryEventTime.toISOString(),
        receivedAt: telemetryReceivedAt.toISOString(),
        latitude: 42.6489117,
        longitude: -71.1650283,
        speedKmh: 4.2596,
        heading: 180,
        odometerKm: 12345.678,
        engineOn: true,
        mainVoltage: 12.2,
        backupVoltage: 3.6,
        edata: null,
      });
      expect(exported.events[1]).toEqual({
        id: String(secondTelemetryEvent.id),
        eventId: null,
        eventTime: null,
        receivedAt: telemetryReceivedAt.toISOString(),
        latitude: null,
        longitude: null,
        speedKmh: null,
        heading: null,
        odometerKm: null,
        engineOn: null,
        mainVoltage: null,
        backupVoltage: null,
        edata: null,
      });
      expect(exported.events[2]?.edata).toEqual({
        report: '419',
        faults: [
          { spn: 4339, fmi: 7, status: 'ADDED' },
          { spn: 1247, fmi: 11, status: 'ADDED' },
        ],
      });
      expect(
        await telemetryController.events(telemetryUnitId, String(firstTelemetryEvent.id), '1'),
      ).toEqual({ events: [exported.events[1]], next: String(secondTelemetryEvent.id) });
      const after = String(thirdTelemetryEvent.id);
      expect(await telemetryController.events(telemetryUnitId, after, undefined)).toEqual({
        events: [],
        next: after,
      });
      expect(await telemetryController.events('123456789012345', '00042', undefined)).toEqual({
        events: [],
        next: '00042',
      });
      expect(await telemetryController.events('123456789012345', undefined, undefined)).toEqual({
        events: [],
        next: '0',
      });
      for (const limit of ['0', '501', '1.5', 'invalid', ['1']]) {
        await expect(
          telemetryController.events(telemetryUnitId, undefined, limit),
        ).rejects.toMatchObject({ status: 400 });
      }
      for (const after of ['-1', '1.5', '', ['1']]) {
        await expect(
          telemetryController.events(telemetryUnitId, after, undefined),
        ).rejects.toMatchObject({ status: 400 });
      }
      await expect(
        telemetryController.events('invalid-imei', undefined, undefined),
      ).rejects.toMatchObject({ status: 400 });
    } finally {
      telemetryClock.mockRestore();
    }
  } finally {
    releaseSnapshotBatch?.();
    await snapshotService?.onModuleDestroy();
    if (previousGatewayUrl === undefined) {
      delete process.env.ERM_GATEWAY_URL;
    } else {
      process.env.ERM_GATEWAY_URL = previousGatewayUrl;
    }
    if (previousFleetUrl === undefined) {
      delete process.env.FLEET_GRAPHQL_URL;
    } else {
      process.env.FLEET_GRAPHQL_URL = previousFleetUrl;
    }
    if (previousInternalToken === undefined) {
      delete process.env.ERM_INTERNAL_TOKEN;
    } else {
      process.env.ERM_INTERNAL_TOKEN = previousInternalToken;
    }
    if (previousTelemetryToken === undefined) {
      delete process.env.ERM_TELEMETRY_TOKEN;
    } else {
      process.env.ERM_TELEMETRY_TOKEN = previousTelemetryToken;
    }
    if (boundary) {
      await new Promise<void>((resolve, reject) => {
        boundary?.close((error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });
    }
    try {
      await module?.close();
    } finally {
      try {
        await database.close();
      } finally {
        if (captureDirectory !== undefined) {
          await rm(captureDirectory, { recursive: true, force: true });
        }
      }
    }
  }
});
