import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import type { ErmDeviceRouting, ErmKarmaReturnAttempt } from '../../generated/graphql/types.js';
import type { RequestContext } from '../../graphql/request-context.js';
import { ermRole } from '../../role.js';
import type { DeviceTelemetryRequest } from '../telemetry/device-request.js';
import { FleetClient } from '../telemetry/fleet.client.js';
import { auditId, operatorActor, operatorScope } from '../telemetry/operator-audit.js';
import type { DeviceReference } from '../telemetry/telemetry.service.js';
import { karmaEnabled } from './karma.config.js';
import { KarmaRepository, type KarmaAttempt } from './karma.repository.js';
import { karmaFailureReason, KarmaTransport } from './karma.transport.js';

const POLL_INTERVAL = 5 * 60_000;
const LOOKUP_WINDOW = 30 * 60_000;
// A pass can take 19 min (cars + 9 units with two 60 s reads), rounded to 20 min by ticks.
// observedAt is the pass start: allow the successful pass, one failed pass and recovery.
const ROUTING_MAX_AGE = 60 * 60_000;

function primaryUnits(): string[] {
  return [
    ...new Set(
      (process.env.ERM_PRIMARY_UNITS ?? '')
        .split(',')
        .map((unit) => unit.trim())
        .filter((unit) => /^\d{15}$/.test(unit)),
    ),
  ];
}

function attemptView(attempt: KarmaAttempt): ErmKarmaReturnAttempt {
  return {
    id: attempt.id,
    actorId: attempt.actorId,
    requestedAt: attempt.requestedAt,
    queueId: attempt.queueId,
    status: attempt.status,
    pending: attempt.pending,
    recovery: attempt.recovery,
    discocanConnectionId: attempt.discocanConnectionId,
    discocanConnectedAt: attempt.discocanConnection?.openedAt ?? null,
  };
}

@Injectable()
export class KarmaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KarmaService.name);
  private readonly requests = new WeakMap<
    DeviceTelemetryRequest,
    Promise<Map<string, ErmDeviceRouting>>
  >();
  private timer: ReturnType<typeof setInterval> | undefined;
  private running: Promise<void> | undefined;

  constructor(
    private readonly repository: KarmaRepository,
    private readonly transport: KarmaTransport,
    private readonly fleet: FleetClient,
  ) {}

  onModuleInit(): void {
    if (ermRole() !== 'api' || !karmaEnabled()) {
      return;
    }
    // Karma reads can take tens of seconds; the api must not wait for them to start serving.
    void this.tick();
    this.timer = setInterval(() => {
      void this.tick();
    }, POLL_INTERVAL);
    this.timer.unref();
  }

  async onModuleDestroy(): Promise<void> {
    clearInterval(this.timer);
    await this.running;
  }

  tick(now = new Date()): Promise<void> {
    this.running ??= this.poll(now)
      .catch((error: unknown) => {
        this.logger.warn(
          `Karma routing observation failed (${karmaFailureReason(error)}); retrying on the next tick.`,
        );
      })
      .finally(() => {
        this.running = undefined;
      });
    return this.running;
  }

  private async poll(now: Date): Promise<void> {
    if (!karmaEnabled()) {
      return;
    }
    const units = primaryUnits();
    for (const unitId of units) {
      await this.repository.reconcile(unitId);
    }
    const cars = await this.transport.readCars();
    for (const unitId of units) {
      try {
        const car = cars.find((candidate) => candidate.unitId === unitId);
        if (!car) {
          throw new ServiceUnavailableException(
            'Karma car mapping is unavailable',
            'missing car mapping',
          );
        }
        await this.observe(unitId, car.carId, now);
      } catch (error) {
        this.logger.warn(
          `Karma routing observation failed for unit ${unitId} (${karmaFailureReason(error)}).`,
        );
      }
    }
  }

  async observe(unitId: string, carId: string, now: Date) {
    const [{ previous, lastFrameAt }, events] = await Promise.all([
      this.repository.evidence(unitId),
      this.transport.readEvents(carId, new Date(now.getTime() - LOOKUP_WINDOW), now, unitId),
    ]);
    events.sort((a, b) => a.reportedAt.getTime() - b.reportedAt.getTime());
    const latest = events.at(-1);
    const latestKarmaReportAt = latest?.reportedAt ?? previous?.latestKarmaReportAt ?? null;
    const backup =
      latestKarmaReportAt !== null &&
      (lastFrameAt === null || latestKarmaReportAt.getTime() - lastFrameAt.getTime() > 180_000);
    const state = backup
      ? 'KARMA_BACKUP'
      : lastFrameAt !== null || latestKarmaReportAt !== null
        ? 'DISCOCAN'
        : 'UNKNOWN';
    let since =
      previous?.state === state
        ? previous.since
        : backup
          ? (events.find((event) => lastFrameAt === null || event.reportedAt > lastFrameAt)
              ?.reportedAt ?? latestKarmaReportAt)
          : lastFrameAt;
    if (
      backup &&
      previous?.state !== 'KARMA_BACKUP' &&
      lastFrameAt !== null &&
      lastFrameAt.getTime() < now.getTime() - LOOKUP_WINDOW
    ) {
      const onset = await this.transport.readEvents(
        carId,
        lastFrameAt,
        new Date(lastFrameAt.getTime() + LOOKUP_WINDOW),
        unitId,
      );
      since =
        onset
          .filter((event) => event.reportedAt > lastFrameAt)
          .sort((a, b) => a.reportedAt.getTime() - b.reportedAt.getTime())[0]?.reportedAt ?? null;
    }
    const observation = await this.repository.observe(previous, {
      unitId,
      state,
      since,
      observedAt: now,
      latestKarmaReportAt,
      parked: latest?.parked ?? previous?.parked ?? null,
    });
    return observation;
  }

  async deviceRouting(device: DeviceReference, context: RequestContext): Promise<ErmDeviceRouting> {
    const scope = operatorScope(context);
    const request = device.telemetryRequest;
    let result = this.requests.get(request);
    if (!result) {
      result = this.repository.routing(scope, request.devices).then(({ routes, attempts }) => {
        const units = primaryUnits();
        return new Map(
          request.devices.map((target): [string, ErmDeviceRouting] => {
            const route = routes.find((row) => row.unitId === target.imei);
            const attempt = attempts.find((row) => row.deviceId === target.id);
            const known =
              karmaEnabled() &&
              units.includes(target.imei) &&
              route !== undefined &&
              Date.now() - route.observedAt.getTime() <= ROUTING_MAX_AGE;
            return [
              target.id,
              {
                state: known ? route.state : 'UNKNOWN',
                since: known ? route.since : null,
                observedAt: route?.observedAt ?? null,
                latestKarmaReportAt: route?.latestKarmaReportAt ?? null,
                parked: known ? route.parked : null,
                latestReturnAttempt: attempt ? attemptView(attempt) : null,
              },
            ];
          }),
        );
      });
      this.requests.set(request, result);
    }
    const routing = (await result).get(device.id);
    if (!routing) {
      throw new ForbiddenException('Device is outside the verified Branch request');
    }
    return routing;
  }

  async requestReturn(deviceId: string, context: RequestContext): Promise<ErmKarmaReturnAttempt> {
    if (context.role !== 'ENGINEER' && context.role !== 'ADMINISTRATOR') {
      throw new ForbiddenException('Returning a unit requires the Engineer role');
    }
    const scope = operatorScope(context);
    deviceId = auditId(deviceId);
    const unitId = await this.fleet.deviceImei(deviceId, context);
    if (!karmaEnabled() || !primaryUnits().includes(unitId)) {
      throw new ServiceUnavailableException('Karma routing is unavailable for this unit');
    }
    await this.repository.reconcile(unitId);
    if (await this.repository.pending(unitId)) {
      throw new ConflictException('A return to discocan is already pending');
    }
    const car = (await this.transport.readCars()).find((candidate) => candidate.unitId === unitId);
    if (!car) {
      throw new ServiceUnavailableException('Karma car mapping is unavailable');
    }
    const route = await this.observe(unitId, car.carId, new Date());
    if (route.state !== 'KARMA_BACKUP' || route.parked !== true) {
      throw new ConflictException('Return requires a parked unit on Karma backup');
    }
    const attempt = await this.repository.createAttempt({
      ...scope,
      deviceId,
      unitId,
      actorId: operatorActor(context),
      requestedAt: new Date(),
    });
    let result: Awaited<ReturnType<KarmaTransport['requestReturn']>>;
    try {
      result = await this.transport.requestReturn(car.carId);
    } catch {
      await this.repository.failed(attempt.id);
      throw new ServiceUnavailableException('Karma could not authenticate the return request');
    }
    return attemptView(await this.repository.submitted(attempt.id, result));
  }
}
