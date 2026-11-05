import {
  BadGatewayException,
  ConflictException,
  Injectable,
  Logger,
  RequestTimeoutException,
  ServiceUnavailableException,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { requireTenant } from '../../auth/demo-auth.js';
import type { ErmDevicePageInput, ErmParameterSnapshot } from '../../generated/graphql/types.js';
import type { RequestContext } from '../../graphql/request-context.js';
import { parameterCatalog } from '../../starlink/parameter-catalog.js';
import type { DeviceCommand } from '../devices/command.js';
import { FleetClient } from './fleet.client.js';
import { LiveDevicesService } from './live-devices.service.js';
import {
  ParameterSnapshotsRepository,
  type StoredParameterSnapshot,
} from './parameter-snapshots.repository.js';
import type { DeviceReference } from './telemetry.service.js';
import { deviceTelemetryQueries, telemetryPage, telemetryQuery } from './telemetry-query.js';
import { UnitWorkflowsService } from './unit-workflows.service.js';
import { auditId, operatorAudit, operatorScope, type OperatorAudit } from './operator-audit.js';

const snapshotParameters = [...parameterCatalog.keys()].filter(
  (parameter) => parameter >= 1 && parameter <= 9999 && (parameter < 49 || parameter > 54),
);

function unquoted(value: string): string {
  return value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1) : value;
}

function snapshotView(snapshot: StoredParameterSnapshot): ErmParameterSnapshot {
  const previous = snapshot.previousSnapshot;
  const previousValues = new Map(previous?.values.map((entry) => [entry.parameter, entry.value]));
  return {
    id: snapshot.id,
    unitId: snapshot.unitId,
    actorId: snapshot.actorId,
    intent: snapshot.intent,
    status: snapshot.status,
    startedAt: snapshot.startedAt.toISOString(),
    finishedAt: snapshot.finishedAt?.toISOString() ?? null,
    parameterCount: snapshot.parameterCount,
    readCount: snapshot.readCount,
    failureReason: snapshot.failureReason,
    values: snapshot.values.map((entry) => ({
      parameter: entry.parameter,
      title: parameterCatalog.get(entry.parameter) ?? null,
      value: entry.value,
      resultCode: entry.resultCode,
    })),
    changes: previous
      ? snapshot.values.flatMap((entry) => {
          const previousValue = previousValues.get(entry.parameter) ?? null;
          return previousValue === entry.value
            ? []
            : [
                {
                  parameter: entry.parameter,
                  title: parameterCatalog.get(entry.parameter) ?? null,
                  previousValue,
                  value: entry.value,
                },
              ];
        })
      : [],
  };
}

@Injectable()
export class ParameterSnapshotsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ParameterSnapshotsService.name);
  private readonly jobs = new Set<Promise<void>>();

  constructor(
    private readonly repository: ParameterSnapshotsRepository,
    private readonly devices: LiveDevicesService,
    private readonly fleet: FleetClient,
    private readonly workflows: UnitWorkflowsService = new UnitWorkflowsService(),
  ) {}

  async onModuleInit(): Promise<void> {
    await this.repository.interruptRunning(new Date());
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(this.jobs);
  }

  async start(deviceId: string, context: RequestContext): Promise<ErmParameterSnapshot> {
    requireTenant(context);
    const unitId = await this.fleet.deviceImei(deviceId, context);
    await this.requirePrimary(unitId);
    this.workflows.acquire(unitId);
    let snapshot: StoredParameterSnapshot;
    try {
      snapshot = await this.repository.create(
        unitId,
        snapshotParameters.length,
        new Date(),
        operatorAudit(context, deviceId, 'Read parameter snapshot'),
      );
    } catch (error) {
      this.workflows.release(unitId);
      throw error;
    }
    const job = this.run(snapshot.id, unitId)
      .catch(() => {
        this.logger.error('Parameter snapshot status could not be persisted');
      })
      .finally(() => {
        this.workflows.release(unitId);
        this.jobs.delete(job);
      });
    this.jobs.add(job);
    return snapshotView(snapshot);
  }

  /** The configuration caller holds the shared unit lock while this snapshot is captured. */
  async captureForConfiguration(unitId: string, audit: OperatorAudit) {
    await this.requirePrimary(unitId);
    const snapshot = await this.repository.create(unitId, snapshotParameters.length, new Date(), {
      ...audit,
      intent: `Pre-write snapshot: ${audit.intent}`,
    });
    await this.run(snapshot.id, unitId);
    return { id: snapshot.id, complete: await this.repository.isComplete(snapshot.id) };
  }

  async deviceSnapshots(
    device: DeviceReference,
    input: ErmDevicePageInput | null | undefined,
    context: RequestContext,
  ) {
    const scope = operatorScope(context);
    telemetryQuery('parameterSnapshots', { ...input, unitId: device.imei });
    const request = device.telemetryRequest;
    const key = JSON.stringify(input ?? {});
    let page = request.snapshots.get(key);
    if (!page) {
      const devices = request.devices.length
        ? request.devices
        : [{ id: auditId(device.id), imei: device.imei }];
      const queries = devices.flatMap(({ id, imei }) =>
        deviceTelemetryQueries('parameterSnapshots', [imei], input).map((query) => ({
          ...query,
          deviceId: id,
        })),
      );
      page = this.repository
        .history(queries, scope)
        .then(
          (rows) =>
            new Map(
              rows.map(({ query, rows: snapshots }) => [
                query.deviceId,
                telemetryPage(snapshots.map(snapshotView), query),
              ]),
            ),
        );
      request.snapshots.set(key, page);
    }
    return (await page).get(device.id);
  }

  private async requirePrimary(unitId: string): Promise<void> {
    const units = await this.devices.listUnits();
    if (!units.some((unit) => unit.unitId === unitId && unit.mode === 'primary')) {
      throw new ConflictException('Unit is not connected in primary mode');
    }
  }

  private async read(unitId: string, command: DeviceCommand) {
    await this.requirePrimary(unitId);
    const result = await this.devices.sendCommand(unitId, command);
    if (result.status === 'timeout') {
      throw new RequestTimeoutException('Parameter read timed out');
    }
    if (result.status === 'failed') {
      throw new BadGatewayException('Parameter read failed');
    }
    return result;
  }

  private async run(snapshotId: string, unitId: string): Promise<void> {
    try {
      for (let offset = 0; offset < snapshotParameters.length; offset += 20) {
        const parameters = snapshotParameters.slice(offset, offset + 20);
        const result = await this.read(unitId, {
          command: '45',
          fields: parameters.map((parameter) => String(parameter).padStart(4, '0')),
        });
        if (result.resultCode !== null && result.resultCode !== '01') {
          for (const parameter of parameters) {
            const single = await this.read(unitId, {
              command: '03',
              fields: [String(parameter).padStart(4, '0')],
            });
            await this.repository.saveValues(snapshotId, [
              {
                parameter,
                value:
                  single.resultCode === null && Number(single.fields[0]) === parameter
                    ? unquoted(single.fields.slice(1).join(','))
                    : null,
                resultCode: single.resultCode,
              },
            ]);
          }
        } else {
          const values = new Map<number, string>();
          for (let index = 0; index + 1 < result.fields.length; index += 2) {
            const parameter = result.fields[index];
            const value = result.fields[index + 1];
            if (parameter !== undefined && value !== undefined) {
              values.set(Number(parameter), unquoted(value));
            }
          }
          await this.repository.saveValues(
            snapshotId,
            parameters.map((parameter) => ({
              parameter,
              value: values.get(parameter) ?? null,
              resultCode: null,
            })),
          );
        }
      }
      await this.repository.complete(snapshotId, new Date());
    } catch (error) {
      const reason =
        error instanceof ConflictException
          ? 'Unit is not connected in primary mode or is busy'
          : error instanceof RequestTimeoutException
            ? 'Parameter read timed out'
            : error instanceof BadGatewayException
              ? 'Parameter read failed'
              : error instanceof ServiceUnavailableException
                ? 'ERM gateway is unavailable'
                : 'Parameter snapshot failed';
      await this.repository.fail(snapshotId, reason, new Date());
    }
  }
}
