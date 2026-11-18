import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ErmDeviceRouting, ErmKarmaReturnAttempt } from '../../generated/graphql/types.js';
import type { RequestContext } from '../../graphql/request-context.js';
import type { DeviceTelemetryRequest } from '../telemetry/device-request.js';
import { FleetClient } from '../telemetry/fleet.client.js';
import { LiveDevicesService } from '../telemetry/live-devices.service.js';
import { auditId, operatorActor, operatorScope } from '../telemetry/operator-audit.js';
import type { DeviceReference } from '../telemetry/telemetry.service.js';
import { karmaEnabled } from './karma.config.js';
import { KarmaRepository, type KarmaAttempt } from './karma.repository.js';
import { karmaFailureReason, KarmaTransport } from './karma.transport.js';

const LOOKUP_WINDOW = 30 * 60_000;
// A pass can take 19 min (cars + 9 units with two 60 s reads), rounded to 20 min by ticks.
// observedAt is the pass start: allow the successful pass, one failed pass and recovery.
const ROUTING_MAX_AGE = 60 * 60_000;
// A returned unit reconnects within minutes. A parked unit gets `98` at its next (hourly) report,
// so a retry can queue behind an undelivered one; both sessions are read-only.
const AUTOMATIC_RETURN_INTERVAL = 30 * 60_000;
const AUTOMATIC_RETURN_ACTOR = 'system:auto-return';

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
export class KarmaService {
  private readonly logger = new Logger(KarmaService.name);
  private readonly requests = new WeakMap<
    DeviceTelemetryRequest,
    Promise<Map<string, ErmDeviceRouting>>
  >();

  constructor(
    private readonly repository: KarmaRepository,
    private readonly transport: KarmaTransport,
    private readonly fleet: FleetClient,
    private readonly devices: LiveDevicesService,
  ) {}

  // Observes every primary unit and returns those on the Karma backup while the gateway answers.
  async routeUnits(now: Date): Promise<void> {
    try {
      const units = primaryUnits();
      for (const unitId of units) {
        await this.repository.reconcile(unitId);
      }
      const cars = await this.transport.readCars();
      const gatewayAnswers = await this.devices.listUnits().then(
        () => true,
        () => false,
      );
      for (const unitId of units) {
        try {
          const car = cars.find((candidate) => candidate.unitId === unitId);
          if (!car) {
            throw new ServiceUnavailableException(
              'Karma car mapping is unavailable',
              'missing car mapping',
            );
          }
          const route = await this.observe(unitId, car.carId, now);
          if (route.state !== 'KARMA_BACKUP') {
            continue;
          }
          if (gatewayAnswers) {
            await this.returnAutomatically(unitId, car.carId, now);
          } else {
            this.logger.warn(
              `Unit ${unitId} stays on the Karma backup: the gateway does not answer.`,
            );
          }
        } catch (error) {
          this.logger.warn(
            `Karma routing failed for unit ${unitId} (${karmaFailureReason(error)}).`,
          );
        }
      }
    } catch (error) {
      this.logger.warn(
        `Karma routing observation failed (${karmaFailureReason(error)}); retrying on the next tick.`,
      );
    }
  }

  // Any attempt, automatic or by an operator, holds the next automatic return for the interval.
  private async returnAutomatically(unitId: string, carId: string, now: Date): Promise<void> {
    const latest = await this.repository.latestAttempt(unitId);
    if (latest && now.getTime() - latest.requestedAt.getTime() < AUTOMATIC_RETURN_INTERVAL) {
      return;
    }
    if (latest?.pending) {
      // Neither a recovery outcome nor a discocan connection followed it.
      await this.repository.failed(latest.id);
    }
    const attempt = await this.repository.createAttempt({
      unitId,
      actorId: AUTOMATIC_RETURN_ACTOR,
      requestedAt: now,
    });
    const { status } = await this.submitReturn(attempt.id, carId);
    this.logger.log(`Requested unit ${unitId}'s return from the Karma backup (${status}).`);
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
    return attemptView(await this.submitReturn(attempt.id, car.carId));
  }

  private async submitReturn(attemptId: string, carId: string): Promise<KarmaAttempt> {
    let result: Awaited<ReturnType<KarmaTransport['requestReturn']>>;
    try {
      result = await this.transport.requestReturn(carId);
    } catch {
      await this.repository.failed(attemptId);
      throw new ServiceUnavailableException('Karma could not authenticate the return request');
    }
    return this.repository.submitted(attemptId, result);
  }
}
