import { expect, it, jest } from '@jest/globals';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host.js';
import { Test, type TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import net from 'node:net';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer, type Server } from 'node:http';
import {
  GraphQLError,
  GraphQLScalarType,
  graphql,
  parse,
  print,
  type GraphQLResolveInfo,
} from 'graphql';
import { buildSubgraphSchema } from '@apollo/subgraph';
import { PrismaService } from '../src/database/prisma.service.js';
import type { Prisma } from '../src/generated/prisma/client.js';
import type { CaptureRecord } from '../src/modules/devices/capture-record.js';
import { DeviceCaptureService } from '../src/modules/devices/device-capture.service.js';
import { DevicesRepository } from '../src/modules/devices/devices.repository.js';
import {
  RecoveryListener,
  type RecoveryResult,
} from '../src/modules/recovery/recovery-listener.js';
import { RecoveryRepository } from '../src/modules/recovery/recovery.repository.js';
import {
  buildServerFrame,
  FrameSplitter,
  parseFrame,
  type ParsedFrame,
} from '../src/starlink/index.js';
import { redecodeFrames } from '../src/modules/devices/redecode.js';
import { DEFAULT_EVENT_STRUCTURE } from '../src/starlink/event.js';
import { DevicesService } from '../src/modules/devices/devices.service.js';
import { InternalDevicesGuard } from '../src/modules/devices/internal-devices.guard.js';
import { validateCommand } from '../src/modules/devices/command.js';
import { LiveDevicesService } from '../src/modules/telemetry/live-devices.service.js';
import { FleetClient } from '../src/modules/telemetry/fleet.client.js';
import { ParameterSnapshotsRepository } from '../src/modules/telemetry/parameter-snapshots.repository.js';
import { ParameterSnapshotsService } from '../src/modules/telemetry/parameter-snapshots.service.js';
import { ConfigurationChangesService } from '../src/modules/telemetry/configuration-changes.service.js';
import { UnitWorkflowsService } from '../src/modules/telemetry/unit-workflows.service.js';
import { CommandRequestsRepository } from '../src/modules/telemetry/command-requests.repository.js';
import { CommandRequestsService } from '../src/modules/telemetry/command-requests.service.js';
import { parameterCatalog } from '../src/starlink/parameter-catalog.js';
import {
  assembleEdataConfiguration,
  splitEdataDefinitions,
} from '../src/starlink/edata-configuration.js';
import { runEdataChange, runParameterChange } from '../src/modules/telemetry/edata-change.js';
import { EdataChangeRepository } from '../src/modules/telemetry/edata-change.repository.js';
import { InternalTelemetryController } from '../src/modules/telemetry/internal-telemetry.controller.js';
import { InternalTelemetryGuard } from '../src/modules/telemetry/internal-telemetry.guard.js';
import { NotificationExportController } from '../src/modules/notification-export/notification-export.controller.js';
import { NotificationExportRepository } from '../src/modules/notification-export/notification-export.repository.js';
import { NotificationExportService } from '../src/modules/notification-export/notification-export.service.js';
import type { NotificationExportItem } from '../src/modules/notification-export/notification-export.types.js';
import {
  ErmDeviceResolver,
  ErmEventResolver,
  TelemetryResolver,
} from '../src/modules/telemetry/telemetry.resolver.js';
import type { DeviceReference } from '../src/modules/telemetry/telemetry.service.js';
import type {
  ErmDeviceAction,
  ErmEventNameArgs,
  QueryErmCommandRequestArgs,
  QueryErmFleetTelemetryArgs,
  QueryErmFleetProblemsArgs,
  FleetDeviceErmEventsArgs,
  FleetDeviceErmFramesArgs,
  FleetDeviceErmCommandsArgs,
  FleetDeviceErmParameterSnapshotsArgs,
} from '../src/generated/graphql/types.js';
import type { RequestContext } from '../src/graphql/request-context.js';
import { formatGraphqlError } from '../src/graphql/errors.js';
import { DateTimeScalar } from '../src/graphql/scalars.js';
import {
  ErmFleetDeviceDocument,
  ErmFleetDevicesDocument,
} from '../src/generated/graphql/fleet-operations.js';
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
  let configurationService: ConfigurationChangesService | undefined;
  let commandRequests: CommandRequestsService | undefined;
  const previousGatewayUrl = process.env.ERM_GATEWAY_URL;
  const previousFleetUrl = process.env.FLEET_GRAPHQL_URL;
  const previousInternalToken = process.env.ERM_INTERNAL_TOKEN;
  const previousTelemetryToken = process.env.ERM_TELEMETRY_TOKEN;
  const previousConfigurationWrites = process.env.ERM_CONFIGURATION_WRITES_ENABLED;
  try {
    const captureRoot = process.env.ERM_CAPTURE_DIR ?? tmpdir();
    await mkdir(captureRoot, { recursive: true });
    captureDirectory = await mkdtemp(join(captureRoot, 'erm-server-'));
    module = await Test.createTestingModule({
      controllers: [InternalTelemetryController, NotificationExportController],
      providers: [
        DeviceCaptureService,
        DevicesRepository,
        RecoveryRepository,
        TelemetryRepository,
        TelemetryService,
        LiveDevicesService,
        FleetClient,
        UnitWorkflowsService,
        CommandRequestsRepository,
        CommandRequestsService,
        InternalTelemetryGuard,
        NotificationExportRepository,
        NotificationExportService,
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
    const recoveryUnitId = '862129080367646';
    const recoveryRepository = module.get(RecoveryRepository);
    const recoveryFrame = (command: string, reference: string, fields: string[] = []) => {
      const body = [`SLU${recoveryUnitId}`, command, reference, ...fields].join(',');
      const sum = [...Buffer.from(body)].reduce((total, byte) => total + byte, 0);
      return Buffer.from(`$${body}*${(sum % 256).toString(16).toUpperCase().padStart(2, '0')}\r\n`);
    };
    // A fake unit exercises the recovery contract without contacting Karma or a device port.
    for (const scenario of [
      { primaryHost: '65.108.137.165', outcome: 'ALREADY_HOLITA' },
      { primaryHost: 'in.karma.online', outcome: 'NEEDS_OPERATOR' },
    ]) {
      let complete: (result: RecoveryResult) => void = () => undefined;
      let fail: (error: unknown) => void = () => undefined;
      const outcome = new Promise<RecoveryResult>((resolve, reject) => {
        complete = resolve;
        fail = reject;
      });
      const listener = new RecoveryListener((result) => {
        void recoveryRepository.record(result).then(() => {
          complete(result);
        }, fail);
      });
      await new Promise<void>((resolve) => listener.server.listen(0, '127.0.0.1', resolve));
      const address = listener.server.address();
      if (address === null || typeof address === 'string') {
        throw new Error('Expected a fake recovery listener');
      }
      const device = net.connect({ host: '127.0.0.1', port: address.port });
      const frames: ParsedFrame[] = [];
      const splitter = new FrameSplitter();
      device.on('data', (chunk: Buffer) => {
        for (const capture of splitter.push(chunk)) {
          const frame = parseFrame(capture.raw);
          if (!frame) {
            continue;
          }
          frames.push(frame);
          if (frame.command === '45') {
            device.write(
              Buffer.concat([
                recoveryFrame('02', '2', [frame.reference, '01']),
                recoveryFrame('46', '3', ['0049', 'other.example', '0050', '500']),
                recoveryFrame('04', '4', ['0050', '500']),
                recoveryFrame('45', '5', ['0049', `"${scenario.primaryHost}"`, '0050', '"11500"']),
              ]),
            );
          }
        }
      });
      try {
        const closed = once(device, 'close');
        await once(device, 'connect');
        device.write(recoveryFrame('01', '1'));
        await closed;
        const result = await outcome;
        expect(result).toMatchObject({
          unitId: recoveryUnitId,
          outcome: scenario.outcome,
          primaryHost: scenario.primaryHost,
          primaryPort: '11500',
        });
        expect(
          frames.map((frame) => [
            frame.command,
            frame.fields.map((field) => field.toString('latin1')),
          ]),
        ).toEqual([
          ['45', ['0049', '0050']],
          ['02', ['5', '01']],
        ]);
        expect(
          await database.client.ermRecoverySession.findFirst({
            where: { unitId: recoveryUnitId, startedAt: result.startedAt },
          }),
        ).toMatchObject({ outcome: scenario.outcome, primaryHost: scenario.primaryHost });
      } finally {
        device.destroy();
        await listener.stop();
      }
    }
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
      reference: '2',
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

    // A reconnect keeps the resent frame as evidence without storing its report twice.
    const resentConnection = connection + 1;
    capture.record({ connection: resentConnection, event: 'open', peer });
    capture.record({
      connection: resentConnection,
      from: 'device',
      unit: unitId,
      command: '06',
      reference: '2',
      checksum: 'absent',
      frame: eventFrame,
    });
    capture.record(
      { connection: resentConnection, event: 'close', seconds: 1, deviceBytes: 0, serverBytes: 0 },
      'device closed',
    );
    await capture.drain();
    const resentFrames = await database.client.ermFrame.findMany({
      where: { unitId, command: '06', reference: '2' },
      orderBy: { id: 'asc' },
    });
    expect(resentFrames).toHaveLength(2);
    expect(new Set(resentFrames.map(({ connectionId }) => connectionId)).size).toBe(2);
    expect(resentFrames.map(({ raw }) => Buffer.from(raw))).toEqual([
      Buffer.from(eventFrame),
      Buffer.from(eventFrame),
    ]);
    const resentStored = await database.client.ermConnection.findFirstOrThrow({
      where: { unitId, closedAt: { not: null } },
      orderBy: { closedAt: 'desc' },
    });
    expect(await database.client.ermEvent.findMany()).toEqual(events);

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
      mainVoltage: { value: 12.2, observedAt: new Date('2026-11-03T14:25:30.000Z') },
      backupVoltage: { value: 3.6, observedAt: new Date('2026-11-03T14:25:30.000Z') },
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
    const neverConnectedDeviceId = randomUUID();
    const overdueDeviceId = randomUUID();
    const healthDeviceId = randomUUID();
    const fleetDeviceImeis = new Map([
      [deviceId, unitId],
      [neverConnectedDeviceId, '123456789012345'],
    ]);
    const scopedContext = {
      ...context,
      branchId,
      authorization: `Bearer ${issueDemoToken(tenantId)}`,
    };
    let fleetError: string | undefined;
    let gatewayStatus = 200;
    let fleetCalls = 0;
    let gatewayReads = 0;
    let gatewayOnline = true;
    let targetMatches = true;
    let targetUnavailable = false;
    let queueResultCode: string | null = null;
    let queueOutcome: 'answered' | 'timeout' = 'answered';
    let submittingRequestId: string | undefined;
    const sent: unknown[] = [];
    const snapshotCommands: ReturnType<typeof validateCommand>[] = [];
    let configurationGateway:
      | {
          definitions: string[];
          commands: ReturnType<typeof validateCommand>[];
          reads: number;
          preflight?: string[];
          uncertain?: boolean;
          globals?: string;
          globalsMismatch?: boolean;
          globalsWrites?: number;
        }
      | undefined;
    let parameterGateway:
      | {
          value: string;
          mismatch?: boolean;
          uncertain?: boolean;
          unread?: boolean;
          rejected?: boolean;
          writes: number;
          commands: ReturnType<typeof validateCommand>[];
        }
      | undefined;
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
        if (req.url === '/internal/erm-device-target') {
          expect(req.headers.authorization).toBe(
            `Bearer ${String(process.env.ERM_TELEMETRY_TOKEN)}`,
          );
          expect(body).toEqual({ tenantId, branchId, deviceId, imei: unitId });
          res.statusCode = targetUnavailable ? 503 : 200;
          res.end(JSON.stringify({ matches: targetMatches }));
          return;
        }
        if (req.url === '/graphql') {
          fleetCalls++;
          if (
            typeof body === 'object' &&
            body !== null &&
            'query' in body &&
            body.query === print(ErmFleetDevicesDocument) &&
            'variables' in body &&
            typeof body.variables === 'object' &&
            body.variables !== null &&
            'ids' in body.variables &&
            Array.isArray(body.variables.ids)
          ) {
            const ids: unknown[] = body.variables.ids;
            expect(body).toEqual({
              query: print(ErmFleetDevicesDocument),
              variables: { ids, limit: ids.length },
            });
            expect(ids.length).toBeLessThanOrEqual(100);
            expect(req.headers['x-request-id']).toBe(scopedContext.requestId);
            const inScope =
              readDemoTenant(req.headers.authorization) === tenantId &&
              req.headers['x-branch-id'] === branchId;
            const items = ids.flatMap((id) => {
              const imei = typeof id === 'string' && inScope ? fleetDeviceImeis.get(id) : undefined;
              return imei === undefined ? [] : [{ id, imei }];
            });
            res.end(JSON.stringify({ data: { fleetDevices: { items } } }));
            return;
          }
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
            JSON.stringify(
              gatewayOnline
                ? [
                    {
                      unitId,
                      mode: 'primary',
                      peer,
                      connectedSince: sentAt.toISOString(),
                      lastFrameAt: sentAt.toISOString(),
                    },
                  ]
                : [],
            ),
          );
          return;
        }
        const globalsPath = `/internal/units/${unitId}/configuration-changes/`;
        const globalsChangeId =
          req.url?.startsWith(globalsPath) && req.url.endsWith('/globals')
            ? req.url.slice(globalsPath.length, -'/globals'.length)
            : undefined;
        if (globalsChangeId === undefined) {
          expect(req.url).toBe(`/internal/units/${unitId}/commands`);
        }
        if (gatewayStatus !== 200) {
          res.statusCode = gatewayStatus;
          res.end('{}');
          return;
        }
        const command =
          globalsChangeId === undefined
            ? validateCommand(body)
            : await new EdataChangeRepository(database.client).globalsCommand(
                globalsChangeId,
                unitId,
              );
        sent.push(command);
        if (submittingRequestId !== undefined) {
          expect(
            await database.client.ermCommandRequest.findUnique({
              where: { id: submittingRequestId },
            }),
          ).toMatchObject({ status: 'SUBMITTING', submittedAt: expect.any(Date) });
          expect(await requests.find(submittingRequestId, scopedContext)).toMatchObject({
            status: 'SUBMITTING',
            outcomeCode: 'SUBMITTING',
            submittingAt: expect.any(Date),
            sentAt: null,
            transportCommand: null,
            sentFrame: null,
            receivedFrameHex: null,
          });
          submittingRequestId = undefined;
        }
        if (configurationGateway && command.command === '30') {
          const fixture = configurationGateway;
          fixture.commands.push(command);
          const payload = command.fields[7] ?? '';
          const timeout = fixture.uncertain === true && payload.startsWith('02');
          const recorded = await database.client.ermCommand.create({
            data: {
              connectionId: stored.id,
              unitId,
              reference: String(900010000 + sent.length),
              ...command,
              sentAt: new Date(),
              status: timeout ? 'TIMEOUT' : 'ANSWERED',
              answeredAt: timeout ? null : new Date(),
              resultCode: timeout ? null : '01',
            },
          });
          if (command.fields[3] === '302') {
            fixture.globalsWrites = (fixture.globalsWrites ?? 0) + 1;
            fixture.globals =
              fixture.globalsMismatch && fixture.globalsWrites === 1
                ? `${payload.slice(0, -2)}FF`
                : payload;
          } else if (command.fields[3] === '303') {
            const extra = ['19', '0', '410', '0', '1', '1', '1001', fixture.globals ?? ''];
            await database.client.ermFrame.create({
              data: {
                connectionId: stored.id,
                unitId,
                receivedAt: new Date(),
                direction: 'DEVICE',
                command: '06',
                checksum: 'ABSENT',
                raw: Buffer.from(extra.join(',')),
                events: { create: { unitId, eventId: '33', fields: { extra } } },
              },
            });
          } else if (payload === '0702BC') {
            fixture.reads++;
            const definitions =
              fixture.reads === 2 && fixture.preflight ? fixture.preflight : fixture.definitions;
            for (const [index, definition] of definitions.entries()) {
              const extra = [
                '19',
                '0',
                '401',
                '0',
                index === definitions.length - 1 ? '1' : '0',
                String(index + 1),
                '1001',
                `07${definition}`,
              ];
              await database.client.ermFrame.create({
                data: {
                  connectionId: stored.id,
                  unitId,
                  receivedAt: new Date(),
                  direction: 'DEVICE',
                  command: '06',
                  checksum: 'ABSENT',
                  raw: Buffer.from(extra.join(',')),
                  events: {
                    create: { unitId, eventId: '33', fields: { extra } },
                  },
                },
              });
            }
          } else if (payload.startsWith('02') && !timeout) {
            const definition = payload.slice(2);
            const parameter = definition.slice(0, 4);
            const existing = fixture.definitions.findIndex((row) => row.startsWith(parameter));
            if (existing === -1) {
              // Like the unit, store an added definition's predefined multiplier/divisor 1/1 as 0/0.
              fixture.definitions.push(
                definition.slice(16, 24) === '00010001'
                  ? `${definition.slice(0, 16)}00000000${definition.slice(24)}`
                  : definition,
              );
            } else {
              fixture.definitions[existing] = definition;
            }
          } else if (payload.startsWith('10')) {
            fixture.definitions = fixture.definitions.filter(
              (definition) => !definition.startsWith(payload.slice(2)),
            );
          }
          res.end(
            JSON.stringify({
              id: recorded.id,
              reference: recorded.reference,
              status: timeout ? 'timeout' : 'answered',
              resultCode: timeout ? null : '01',
              fields: timeout ? [] : ['30', '01'],
            }),
          );
          return;
        }
        if (parameterGateway && (command.command === '03' || command.command === '04')) {
          const fixture = parameterGateway;
          fixture.commands.push(command);
          if (command.command === '04' && !fixture.rejected) {
            fixture.writes++;
            fixture.value =
              fixture.mismatch && fixture.writes === 1 ? '999' : (command.fields[1] ?? '');
          }
          const timeout = fixture.uncertain && command.command === '04';
          res.end(
            JSON.stringify({
              id: randomUUID(),
              reference: '900020000',
              status: timeout ? 'timeout' : 'answered',
              resultCode: timeout
                ? null
                : fixture.unread
                  ? '02'
                  : command.command === '04'
                    ? fixture.rejected
                      ? '02'
                      : '01'
                    : null,
              fields:
                command.command === '03' && !fixture.unread
                  ? [command.fields[0], `"${fixture.value}"`]
                  : [],
            }),
          );
          return;
        }
        let resultCode: string | null = queueResultCode;
        let fields: string[] = command.command === '48' ? ['IGN=0'] : [];
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
        if (command.command === '05' && queueOutcome === 'answered') {
          resultCode = '01';
        }
        const commandReference = String(900001000 + sent.length);
        const acknowledgementBody = `SLU${unitId},02,8063,${commandReference},${resultCode ?? ''}`;
        const acknowledgementChecksum = [...Buffer.from(acknowledgementBody)].reduce(
          (total, byte) => total + byte,
          0,
        );
        const acknowledgementResponse =
          queueOutcome === 'answered' && resultCode !== null
            ? Buffer.from(
                `$${acknowledgementBody}*${(acknowledgementChecksum % 256).toString(16).toUpperCase().padStart(2, '0')}`,
              )
            : null;
        const recorded = await database.client.ermCommand.create({
          data: {
            connectionId: stored.id,
            unitId,
            reference: commandReference,
            ...command,
            sentAt: new Date(),
            status: queueOutcome === 'answered' ? 'ANSWERED' : 'TIMEOUT',
            answeredAt: queueOutcome === 'answered' ? new Date() : null,
            resultCode,
            response: acknowledgementResponse,
          },
        });
        if (command.command === '05') {
          await database.client.ermFrame.create({
            data: {
              connectionId: stored.id,
              unitId,
              direction: 'HOLITA',
              receivedAt: recorded.sentAt,
              command: command.command,
              reference: recorded.reference,
              checksum: 'OK',
              raw: buildServerFrame(
                unitId,
                command.command,
                recorded.reference,
                command.fields,
              ).subarray(0, -2),
            },
          });
        }
        res.end(
          JSON.stringify({
            id: recorded.id,
            reference: recorded.reference,
            status: queueOutcome,
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
    process.env.ERM_TELEMETRY_TOKEN = 'erm-queue-target-test-token-32-characters';
    commandRequests = new CommandRequestsService(
      new CommandRequestsRepository(module.get(PrismaService)),
      new LiveDevicesService(),
      new FleetClient(),
      module.get(UnitWorkflowsService),
    );
    const requests = commandRequests;
    const api = new TelemetryService(
      module.get(TelemetryRepository),
      new LiveDevicesService(),
      requests,
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
    let acknowledgedRequestId = '';
    for (const [action, command, fields] of actions) {
      const queued = await api.sendDeviceCommand({ deviceId, action }, scopedContext);
      expect(queued).toMatchObject({
        status: 'QUEUED',
        actorId: `demo-tenant:${tenantId}`,
        intent: action,
        actionCode: action,
        displayParameters: { expiresInSeconds: 7200 },
        requestedAt: expect.any(Date),
        queuedAt: queued.createdAt,
        outcomeCode: 'WAITING_TO_SEND',
        reasonCode: null,
        submittedAt: null,
        sentAt: null,
        transportCommand: null,
        sentFrame: null,
        receivedFrameHex: null,
        configurationVerification: null,
      });
      submittingRequestId = queued.id;
      await requests.tick();
      expect(sent.at(-1)).toEqual({ command, fields });
      const recorded = await database.client.ermCommandRequest.findUniqueOrThrow({
        where: { id: queued.id },
      });
      expect(recorded).toMatchObject({ unitId, action, status: 'ANSWERED' });
      expect(
        recorded.commandId === null
          ? null
          : await database.client.ermCommand.findUnique({ where: { id: recorded.commandId } }),
      ).not.toBeNull();
      if (action === 'REQUEST_LOCATION') {
        acknowledgedRequestId = queued.id;
      }
    }
    gatewayStatus = 404;
    const refusedQueue = await api.sendDeviceCommand(
      { deviceId, action: 'REQUEST_LOCATION' },
      scopedContext,
    );
    await requests.tick();
    expect(
      await database.client.ermCommandRequest.findUnique({ where: { id: refusedQueue.id } }),
    ).toMatchObject({
      status: 'FAILED',
      failureReason: expect.stringContaining('gateway refused'),
    });
    gatewayStatus = 200;
    const sentBeforeQueue = sent.length;
    const queueHistoryDeviceId = randomUUID();
    await database.client.ermCommandRequest.createMany({
      data: Array.from({ length: 50 }, (_, index) => ({
        tenantId,
        branchId,
        deviceId: queueHistoryDeviceId,
        unitId: '123456789012346',
        actorId: `demo-tenant:${tenantId}`,
        intent: 'Older offline read',
        action: 'READ_STATUS' as const,
        createdAt: new Date(Date.UTC(2020, 0, 1, 0, 0, index)),
        expiresAt: new Date(Date.now() + 3_600_000),
      })),
    });
    gatewayOnline = false;
    const offlineQueue = await requests.request(
      { deviceId, action: 'READ_STATUS', intent: 'Inspect parked truck' },
      scopedContext,
    );
    await requests.tick();
    expect(sent).toHaveLength(sentBeforeQueue);
    expect(
      await database.client.ermCommandRequest.findUnique({ where: { id: offlineQueue.id } }),
    ).toMatchObject({ status: 'QUEUED' });
    gatewayOnline = true;
    targetUnavailable = true;
    await requests.tick();
    expect(sent).toHaveLength(sentBeforeQueue);
    targetUnavailable = false;
    await requests.tick();
    expect(sent).toHaveLength(sentBeforeQueue + 1);
    expect(
      await database.client.ermCommandRequest.findUnique({ where: { id: offlineQueue.id } }),
    ).toMatchObject({ responseText: 'IGN=0', intent: 'Inspect parked truck' });
    await requests.tick();
    expect(sent).toHaveLength(sentBeforeQueue + 1);
    const cancelledQueue = await requests.request(
      { deviceId, action: 'READ_VERSION' },
      scopedContext,
    );
    await expect(
      requests.cancel(
        { deviceId, requestId: cancelledQueue.id },
        { ...scopedContext, branchId: randomUUID() },
      ),
    ).rejects.toMatchObject({ status: 404 });
    expect(
      await requests.cancel({ deviceId, requestId: cancelledQueue.id }, scopedContext),
    ).toMatchObject({ status: 'CANCELLED' });
    await expect(
      requests.cancel({ deviceId, requestId: offlineQueue.id }, scopedContext),
    ).rejects.toMatchObject({ status: 409 });
    for (const scenario of [
      { name: 'expiry', status: 'EXPIRED', expired: true },
      { name: 'target changed', status: 'FAILED', changed: true },
      { name: 'unit rejected', status: 'FAILED', rejected: true },
      { name: 'unconfirmed wire', status: 'UNCERTAIN', uncertain: true },
    ]) {
      const queued = await requests.request({ deviceId, action: 'READ_STATUS' }, scopedContext);
      if (scenario.expired) {
        await database.client.ermCommandRequest.update({
          where: { id: queued.id },
          data: { expiresAt: new Date(0) },
        });
      }
      targetMatches = !scenario.changed;
      queueResultCode = scenario.rejected ? '02' : null;
      queueOutcome = scenario.uncertain ? 'timeout' : 'answered';
      await requests.tick();
      expect({
        name: scenario.name,
        status: (
          await database.client.ermCommandRequest.findUniqueOrThrow({ where: { id: queued.id } })
        ).status,
      }).toEqual({ name: scenario.name, status: scenario.status });
      const after = sent.length;
      await requests.tick();
      expect(sent).toHaveLength(after);
    }
    targetMatches = true;
    queueResultCode = null;
    queueOutcome = 'answered';
    const interruptedQueue = await requests.request(
      { deviceId, action: 'READ_STATUS' },
      scopedContext,
    );
    await database.client.ermCommandRequest.update({
      where: { id: interruptedQueue.id },
      data: { status: 'SUBMITTING', submittedAt: new Date() },
    });
    await requests.onModuleInit();
    expect(
      await database.client.ermCommandRequest.findUnique({ where: { id: interruptedQueue.id } }),
    ).toMatchObject({ status: 'UNCERTAIN', completedAt: expect.any(Date) });
    const afterInterrupted = sent.length;
    await requests.tick();
    expect(sent).toHaveLength(afterInterrupted);
    await requests.onModuleDestroy();
    await database.client.ermCommandRequest.updateMany({
      where: { deviceId: queueHistoryDeviceId },
      data: { status: 'CANCELLED', completedAt: new Date() },
    });
    await database.client.ermCommandRequest.create({
      data: {
        tenantId,
        branchId,
        deviceId: queueHistoryDeviceId,
        unitId: '123456789012346',
        actorId: `demo-tenant:${tenantId}`,
        intent: 'Newest history row',
        action: 'READ_STATUS',
        status: 'CANCELLED',
        createdAt: new Date(Date.UTC(2020, 0, 1, 0, 0, 50)),
        expiresAt: new Date(Date.now() + 3_600_000),
      },
    });
    for (const foreignScope of [
      { tenantId: randomUUID(), branchId },
      { tenantId, branchId: randomUUID() },
    ]) {
      await database.client.ermCommandRequest.create({
        data: {
          ...foreignScope,
          deviceId,
          unitId,
          actorId: 'foreign-session',
          intent: 'Foreign audit row',
          action: 'READ_STATUS',
          status: 'ANSWERED',
          expiresAt: new Date(Date.now() + 3_600_000),
        },
      });
    }
    const queueHistoryRequest = deviceTelemetryRequest(
      [unitId, '123456789012346'],
      [
        { id: deviceId, imei: unitId },
        { id: queueHistoryDeviceId, imei: '123456789012346' },
      ],
    );
    const [ownQueueHistory, otherQueueHistory] = await Promise.all([
      requests.deviceRequests(
        { ...reference(), id: deviceId, telemetryRequest: queueHistoryRequest },
        scopedContext,
      ),
      requests.deviceRequests(
        {
          ...reference(),
          id: queueHistoryDeviceId,
          imei: '123456789012346',
          telemetryRequest: queueHistoryRequest,
        },
        scopedContext,
      ),
    ]);
    expect(ownQueueHistory.every(({ actorId }) => actorId === `demo-tenant:${tenantId}`)).toBe(
      true,
    );
    expect(otherQueueHistory).toHaveLength(50);
    expect(otherQueueHistory[0]?.intent).toBe('Newest history row');

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
    fleetDeviceImeis.set(overdueDeviceId, overdueUnitId);
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
      module.get(UnitWorkflowsService),
    );
    const snapshots = snapshotService;
    process.env.ERM_CONFIGURATION_WRITES_ENABLED = 'false';
    configurationService = new ConfigurationChangesService(
      module.get(PrismaService),
      new LiveDevicesService(),
      new FleetClient(),
      snapshots,
      module.get(UnitWorkflowsService),
    );
    const configurations = configurationService;
    const resolver = new ErmDeviceResolver(api, snapshots, configurations, requests);
    const eventResolver = new ErmEventResolver();
    const telemetryResolver = new TelemetryResolver(api, snapshots, configurations, requests);
    const dateTime = new DateTimeScalar();
    const schema = buildSubgraphSchema([
      {
        typeDefs: parse(
          await readFile(
            new URL('../src/modules/telemetry/telemetry.graphql', import.meta.url),
            'utf8',
          ),
        ),
        resolvers: {
          DateTime: new GraphQLScalarType({
            name: 'DateTime',
            serialize: (value) => dateTime.serialize(value),
            parseValue: (value) => dateTime.parseValue(value),
            parseLiteral: (node) => dateTime.parseLiteral(node),
          }),
          Query: {
            ermFleetTelemetry: (
              _parent: unknown,
              args: QueryErmFleetTelemetryArgs,
              ctx: RequestContext,
            ) => telemetryResolver.fleetTelemetry(args, ctx),
            ermFleetProblems: (
              _parent: unknown,
              args: QueryErmFleetProblemsArgs,
              ctx: RequestContext,
            ) => telemetryResolver.fleetProblems(args, ctx),
            ermCommandRequest: (
              _parent: unknown,
              args: QueryErmCommandRequestArgs,
              ctx: RequestContext,
            ) => telemetryResolver.commandRequest(args, ctx),
          },
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
            ermConfigurationChanges: (ref: DeviceReference, _args: unknown, ctx: RequestContext) =>
              resolver.configurationChanges(ref, ctx),
            ermConfigurationWritesEnabled: (
              _ref: DeviceReference,
              _args: unknown,
              ctx: RequestContext,
            ) => resolver.configurationWritesEnabled(ctx),
            ermCommandRequests: (ref: DeviceReference, _args: unknown, ctx: RequestContext) =>
              resolver.commandRequestsHistory(ref, ctx),
          },
          ErmEvent: {
            name: (parent: { eventId: string | null }, args: ErmEventNameArgs) =>
              eventResolver.name(parent, args),
          },
        },
      },
    ]);
    const requestSource = `query($id: ID!) { ermCommandRequest(id: $id) {
      id status actionCode requestedAt queuedAt submittingAt sentAt answeredAt outcomeCode reasonCode
      displayParameters { expiresInSeconds requestedFields }
      transportCommand { id reference sentAt answeredAt responseHex acknowledgement {
        commandId commandReference replyReference resultCode receivedAt
      } }
      sentFrame { rawHex receivedAt }
      receivedFrameHex configurationVerification { id }
    } }`;
    const acknowledgedRequest = await requests.find(acknowledgedRequestId, scopedContext);
    expect(acknowledgedRequest?.receivedFrameHex).not.toBeNull();
    const requestContract = await graphql({
      schema,
      source: requestSource,
      variableValues: { id: acknowledgedRequestId },
      contextValue: scopedContext,
    });
    expect(requestContract.errors).toBeUndefined();
    expect(requestContract.data?.['ermCommandRequest']).toMatchObject({
      id: acknowledgedRequestId,
      status: 'ANSWERED',
      actionCode: 'REQUEST_LOCATION',
      outcomeCode: 'ACKNOWLEDGED',
      reasonCode: null,
      displayParameters: { expiresInSeconds: 7200, requestedFields: [] },
      requestedAt: acknowledgedRequest?.createdAt.toISOString(),
      sentAt: acknowledgedRequest?.sentAt?.toISOString(),
      answeredAt: acknowledgedRequest?.answeredAt?.toISOString(),
      transportCommand: {
        id: acknowledgedRequest?.commandId,
        reference: '900001001',
        acknowledgement: {
          commandReference: '900001001',
          commandId: acknowledgedRequest?.commandId,
          replyReference: '8063',
          resultCode: '01',
          receivedAt: acknowledgedRequest?.answeredAt?.toISOString(),
        },
      },
      sentFrame: {
        rawHex: buildServerFrame(unitId, '05', '900001001', []).subarray(0, -2).toString('hex'),
        receivedAt: acknowledgedRequest?.sentAt?.toISOString(),
      },
      receivedFrameHex: acknowledgedRequest?.receivedFrameHex,
      configurationVerification: null,
    });
    for (const foreignScope of [
      { tenantId: randomUUID(), branchId },
      { tenantId, branchId: randomUUID() },
    ]) {
      const denied = await graphql({
        schema,
        source: requestSource,
        variableValues: { id: acknowledgedRequestId },
        contextValue: { ...scopedContext, ...foreignScope },
      });
      expect(denied.errors).toBeUndefined();
      expect(denied.data?.['ermCommandRequest']).toBeNull();
    }
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
    gatewayReads = 0;
    const fleetCallsBeforeEntities = fleetCalls;
    const result = await graphql({
      schema,
      source,
      variableValues: {
        representations: [
          { __typename: 'FleetDevice', id: deviceId, imei: unitId },
          { __typename: 'FleetDevice', id: neverConnectedDeviceId, imei: '123456789012345' },
          { __typename: 'FleetDevice', id: overdueDeviceId, imei: overdueUnitId },
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
            expectedIntervalSeconds: 300,
            overdue: false,
            lastCloseReason: 'device closed',
            lastClosedAt: resentStored.closedAt?.toISOString(),
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
        id: neverConnectedDeviceId,
        ermState: null,
        ermEvents: { items: [] },
        ermFrames: { items: [] },
        ermCommands: { items: [] },
      },
      {
        id: overdueDeviceId,
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
    expect(fleetCalls - fleetCallsBeforeEntities).toBe(1);

    const foreignTenantId = randomUUID();
    for (const deniedScope of [
      scopedContext,
      { ...scopedContext, branchId: randomUUID() },
      {
        ...scopedContext,
        tenantId: foreignTenantId,
        authorization: `Bearer ${issueDemoToken(foreignTenantId)}`,
      },
    ]) {
      const denied = await graphql({
        schema,
        source,
        variableValues: {
          representations:
            deniedScope === scopedContext
              ? [
                  { __typename: 'FleetDevice', id: deviceId, imei: overdueUnitId },
                  { __typename: 'FleetDevice', id: randomUUID(), imei: unitId },
                ]
              : [{ __typename: 'FleetDevice', id: deviceId, imei: unitId }],
        },
        contextValue: { ...deniedScope },
      });
      expect(denied.errors).toBeUndefined();
      expect(denied.data?.['_entities']).toEqual(
        deniedScope === scopedContext ? [null, null] : [null],
      );
    }

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
            { __typename: 'FleetDevice', id: neverConnectedDeviceId, imei: '123456789012345' },
            { __typename: 'FleetDevice', id: deviceId, imei: unitId },
            { __typename: 'FleetDevice', id: overdueDeviceId, imei: overdueUnitId },
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

    // Health uses receipt gaps and carries known state through frames without status fields.
    const healthSnapshot = new Date();
    const healthSince = new Date(healthSnapshot.getTime() - 24 * 60 * 60_000);
    const healthUnitId = '862129080366699';
    fleetDeviceImeis.set(healthDeviceId, healthUnitId);
    const healthConnection = await database.client.ermConnection.create({
      data: { unitId: healthUnitId, peer, upstream, openedAt: healthSince },
    });
    const atMinute = (minute: number) => new Date(healthSince.getTime() + minute * 60_000);
    const healthFixtures: {
      minute: number;
      direction?: 'DEVICE' | 'UPSTREAM';
      partial?: boolean;
      event?: {
        eventId?: string;
        engineOn?: boolean;
        speedKmh?: number;
        fields: Prisma.InputJsonObject;
      };
    }[] = [
      {
        minute: -30,
        event: { engineOn: true, speedKmh: 20, fields: { '#NT#': '7', '#NC#': '28401' } },
      },
      { minute: -25, event: { speedKmh: 0, fields: {} } },
      { minute: -20 },
      { minute: 1 },
      { minute: 4, event: { speedKmh: 0, fields: {} } },
      { minute: 20, event: { eventId: '23', fields: { '#NT#': '8' } } },
      { minute: 21, event: { eventId: '23', fields: {} } },
      { minute: 24, event: { fields: { '#NT#': null, '#NC#': '28403' } } },
      { minute: 30, event: { engineOn: true, speedKmh: 0, fields: { '#IGN#': '0' } } },
      {
        minute: 31,
        partial: true,
        event: { engineOn: true, fields: { '#IGN#': '1', '#NT#': '9' } },
      },
      { minute: 32, direction: 'UPSTREAM' },
      { minute: 180, event: { fields: {} } },
    ];
    for (const fixture of healthFixtures) {
      await database.client.ermFrame.create({
        data: {
          connectionId: healthConnection.id,
          unitId: healthUnitId,
          direction: fixture.direction ?? 'DEVICE',
          partial: fixture.partial ?? false,
          receivedAt: atMinute(fixture.minute),
          checksum: 'ABSENT',
          raw: Buffer.from('$health-fixture'),
          ...(fixture.event === undefined
            ? {}
            : {
                events: { create: [{ ...fixture.event, unitId: healthUnitId }] },
              }),
        },
      });
    }
    const otherHealthUnitId = '862129080366698';
    await database.client.ermConnection.create({
      data: {
        unitId: otherHealthUnitId,
        peer,
        upstream,
        frames: {
          create: [
            {
              unitId: otherHealthUnitId,
              direction: 'DEVICE',
              receivedAt: new Date(healthSnapshot.getTime() - 60_000),
              checksum: 'ABSENT',
              raw: Buffer.from('$other-health-fixture'),
              events: {
                create: [{ unitId: otherHealthUnitId, fields: { '#NT#': '99', '#NC#': '99999' } }],
              },
            },
          ],
        },
      },
    });
    const healthStates = await module
      .get(TelemetryRepository)
      .deviceStates([healthUnitId, otherHealthUnitId], healthSnapshot);
    expect(healthStates.find((entry) => entry.unitId === healthUnitId)).toMatchObject({
      expectedIntervalSeconds: 3600,
      gapsLast24h: [
        {
          from: atMinute(0),
          to: atMinute(1),
          durationSeconds: 60,
          expectedIntervalSeconds: 300,
        },
        {
          from: atMinute(4),
          to: atMinute(20),
          durationSeconds: 960,
          expectedIntervalSeconds: 300,
        },
        {
          from: atMinute(30),
          to: atMinute(180),
          durationSeconds: 9000,
          expectedIntervalSeconds: 3600,
        },
        {
          from: atMinute(180),
          to: healthSnapshot,
          durationSeconds: 75600,
          expectedIntervalSeconds: 3600,
        },
      ],
      networkChangesLast24h: 3,
      latestNetworkChange: {
        at: atMinute(24),
        networkType: '8',
        operatorCode: '28403',
      },
    });
    expect(healthStates.find((entry) => entry.unitId === otherHealthUnitId)).toMatchObject({
      expectedIntervalSeconds: 3600,
      gapsLast24h: [],
      networkChangesLast24h: 0,
      latestNetworkChange: null,
    });
    const healthContract = await graphql({
      schema,
      source: `query($representations: [_Any!]!) { _entities(representations: $representations) { ... on FleetDevice {
        ermState { health {
          expectedIntervalSeconds gapsLast24h { from to durationSeconds expectedIntervalSeconds }
          networkChangesLast24h latestNetworkChange { at networkType operatorCode }
        } }
      } } }`,
      variableValues: {
        representations: [{ __typename: 'FleetDevice', id: healthDeviceId, imei: healthUnitId }],
      },
      contextValue: { ...scopedContext },
    });
    expect(healthContract.errors).toBeUndefined();
    expect(healthContract.data?.['_entities']).toMatchObject([
      {
        ermState: {
          health: {
            expectedIntervalSeconds: 3600,
            gapsLast24h: expect.arrayContaining([
              {
                from: atMinute(4).toISOString(),
                to: atMinute(20).toISOString(),
                durationSeconds: 960,
                expectedIntervalSeconds: 300,
              },
            ]),
            networkChangesLast24h: 3,
            latestNetworkChange: {
              at: atMinute(24).toISOString(),
              networkType: '8',
              operatorCode: '28403',
            },
          },
        },
      },
    ]);

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
        tenantId,
        branchId,
        deviceId,
        actorId: `demo-tenant:${tenantId}`,
        intent: 'Previous scoped snapshot',
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
    for (const foreignScope of [
      { tenantId: randomUUID(), branchId, deviceId },
      { tenantId, branchId: randomUUID(), deviceId },
      { tenantId, branchId, deviceId: randomUUID() },
      { tenantId: null, branchId: null, deviceId: null },
      { tenantId, branchId, deviceId },
    ]) {
      await database.client.ermParameterSnapshot.create({
        data: {
          ...foreignScope,
          unitId,
          status: 'COMPLETE',
          startedAt: new Date(Date.now() - 500),
          actorId:
            foreignScope.tenantId === tenantId &&
            foreignScope.branchId === branchId &&
            foreignScope.deviceId === deviceId
              ? null
              : 'foreign-session',
          finishedAt: new Date(Date.now() - 300),
          parameterCount: 1,
          readCount: 1,
          values: { create: [{ parameter: 1, value: 'foreign previous value' }] },
        },
      });
    }
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
      await expect(
        configurations.startEdata({ deviceId, read: true }, scopedContext),
      ).rejects.toMatchObject({ status: 409 });
      const lockedQueue = await api.sendDeviceCommand(
        { deviceId, action: 'READ_STATUS' },
        scopedContext,
      );
      const beforeLockedTick = sent.length;
      await requests.tick();
      expect(sent).toHaveLength(beforeLockedTick);
      expect(
        await requests.cancel({ deviceId, requestId: lockedQueue.id }, scopedContext),
      ).toMatchObject({ status: 'CANCELLED' });
      releaseSnapshotBatch?.();
      await snapshots.onModuleDestroy();
    } finally {
      releaseSnapshotBatch?.();
      await snapshots.onModuleDestroy();
    }
    const snapshotPage = await snapshots.deviceSnapshots(
      { ...reference(), id: deviceId },
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
      actorId: `demo-tenant:${tenantId}`,
      intent: 'Read parameter snapshot',
      unitId,
      status: 'COMPLETE',
      parameterCount: snapshotParameters.length,
      readCount: snapshotParameters.length,
      failureReason: null,
      finishedAt: expect.any(Date),
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
          { __typename: 'FleetDevice', id: neverConnectedDeviceId, imei: '123456789012345' },
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
      raw: Buffer.from(eventFrame.replace(',06,2,', ',06,6001,')),
    } as const;
    const missingFrame = await database.client.ermFrame.create({ data: redecodeFixture });
    const changedFrame = await database.client.ermFrame.create({
      data: { ...redecodeFixture, raw: Buffer.from(eventFrame.replace(',06,2,', ',06,6002,')) },
    });
    const duplicateInsertFrame = await database.client.ermFrame.create({ data: redecodeFixture });
    const duplicateUpdateFrame = await database.client.ermFrame.create({ data: redecodeFixture });
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
    const duplicateEvent = await database.client.ermEvent.create({
      data: { frameId: duplicateUpdateFrame.id, unitId, eventId: '99', fields: {} },
    });
    const framesBefore = await database.client.ermFrame.findMany({ orderBy: { id: 'asc' } });
    const structure = DEFAULT_EVENT_STRUCTURE.split(',');
    expect(await redecodeFrames(database.client, structure, redecodeStartedAt)).toEqual({
      framesScanned: 5,
      eventsUpdated: 1,
      eventsInserted: 1,
      surplusEvents: 1,
      decodeFailures: 1,
      duplicates: 2,
    });
    expect(await redecodeFrames(database.client, structure, redecodeStartedAt)).toEqual({
      framesScanned: 5,
      eventsUpdated: 0,
      eventsInserted: 0,
      surplusEvents: 1,
      decodeFailures: 1,
      duplicates: 2,
    });
    expect(await database.client.ermFrame.findMany({ orderBy: { id: 'asc' } })).toEqual(
      framesBefore,
    );
    expect(await database.client.ermEvent.count({ where: { frameId: missingFrame.id } })).toBe(1);
    expect(
      await database.client.ermEvent.findFirst({ where: { frameId: missingFrame.id } }),
    ).toMatchObject({ reference: '6001' });
    expect(
      await database.client.ermEvent.count({ where: { frameId: duplicateInsertFrame.id } }),
    ).toBe(0);
    expect(await database.client.ermEvent.findUnique({ where: { id: duplicateEvent.id } })).toEqual(
      duplicateEvent,
    );
    expect(
      await database.client.ermEvent.findUnique({ where: { id: changedEvent.id } }),
    ).toMatchObject({
      frameId: changedFrame.id,
      reference: '6002',
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
        fields: { private: 'not part of the Fleet contract', '#IGN#': '1' },
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
    const fourthTelemetryEvent = await database.client.ermEvent.create({
      data: {
        frameId: telemetryFrame.id,
        unitId: telemetryUnitId,
        eventId: '33',
        fields: {
          edata: {
            type: 405,
            parameters: [
              { parameter: 1, type: 0, valueSize: 1, valueHex: 'FF' },
              { parameter: 188, type: 1, valueSize: 2, valueHex: 'aBcD' },
              { parameter: 65535, type: 255, valueSize: 4, valueHex: 'FFFFFFFF' },
            ],
          },
        },
      },
    });
    const fifthTelemetryEvent = await database.client.ermEvent.create({
      data: {
        frameId: telemetryFrame.id,
        unitId: telemetryUnitId,
        eventId: '33',
        fields: {
          edata: {
            type: 405,
            parameters: [
              { parameter: 1, type: 0, valueSize: 1, valueHex: 'FF' },
              { parameter: 188, type: 1, valueSize: 2, valueHex: 'FF' },
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
        String(fourthTelemetryEvent.id),
        String(fifthTelemetryEvent.id),
      ]);
      expect(exported.next).toBe(String(fifthTelemetryEvent.id));
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
        ignitionOn: true,
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
        ignitionOn: null,
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
      expect(exported.events[3]?.edata).toEqual({
        report: '405',
        measurements: [
          { parameterId: 1, parameterType: 0, valueSize: 1, valueHex: 'FF' },
          { parameterId: 188, parameterType: 1, valueSize: 2, valueHex: 'aBcD' },
          { parameterId: 65535, parameterType: 255, valueSize: 4, valueHex: 'FFFFFFFF' },
        ],
      });
      expect(exported.events[4]?.edata).toBeNull();
      expect(
        await telemetryController.events(telemetryUnitId, String(firstTelemetryEvent.id), '1'),
      ).toEqual({ events: [exported.events[1]], next: String(secondTelemetryEvent.id) });
      const after = String(fifthTelemetryEvent.id);
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

    // Configuration writes use complete, independent whole-set reads and never replay ambiguity.
    const firstDefinition = '029680BD000100080001000100000100010000F0003C';
    const secondDefinition = `021B${firstDefinition.slice(4)}`;
    const addedDefinition = `0099${firstDefinition.slice(4)}`;
    const changedDefinition = `${firstDefinition.slice(0, -4)}0078`;
    const configurationAt = new Date().toISOString();
    const fragment = (
      number: number,
      last: boolean,
      definition: string,
      eventId = String(number),
    ) => ({
      eventId,
      receivedAt: configurationAt,
      fields: ['19', '0', '401', '0', last ? '1' : '0', String(number), '1001', `07${definition}`],
    });
    const expectedDefinitions = [
      { parameter: 539, interval: 60, definition: secondDefinition },
      { parameter: 662, interval: 60, definition: firstDefinition },
    ];
    const completeFragments = [
      fragment(1, false, firstDefinition),
      fragment(2, true, secondDefinition),
    ];
    expect(assembleEdataConfiguration(completeFragments)).toMatchObject({
      configurationId: '1001',
      definitions: expectedDefinitions,
      eventIds: ['1', '2'],
    });
    for (const fragments of [
      [fragment(1, false, firstDefinition), fragment(3, true, secondDefinition)],
      [fragment(1, true, firstDefinition), fragment(2, true, secondDefinition)],
      [...completeFragments, fragment(2, true, addedDefinition, '3')],
    ]) {
      expect(assembleEdataConfiguration(fragments)).toBeUndefined();
    }
    expect(splitEdataDefinitions(`01${secondDefinition}${firstDefinition}`)).toEqual(
      expectedDefinitions,
    );
    // ERM's own export prefixes each command with tab-separated message columns.
    expect(
      splitEdataDefinitions(
        `Message #\t1\tFrom\t1\tMessages\t\t30,1,19,0,19,301,0,1,1,01${secondDefinition}${firstDefinition}\n`,
      ),
    ).toEqual(expectedDefinitions);
    const configurationRuntime = { pollIntervalMs: 1, readTimeoutMs: 90_000, log: () => undefined };
    configurationGateway = {
      definitions: [firstDefinition, secondDefinition],
      commands: [],
      reads: 0,
    };
    const intervalChange = await runEdataChange(
      database.client,
      { unitId, parameter: 662, interval: 120, restoreAfter: true },
      configurationRuntime,
    );
    expect(intervalChange).toMatchObject({
      unitId,
      parameter: 662,
      status: 'RESTORED',
      intended: changedDefinition,
      finishedAt: expect.any(Date),
      baseline: { definitions: expectedDefinitions },
    });
    expect(configurationGateway.definitions).toEqual([firstDefinition, secondDefinition]);
    expect(
      configurationGateway.commands
        .filter(({ fields }) => fields[7]?.startsWith('02'))
        .map(({ fields }) => fields[7]),
    ).toEqual([`02${changedDefinition}`, `02${firstDefinition}`]);
    expect(intervalChange.steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'baseline', commandId: expect.any(String) }),
        expect.objectContaining({ name: 'preflight', commandId: expect.any(String) }),
        expect.objectContaining({ name: 'readback', outcome: 'VERIFIED' }),
        expect.objectContaining({ name: 'restore-readback', outcome: 'RESTORED' }),
      ]),
    );
    expect(
      await database.client.ermConfigurationChange.findUnique({ where: { id: intervalChange.id } }),
    ).toEqual(intervalChange);

    configurationGateway = {
      definitions: [firstDefinition, secondDefinition],
      commands: [],
      reads: 0,
    };
    const addition = await runEdataChange(
      database.client,
      { unitId, add: addedDefinition, restoreAfter: true },
      configurationRuntime,
    );
    expect(addition).toMatchObject({
      status: 'RESTORED',
      parameter: 153,
      intended: addedDefinition,
    });
    expect(configurationGateway.definitions).toEqual([firstDefinition, secondDefinition]);
    expect(
      configurationGateway.commands
        .filter(({ fields }) => fields[7]?.startsWith('02') || fields[7]?.startsWith('10'))
        .map(({ fields }) => fields[7]),
    ).toEqual([`02${addedDefinition}`, '100099']);
    expect(addition.steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'readback', outcome: 'VERIFIED' }),
        expect.objectContaining({ name: 'restore-readback', outcome: 'RESTORED' }),
      ]),
    );

    configurationGateway = {
      definitions: [firstDefinition, secondDefinition],
      commands: [],
      reads: 0,
    };
    const refusedAddition = await runEdataChange(
      database.client,
      { unitId, add: firstDefinition },
      configurationRuntime,
    );
    expect(refusedAddition.status).toBe('REFUSED');
    expect(configurationGateway.commands.map(({ fields }) => fields[7])).toEqual(['0702BC']);

    configurationGateway = {
      definitions: [firstDefinition, secondDefinition],
      commands: [],
      reads: 0,
      preflight: [firstDefinition, `${secondDefinition.slice(0, -4)}0078`],
    };
    const changedPreflight = await runEdataChange(
      database.client,
      { unitId, parameter: 662, interval: 120 },
      configurationRuntime,
    );
    expect(changedPreflight.status).toBe('REFUSED');
    expect(configurationGateway.commands.map(({ fields }) => fields[7])).toEqual([
      '0702BC',
      '0702BC',
    ]);

    // One table extends this case for the whole-globals write/readback contract.
    const globalsBefore =
      '03E903E8010208000101000000000003130100000303010000000000000000000000000000000000000000000000000000';
    const globalsWritten = `${globalsBefore.slice(0, 22)}010101${globalsBefore.slice(28, 36)}01${globalsBefore.slice(38)}`;
    const globalsExpected = globalsWritten;
    expect(() =>
      validateCommand({
        command: '30',
        fields: ['19', '0', '19', '302', '0', '1', '1', globalsWritten],
      }),
    ).toThrow();
    for (const scenario of [
      {
        name: 'verified',
        baseline: globalsBefore,
        mismatch: false,
        restoreAfter: false,
        status: 'VERIFIED',
        writes: [globalsWritten],
      },
      {
        name: 'explicit restore',
        baseline: globalsBefore,
        mismatch: false,
        restoreAfter: true,
        status: 'RESTORED',
        writes: [globalsWritten, globalsBefore],
      },
      {
        name: 'mismatch restores',
        baseline: globalsBefore,
        mismatch: true,
        restoreAfter: false,
        status: 'RESTORED',
        writes: [globalsWritten, globalsBefore],
      },
      {
        name: 'no-op',
        baseline: globalsExpected,
        mismatch: false,
        restoreAfter: false,
        status: 'VERIFIED',
        writes: [],
      },
    ]) {
      configurationGateway = {
        definitions: [],
        commands: [],
        reads: 0,
        globals: scenario.baseline,
        globalsMismatch: scenario.mismatch,
      };
      const change = await runEdataChange(
        database.client,
        { unitId, globals: globalsWritten, restoreAfter: scenario.restoreAfter },
        configurationRuntime,
      );
      expect({ name: scenario.name, status: change.status }).toEqual({
        name: scenario.name,
        status: scenario.status,
      });
      expect(change.baseline).toEqual({ globals: scenario.baseline });
      expect(
        configurationGateway.commands
          .filter(({ fields }) => fields[3] === '302')
          .map(({ fields }) => fields[7]),
      ).toEqual(scenario.writes);
      expect(
        configurationGateway.commands.every(
          ({ fields }) => fields[3] === '302' || fields[3] === '303',
        ),
      ).toBe(true);
      expect(change.steps).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'before', payload: scenario.baseline }),
          expect.objectContaining({ name: 'written', payload: globalsWritten }),
          expect.objectContaining({ name: 'expected', payload: globalsExpected }),
        ]),
      );
      if (scenario.writes.length > 0) {
        expect(change.steps).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              name: 'readback',
              outcome: scenario.mismatch ? 'MISMATCH' : 'VERIFIED',
              payload: scenario.mismatch ? `${globalsExpected.slice(0, -2)}FF` : globalsExpected,
            }),
          ]),
        );
      }
      if (scenario.status === 'RESTORED') {
        expect(configurationGateway.globals).toBe(scenario.baseline);
        expect(change.steps).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: 'restore-readback', payload: scenario.baseline }),
          ]),
        );
      }
      await expect(
        new EdataChangeRepository(database.client).globalsCommand(change.id, unitId),
      ).rejects.toThrow();
    }

    configurationGateway = undefined;
    for (const scenario of [
      { name: 'parameter verified', value: '60', status: 'VERIFIED', commands: ['03', '04', '03'] },
      {
        name: 'parameter restore',
        value: '60',
        restoreAfter: true,
        status: 'RESTORED',
        commands: ['03', '04', '03', '04', '03'],
      },
      {
        name: 'parameter mismatch',
        value: '60',
        mismatch: true,
        status: 'RESTORED',
        commands: ['03', '04', '03', '04', '03'],
      },
      { name: 'parameter no-op', value: '120', status: 'VERIFIED', commands: ['03'] },
      { name: 'parameter unread', value: '60', unread: true, status: 'FAILED', commands: ['03'] },
      {
        name: 'parameter rejected',
        parameter: '1302',
        value: '60',
        rejected: true,
        status: 'FAILED',
        commands: ['03', '04'],
      },
      {
        name: 'parameter uncertain',
        value: '60',
        uncertain: true,
        restoreAfter: true,
        status: 'UNCERTAIN',
        commands: ['03', '04', '03'],
      },
    ]) {
      parameterGateway = { ...scenario, commands: [], writes: 0 };
      const change = await runParameterChange(
        database.client,
        {
          unitId,
          parameter: scenario.parameter ?? '0774',
          value: '120',
          restoreAfter: scenario.restoreAfter ?? false,
        },
        configurationRuntime,
      );
      expect({ name: scenario.name, status: change.status }).toEqual({
        name: scenario.name,
        status: scenario.status,
      });
      expect(parameterGateway.commands.map(({ command }) => command)).toEqual(scenario.commands);
      if (scenario.status === 'RESTORED') {
        expect(parameterGateway.value).toBe('60');
      }
      if (scenario.uncertain) {
        expect(change.steps).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: 'uncertain-readback', payload: '120' }),
          ]),
        );
      }
      if (scenario.rejected) {
        expect(change.failureReason).toContain('rejected by the unit (result 02)');
        expect(parameterGateway.value).toBe('60');
      }
    }
    const blockedParameter = await runParameterChange(
      database.client,
      { unitId, parameter: '0774', value: '121' },
      configurationRuntime,
    );
    expect(blockedParameter.status).toBe('REFUSED');
    expect(blockedParameter.failureReason).toContain('UNCERTAIN');
    parameterGateway = undefined;

    // Retire only the test fixture's parameter ambiguity before testing the eData barrier.
    await database.client.ermConfigurationChange.updateMany({
      where: { unitId, status: 'UNCERTAIN' },
      data: { status: 'READ' },
    });
    await expect(
      configurations.startParameter({ deviceId, parameter: '0774', value: '120' }, unauthenticated),
    ).rejects.toMatchObject({ status: 401 });
    await expect(
      configurations.startParameter(
        { deviceId, parameter: '0774', value: '120' },
        { ...scopedContext, branchId: randomUUID() },
      ),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      configurations.startParameter({ deviceId, parameter: '0774', value: '120' }, scopedContext),
    ).rejects.toMatchObject({ status: 403 });
    process.env.ERM_CONFIGURATION_WRITES_ENABLED = 'true';
    for (const parameter of ['0049', '0050', '0051', '0052', '0053', '0054', '0059', '0593']) {
      await expect(
        configurations.startParameter({ deviceId, parameter, value: '1' }, scopedContext),
      ).rejects.toMatchObject({ status: 400 });
    }
    parameterGateway = { value: '60', commands: [], writes: 0 };
    const beforeSnapshots = await database.client.ermParameterSnapshot.count({ where: { unitId } });
    const startedConfiguration = await configurations.startParameter(
      { deviceId, parameter: '0774', value: '120' },
      scopedContext,
    );
    expect(startedConfiguration).toMatchObject({ status: 'RUNNING', finishedAt: null });
    await configurations.onModuleDestroy();
    expect(await database.client.ermParameterSnapshot.count({ where: { unitId } })).toBe(
      beforeSnapshots + 1,
    );
    const storedConfiguration = await database.client.ermConfigurationChange.findUniqueOrThrow({
      where: { id: startedConfiguration.id },
    });
    expect(storedConfiguration).toMatchObject({
      status: 'VERIFIED',
      intended: '120',
      finishedAt: expect.any(Date),
    });
    expect(storedConfiguration.steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'parameter-snapshot',
          outcome: 'COMPLETE',
          payload: expect.any(String),
        }),
      ]),
    );
    expect(parameterGateway.commands.map(({ command }) => command)).toEqual(['03', '04', '03']);
    parameterGateway = undefined;
    const configurationContract = await graphql({
      schema,
      source: `query($representations: [_Any!]!) { _entities(representations: $representations) {
        ... on FleetDevice { ermConfigurationWritesEnabled ermConfigurationChanges {
          id status startedAt finishedAt parameter failureReason baseline intended steps
        } }
      } }`,
      variableValues: {
        representations: [{ __typename: 'FleetDevice', id: deviceId, imei: unitId }],
      },
      contextValue: { ...scopedContext },
    });
    expect(configurationContract.errors).toBeUndefined();
    expect(configurationContract.data?.['_entities']).toMatchObject([
      {
        ermConfigurationWritesEnabled: true,
        ermConfigurationChanges: expect.arrayContaining([
          expect.objectContaining({
            id: storedConfiguration.id,
            status: 'VERIFIED',
            intended: '120',
            baseline: { parameter: '0774', value: '60' },
            steps: storedConfiguration.steps,
          }),
        ]),
      },
    ]);
    const historyUnitId = '123456789012345';
    for (const foreignScope of [
      { tenantId: randomUUID(), branchId, deviceId },
      { tenantId, branchId: randomUUID(), deviceId },
      { tenantId, branchId, deviceId: randomUUID() },
    ]) {
      await database.client.ermConfigurationChange.create({
        data: {
          ...foreignScope,
          unitId,
          actorId: 'foreign-session',
          intent: 'Foreign configuration run',
          status: 'READ',
          baseline: { private: 'other scope' },
          steps: [],
          finishedAt: new Date(),
        },
      });
    }
    await database.client.ermConfigurationChange.createMany({
      data: Array.from({ length: 21 }, (_, parameter) => ({
        unitId: historyUnitId,
        tenantId,
        branchId,
        deviceId: queueHistoryDeviceId,
        actorId: `demo-tenant:${tenantId}`,
        intent: 'Scoped configuration fixture',
        parameter,
        status: 'READ' as const,
        startedAt: new Date(Date.UTC(2020, 0, 1, 0, 0, parameter)),
        finishedAt: new Date(Date.UTC(2020, 0, 1, 0, 0, parameter)),
        baseline: {},
        steps: [],
      })),
    });
    const configurationRequest = deviceTelemetryRequest(
      [unitId, historyUnitId],
      [
        { id: deviceId, imei: unitId },
        { id: queueHistoryDeviceId, imei: historyUnitId },
      ],
    );
    const [unitChanges, otherChanges] = await Promise.all([
      configurations.deviceChanges(
        { ...reference(), id: deviceId, telemetryRequest: configurationRequest },
        scopedContext,
      ),
      configurations.deviceChanges(
        {
          ...reference(historyUnitId),
          id: queueHistoryDeviceId,
          telemetryRequest: configurationRequest,
        },
        scopedContext,
      ),
    ]);
    expect(unitChanges.some(({ id }) => id === startedConfiguration.id)).toBe(true);
    expect(unitChanges).toHaveLength(1);
    expect(otherChanges.map(({ parameter }) => parameter)).toEqual(
      Array.from({ length: 20 }, (_, index) => 20 - index),
    );
    configurationGateway = {
      definitions: [firstDefinition, secondDefinition],
      commands: [],
      reads: 0,
      uncertain: true,
    };
    const uncertainChange = await runEdataChange(
      database.client,
      { unitId, parameter: 662, interval: 120 },
      configurationRuntime,
    );
    expect(uncertainChange.status).toBe('UNCERTAIN');
    expect(configurationGateway.commands.map(({ fields }) => fields[7])).toEqual([
      '0702BC',
      '0702BC',
      `02${changedDefinition}`,
    ]);
    expect(configurationGateway.definitions).toEqual([firstDefinition, secondDefinition]);
    const interruptedChanges = await database.client.ermConfigurationChange.createManyAndReturn({
      data: (['RUNNING', 'UNCERTAIN'] as const).map((status) => ({
        unitId: '123456789012345',
        status,
        baseline: {},
        steps: [],
      })),
    });
    await configurations.onModuleInit();
    expect(
      await database.client.ermConfigurationChange.findMany({
        where: { id: { in: interruptedChanges.map(({ id }) => id) } },
        orderBy: { status: 'asc' },
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: 'FAILED', finishedAt: expect.any(Date) }),
        expect.objectContaining({
          status: 'UNCERTAIN',
          finishedAt: expect.any(Date),
          failureReason: expect.stringContaining('operator review'),
        }),
      ]),
    );
    const fleetBatchTime = new Date(Date.now() - 1000);
    const fleetBatchPeriodEnd = new Date(fleetBatchTime.getTime() + 500);
    const fleetBatchImei = '862129080367777';
    const fleetBatchFrame = await database.client.ermFrame.create({
      data: {
        connectionId: stored.id,
        unitId: fleetBatchImei,
        direction: 'DEVICE',
        receivedAt: fleetBatchTime,
        checksum: 'ABSENT',
        raw: Buffer.from('$fleet-batch-test'),
      },
    });
    const fleetBatchEvents = await database.client.ermEvent.createManyAndReturn({
      data: Array.from({ length: 105 }, (_, index) => ({
        frameId: fleetBatchFrame.id,
        unitId: fleetBatchImei,
        eventTime: fleetBatchTime,
        eventId: index === 0 ? '33' : '02',
        engineOn: true,
        fields:
          index === 0
            ? { edata: { type: 419, faults: [{ spn: 4339, fmi: 7, status: 1 }] } }
            : { extra: ['00', '1'] },
      })),
    });
    const fleetBatchCommand = await database.client.ermCommandRequest.create({
      data: {
        tenantId,
        branchId,
        deviceId,
        unitId: fleetBatchImei,
        actorId: `demo-tenant:${tenantId}`,
        intent: 'Read status',
        action: 'READ_STATUS',
        status: 'UNCERTAIN',
        createdAt: fleetBatchTime,
        completedAt: fleetBatchTime,
        expiresAt: fleetBatchTime,
        failureReason: 'Submission interrupted',
      },
    });
    for (const scope of [
      { tenantId: randomUUID(), branchId },
      { tenantId, branchId: randomUUID() },
    ]) {
      await database.client.ermCommandRequest.create({
        data: { ...fleetBatchCommand, ...scope, id: randomUUID() },
      });
    }
    await database.client.ermCommandRequest.create({
      data: {
        ...fleetBatchCommand,
        id: randomUUID(),
        completedAt: fleetBatchPeriodEnd,
      },
    });
    await database.client.ermEvent.createMany({
      data: [new Date(fleetBatchTime.getTime() - 25 * 60 * 60 * 1000), fleetBatchPeriodEnd].map(
        (eventTime) => ({
          frameId: fleetBatchFrame.id,
          unitId: fleetBatchImei,
          eventTime,
          eventId: '02',
          fields: {},
        }),
      ),
    });
    const internalContext: RequestContext = {
      requestId: 'fleet-batch-test',
      tenantId: undefined,
      authorization: `Bearer ${process.env.ERM_TELEMETRY_TOKEN}`,
    };
    const fleetBatchVariables = {
      imeis: [fleetBatchImei],
      tenantId,
      branchId,
      from: new Date(fleetBatchTime.getTime() - 60_000).toISOString(),
      to: fleetBatchPeriodEnd.toISOString(),
    };
    const fleetBatchSource = `query($imeis:[String!]!,$tenantId:ID!,$branchId:ID!,
      $from:DateTime!,$to:DateTime!,$offset:Int) {
      ermFleetProblems(imeis:$imeis,tenantId:$tenantId,branchId:$branchId,
        from:$from,to:$to,offset:$offset,limit:60) {
        asOf totalCount hasMore counts {sourceKind severity count}
        items {sourceKind sourceId imei deviceId occurredAt severity state code details eventTime eventId
          diagnostics {kind troubleCode status}}
      }
    }`;
    const batchFirst = await graphql({
      schema,
      source: fleetBatchSource,
      variableValues: fleetBatchVariables,
      contextValue: internalContext,
    });
    expect(batchFirst.errors).toBeUndefined();
    expect(batchFirst.data?.['ermFleetProblems']).toMatchObject({
      totalCount: 106,
      hasMore: true,
      counts: [
        { sourceKind: 'COMMAND', severity: 'WARNING', count: 1 },
        { sourceKind: 'DIAGNOSTIC', severity: 'WARNING', count: 105 },
      ],
      items: expect.arrayContaining([
        expect.objectContaining({
          sourceId: fleetBatchCommand.id,
          state: 'UNCERTAIN',
          deviceId,
        }),
      ]),
    });
    const batchSecond = await graphql({
      schema,
      source: fleetBatchSource,
      variableValues: { ...fleetBatchVariables, offset: 60 },
      contextValue: internalContext,
    });
    expect(batchSecond.errors).toBeUndefined();
    expect(batchSecond.data?.['ermFleetProblems']).toMatchObject({
      totalCount: 106,
      hasMore: false,
    });
    const secondPage = batchSecond.data?.['ermFleetProblems'];
    if (typeof secondPage !== 'object' || secondPage === null || !('items' in secondPage)) {
      throw new Error('Expected the second Fleet evidence page');
    }
    expect(secondPage.items).toHaveLength(46);
    const batchAll = await api.fleetProblems(fleetBatchVariables, internalContext);
    expect(batchAll.items).toHaveLength(106);
    expect(new Set(batchAll.items.map((item) => `${item.sourceKind}:${item.sourceId}`)).size).toBe(
      106,
    );
    expect(batchAll.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceId: String(fleetBatchEvents.find((row) => row.eventId === '33')?.id),
          state: 'RECORDED',
          diagnostics: [
            { kind: 'DIAGNOSTIC_TROUBLE_CODE', troubleCode: 'SPN 4339 FMI 7', status: 'ADDED' },
          ],
        }),
      ]),
    );
    const fleetTelemetrySource = `query($imeis:[String!]!) {
      ermFleetTelemetry(imeis:$imeis) {
        asOf units {imei connected lastFrameAt expectedIntervalSeconds reporting}
      }
    }`;
    const fleetBatchImeis = [
      unitId,
      fleetBatchImei,
      ...Array.from({ length: 103 }, (_, index) => String(862129090000000 + index)),
    ];
    gatewayOnline = true;
    const batchReadsBefore = gatewayReads;
    const fleetCallsBefore = fleetCalls;
    const batchTelemetry = await graphql({
      schema,
      source: fleetTelemetrySource,
      variableValues: { imeis: fleetBatchImeis },
      contextValue: { ...internalContext },
    });
    expect(batchTelemetry.errors).toBeUndefined();
    const telemetryBatch = batchTelemetry.data?.['ermFleetTelemetry'];
    if (
      typeof telemetryBatch !== 'object' ||
      telemetryBatch === null ||
      !('units' in telemetryBatch)
    ) {
      throw new Error('Expected the complete Fleet telemetry batch');
    }
    expect(telemetryBatch.units).toHaveLength(105);
    expect(batchTelemetry.data?.['ermFleetTelemetry']).toMatchObject({
      units: expect.arrayContaining([
        expect.objectContaining({ imei: unitId, connected: true }),
        {
          imei: fleetBatchImei,
          connected: false,
          lastFrameAt: fleetBatchTime.toISOString(),
          expectedIntervalSeconds: 300,
          reporting: true,
        },
        {
          imei: fleetBatchImeis[2],
          connected: false,
          lastFrameAt: null,
          expectedIntervalSeconds: 3600,
          reporting: false,
        },
      ]),
    });
    expect(gatewayReads - batchReadsBefore).toBe(1);
    expect(fleetCalls).toBe(fleetCallsBefore);
    for (const deniedContext of [scopedContext, unauthenticated]) {
      for (const source of [fleetBatchSource, fleetTelemetrySource]) {
        const denied = await graphql({
          schema,
          source,
          variableValues: fleetBatchVariables,
          contextValue: deniedContext,
        });
        expect(denied.errors?.[0]?.message).toBe('Internal telemetry authentication required');
      }
    }

    const notificationExport = module.get(NotificationExportController);
    const notificationImei = '862129080368888';
    const notificationSince = new Date(Date.now() - 60_000);
    const notificationAt = new Date(notificationSince.getTime() + 1000);
    const notificationEvents = await database.client.ermEvent.createManyAndReturn({
      data: [
        { eventId: '33', fields: { edata: { type: 419, faults: [
          { spn: 4339, fmi: 7, status: 1 }, { spn: 4339, fmi: 7, status: 2 },
        ] } } },
        { eventId: '33', fields: { edata: { type: 411, canError: 2 } } },
        { eventId: '36', fields: {} },
        { eventId: '02', fields: { extra: ['00', '1'] } },
        { eventId: '01', fields: {} },
      ].map((entry) => ({
        frameId: fleetBatchFrame.id,
        unitId: notificationImei,
        eventTime: notificationAt,
        ...entry,
      })),
    });
    await database.client.ermEvent.create({
      data: {
        frameId: fleetBatchFrame.id,
        unitId: notificationImei,
        eventTime: new Date(notificationSince.getTime() - 1),
        eventId: '36',
        fields: {},
      },
    });
    const notificationCommands = await database.client.ermCommandRequest.createManyAndReturn({
      data: ([
        { status: 'ANSWERED', resultCode: '01' },
        { status: 'ANSWERED', resultCode: null },
        { status: 'FAILED', resultCode: '02' },
        { status: 'FAILED', resultCode: null },
        { status: 'EXPIRED', resultCode: null },
        { status: 'UNCERTAIN', resultCode: null },
      ] as const).map(({ status, resultCode }) => ({
          ...fleetBatchCommand,
          id: randomUUID(),
          unitId: notificationImei,
          status,
          resultCode,
          completedAt: notificationAt,
          failureReason: status === 'FAILED' ? 'Command failed' : null,
      })),
    });
    for (const excluded of [
      { tenantId: randomUUID() },
      { branchId: randomUUID() },
      { deviceId: randomUUID() },
      { unitId: '862129080368889' },
      { completedAt: new Date(notificationSince.getTime() - 1) },
      { status: 'QUEUED' as const },
      { status: 'CANCELLED' as const },
    ]) {
      await database.client.ermCommandRequest.create({
        data: {
          ...fleetBatchCommand,
          id: randomUUID(),
          unitId: notificationImei,
          completedAt: notificationAt,
          ...excluded,
        },
      });
    }
    const notificationQuery = {
      tenantId,
      branchId,
      deviceId,
      since: notificationSince.toISOString(),
      limit: '2',
    };
    const exported: NotificationExportItem[] = [];
    let notificationCursor: string | undefined;
    for (;;) {
      const page = await notificationExport.page(notificationImei, {
        ...notificationQuery,
        after: notificationCursor,
      });
      exported.push(...page.items);
      notificationCursor = page.next;
      if (!page.hasMore) {
        break;
      }
    }
    expect(exported).toHaveLength(11);
    expect(new Set(exported.map((item) => item.sourceKey)).size).toBe(11);
    expect(exported.filter((item) => item.sourceKind === 'COMMAND').map((item) => item.parameters['commandStatus']).sort()).toEqual([
      'ACKNOWLEDGED', 'EXPIRED', 'FAILED', 'OUTCOME_UNKNOWN', 'REJECTED', 'RESPONSE_RECEIVED',
    ]);
    expect(exported).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceKey: JSON.stringify([notificationImei, notificationAt.toISOString(), 'DIAGNOSTIC_TROUBLE_CODE', 'SPN 4339 FMI 7', 'ADDED']),
        sourceId: String(notificationEvents.find((entry) => entry.eventId === '33')?.id),
        severity: 'WARNING',
        recorded: true,
        parameters: { eventKind: 'DIAGNOSTIC_TROUBLE_CODE', troubleCode: 'SPN 4339 FMI 7', diagnosticStatus: 'ADDED', alarmCode: '33' },
      }),
      expect.objectContaining({
        sourceKey: JSON.stringify([notificationImei, notificationAt.toISOString(), 'DIAGNOSTIC_TROUBLE_CODE', 'SPN 4339 FMI 7', 'DELETED']),
        severity: 'INFO',
        recorded: true,
      }),
      expect.objectContaining({
        sourceKey: JSON.stringify([notificationImei, notificationAt.toISOString(), 'CAN_ERROR', null, null]),
        sourceKind: 'DIAGNOSTIC',
        recorded: true,
      }),
      expect.objectContaining({ sourceKind: 'ALARM', severity: 'CRITICAL', recorded: true }),
    ]));
    const exhausted = await notificationExport.page(notificationImei, { ...notificationQuery, after: notificationCursor });
    expect(exhausted).toEqual({ items: [], next: notificationCursor, hasMore: false });
    const changedCommand = notificationCommands.find((request) => request.status === 'UNCERTAIN');
    if (changedCommand === undefined) {
      throw new Error('Expected an uncertain command fixture');
    }
    await database.client.ermCommandRequest.update({
      where: { id: changedCommand.id },
      data: { status: 'ANSWERED', resultCode: '01', completedAt: new Date(notificationAt.getTime() + 1) },
    });
    const terminalUpdate = await notificationExport.page(notificationImei, { ...notificationQuery, after: notificationCursor });
    expect(terminalUpdate.items).toEqual([
      expect.objectContaining({ sourceKey: `erm-command:${changedCommand.id}:ACKNOWLEDGED`, parameters: { commandKind: 'READ_STATUS', commandStatus: 'ACKNOWLEDGED', reasonCode: null } }),
    ]);
    for (const invalidQuery of [{ tenantId: '' }, { branchId: '' }, { deviceId: '' }, { since: '2026-11-06' }, { after: 'bad-cursor' }, { limit: '0' }]) {
      await expect(notificationExport.page(notificationImei, { ...notificationQuery, ...invalidQuery })).rejects.toThrow('Invalid notification export');
    }
  } finally {
    releaseSnapshotBatch?.();
    await commandRequests?.onModuleDestroy();
    await configurationService?.onModuleDestroy();
    await snapshotService?.onModuleDestroy();
    if (previousConfigurationWrites === undefined) {
      delete process.env.ERM_CONFIGURATION_WRITES_ENABLED;
    } else {
      process.env.ERM_CONFIGURATION_WRITES_ENABLED = previousConfigurationWrites;
    }
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
