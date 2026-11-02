import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { KarmaTransport } from '../../integrations/karma/karma-transport.js';
import { cars } from '../cars/cars-response.js';
import {
  configurationParameterRequest,
  configurationRequest,
  configurationRuleRequest,
  configurationTarget,
  configurationWindow,
  diagnosticRequest,
  diagnosticWindow,
} from './configuration-input.js';
import { diagnosticReport } from '../history/diagnostic-report.js';
import {
  configurationObservation,
  configurationReadback,
  configurationTerminalResponse,
  type ConfigurationObservation,
  type ConfigurationTerminalResponse,
} from './configuration-response.js';
import {
  profileObservation,
  profileReadback,
  type ProfileObservation,
} from './profile-response.js';
import { ruleObservation, ruleReadback, type RuleObservation } from './rule-response.js';

function unavailable(): never {
  throw new ServiceUnavailableException('Karma configuration observations are unavailable');
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

@Injectable()
export class DeviceConfigurationService {
  constructor(private readonly karma: KarmaTransport) {}

  target(value: unknown) {
    const input = configurationTarget(value);
    return this.readTarget(input.carId, undefined, AbortSignal.timeout(4000));
  }

  async request(value: unknown) {
    const input = configurationRequest(value);
    const signal = AbortSignal.timeout(4000);
    await this.readTarget(input.carId, input.expectedDeviceId, signal);
    return this.karma.requestConfiguration(input.carId, signal);
  }

  async requestDiagnostic(value: unknown) {
    const input = diagnosticRequest(value);
    const signal = AbortSignal.timeout(20000);
    await this.readTarget(input.carId, input.expectedDeviceId, signal);
    for (const id of input.existingQueueIds) {
      const state = await this.diagnosticQueueState(id, signal);
      // Observed terminal states: transmitted (1), failed to receive acknowledgment (3).
      if (state !== 1 && state !== 3) {
        return { status: 'PENDING' as const, queueIds: input.existingQueueIds };
      }
    }
    return this.karma.requestDiagnostic(input.carId, input.kind, signal);
  }

  async diagnosticWatermark(value: unknown) {
    const input = configurationRequest(value);
    const signal = AbortSignal.timeout(4000);
    await this.readTarget(input.carId, input.expectedDeviceId, signal);
    const parameters = new URLSearchParams({ car: input.carId, date_type: 'utc' });
    parameters.append('event_type[]', '33');
    const data = await this.karma.readDiagnosticEvents(parameters, signal);
    if (!Array.isArray(data) || data.length > 500) {
      unavailable();
    }
    let latest = 0;
    const rows: unknown[] = data;
    for (const row of rows) {
      if (!object(row)) {
        unavailable();
      }
      const id = row['message_id'];
      if (
        typeof id !== 'number' ||
        !Number.isSafeInteger(id) ||
        id <= latest ||
        row['car_id'] !== Number(input.carId) ||
        row['device_id'] !== input.expectedDeviceId ||
        row['eid'] !== 33
      ) {
        unavailable();
      }
      latest = id;
    }
    return { afterMessageId: latest ? String(latest) : null };
  }

  async diagnosticObservations(value: unknown) {
    const input = diagnosticWindow(value);
    const signal = AbortSignal.timeout(20000);
    await this.readTarget(input.carId, input.expectedDeviceId, signal);
    const queue: { id: string; state: number | null }[] = [];
    for (const id of input.queueIds) {
      queue.push({ id, state: await this.diagnosticQueueState(id, signal) });
    }
    const observations: {
      messageId: string;
      eventTimeUtc: string;
      rawMessage: string;
      family:
        | 'SPECIAL_ACK'
        | 'FAULT_REPORT'
        | 'UNRESOLVED_FAULT_REPORT'
        | 'COMMUNICATION_DIAGNOSTICS';
      acknowledgement: 'NACK' | 'POSITIVE_ACK' | null;
    }[] = [];
    let truncated = false;
    const scanned = await this.scanConfigurationEvents(
      input,
      (messageId, eventTimeUtc, rawMessage) => {
        const report = diagnosticReport({
          id: messageId,
          carId: input.carId,
          deviceId: input.expectedDeviceId,
          eventId: '33',
          edt: eventTimeUtc.slice(0, 19).replace('T', ' '),
          extra: rawMessage,
        });
        if (!report || report.decoding === 'MALFORMED') {
          return;
        }
        const acknowledgement =
          report.acknowledgement === 'NACK' || report.acknowledgement === 'POSITIVE_ACK'
            ? report.acknowledgement
            : null;
        const family =
          report.family === 'SPECIAL_ACK' && acknowledgement
            ? 'SPECIAL_ACK'
            : report.family === 'EDATA_411'
              ? 'COMMUNICATION_DIAGNOSTICS'
              : ['EDATA_413', 'EDATA_418', 'EDATA_419'].includes(report.family)
                ? typeof report.payloadHex === 'string' && report.payloadHex.length <= 2
                  ? 'UNRESOLVED_FAULT_REPORT'
                  : 'FAULT_REPORT'
                : null;
        if (family) {
          observations.push({ messageId, eventTimeUtc, rawMessage, family, acknowledgement });
          observations.sort((a, b) => Number(b.messageId) - Number(a.messageId));
          if (observations.length > 64) {
            observations.length = 64;
            truncated = true;
          }
        }
      },
      signal,
      true,
    );
    return { coverageComplete: scanned && !truncated, queue, observations };
  }

  private async diagnosticQueueState(id: string, signal: AbortSignal): Promise<number | null> {
    try {
      const result = await this.karma.readDiagnosticQueue(id, signal);
      const queue = object(result) ? result[id] : null;
      const state = object(queue) ? queue['state_id'] : null;
      return typeof state === 'number' && Number.isSafeInteger(state) && state >= 0 ? state : null;
    } catch {
      return null;
    }
  }

  async requestProfile(value: unknown) {
    const input = configurationRequest(value);
    const signal = AbortSignal.timeout(4000);
    await this.readTarget(input.carId, input.expectedDeviceId, signal);
    return this.karma.requestProfile(input.carId, signal);
  }

  async requestParameter(value: unknown) {
    const input = configurationParameterRequest(value);
    const signal = AbortSignal.timeout(4000);
    await this.readTarget(input.carId, input.expectedDeviceId, signal);
    return this.karma.requestParameter(input.carId, input.rawDefinition, signal);
  }

  async requestRules(value: unknown) {
    const input = configurationRequest(value);
    const signal = AbortSignal.timeout(4000);
    await this.readTarget(input.carId, input.expectedDeviceId, signal);
    return this.karma.requestRules(input.carId, signal);
  }

  async requestRule(value: unknown) {
    const input = configurationRuleRequest(value);
    const signal = AbortSignal.timeout(4000);
    await this.readTarget(input.carId, input.expectedDeviceId, signal);
    return this.karma.requestRule(input.carId, input.rawDefinition, signal);
  }

  async observations(value: unknown) {
    const input = configurationWindow(value);
    const observations: ConfigurationObservation[] = [];
    let terminalResponse: ConfigurationTerminalResponse | undefined;
    let truncated = false;
    const scanned = await this.scanConfigurationEvents(
      input,
      (messageId, eventTimeUtc, rawMessage) => {
        const terminal = configurationTerminalResponse(messageId, eventTimeUtc, rawMessage);
        if (terminal && Number(messageId) > Number(terminalResponse?.messageId ?? 0)) {
          terminalResponse = terminal;
        }
        const observation = configurationObservation(messageId, eventTimeUtc, rawMessage);
        if (!observation) {
          return;
        }
        observations.push(observation);
        observations.sort((a, b) => Number(b.messageId) - Number(a.messageId));
        if (observations.length > 64) {
          observations.length = 64;
          truncated = true;
        }
        let parameterCount = observations.reduce(
          (count, item) => count + item.parameters.length,
          0,
        );
        while (parameterCount > 1000) {
          parameterCount -= observations.pop()?.parameters.length ?? 0;
          truncated = true;
        }
      },
    );
    const coverageComplete = scanned && !truncated;
    return {
      coverageComplete,
      readback: configurationReadback(observations, coverageComplete),
      observations,
      ...(terminalResponse ? { terminalResponse } : {}),
    };
  }

  async profileObservations(value: unknown) {
    const input = configurationWindow(value);
    const observations: ProfileObservation[] = [];
    let truncated = false;
    const scanned = await this.scanConfigurationEvents(
      input,
      (messageId, eventTimeUtc, rawMessage) => {
        const observation = profileObservation(messageId, eventTimeUtc, rawMessage);
        if (!observation) {
          return;
        }
        observations.push(observation);
        observations.sort((a, b) => Number(b.messageId) - Number(a.messageId));
        if (observations.length > 64) {
          observations.length = 64;
          truncated = true;
        }
      },
    );
    const coverageComplete = scanned && !truncated;
    return {
      coverageComplete,
      readback: profileReadback(observations, coverageComplete),
      observations,
    };
  }

  async ruleObservations(value: unknown) {
    const input = configurationWindow(value);
    const observations: RuleObservation[] = [];
    let terminalResponse: ConfigurationTerminalResponse | undefined;
    let truncated = false;
    const scanned = await this.scanConfigurationEvents(
      input,
      (messageId, eventTimeUtc, rawMessage) => {
        const terminal = configurationTerminalResponse(messageId, eventTimeUtc, rawMessage);
        if (terminal && Number(messageId) > Number(terminalResponse?.messageId ?? 0)) {
          terminalResponse = terminal;
        }
        const observation = ruleObservation(messageId, eventTimeUtc, rawMessage);
        if (!observation) {
          return;
        }
        observations.push(observation);
        observations.sort((a, b) => Number(b.messageId) - Number(a.messageId));
        if (observations.length > 64) {
          observations.length = 64;
          truncated = true;
        }
        let ruleCount = observations.reduce((count, item) => count + item.rules.length, 0);
        while (ruleCount > 1000) {
          ruleCount -= observations.pop()?.rules.length ?? 0;
          truncated = true;
        }
      },
    );
    const coverageComplete = scanned && !truncated;
    return {
      coverageComplete,
      readback: ruleReadback(observations, coverageComplete),
      observations,
      ...(terminalResponse ? { terminalResponse } : {}),
    };
  }

  private async scanConfigurationEvents(
    input: ReturnType<typeof configurationWindow>,
    visit: (messageId: string, eventTimeUtc: string, rawMessage: string) => void,
    signal = AbortSignal.timeout(20000),
    idBounded = false,
  ): Promise<boolean> {
    // Background polling includes identity lookup, login renewal and up to four event pages.
    await this.readTarget(input.carId, input.expectedDeviceId, signal);
    const from = new Date(
      Math.floor(new Date(input.fromUtc).getTime() / 1000) * 1000,
    ).toISOString();
    const to = new Date(Math.ceil(new Date(input.toUtc).getTime() / 1000) * 1000).toISOString();
    let before: number | null = null;
    let coverageComplete = false;
    for (let page = 0; page < 4; page++) {
      const parameters = new URLSearchParams({
        car: input.carId,
        date_type: 'utc',
      });
      if (idBounded) {
        if (input.afterMessageId !== undefined) {
          parameters.set('from_id', input.afterMessageId);
        }
      } else {
        parameters.set('from_date', from.slice(0, 19).replace('T', ' '));
        parameters.set('to_date', to.slice(0, 19).replace('T', ' '));
      }
      parameters.append('event_type[]', '33');
      if (before !== null) {
        parameters.set('to_id', String(idBounded ? before + 1 : before));
      }
      const data = idBounded
        ? await this.karma.readDiagnosticEvents(parameters, signal)
        : await this.karma.readConfigurationEvents(parameters, signal);
      if (!Array.isArray(data) || data.length > 500) {
        unavailable();
      }
      if (!data.length) {
        coverageComplete = true;
        break;
      }
      let previous = 0;
      let oldest = 0;
      const rows: unknown[] = data;
      for (const row of rows) {
        if (!object(row)) {
          unavailable();
        }
        const id = row['message_id'];
        const eventDate = row['edt'];
        const rawMessage = row['extra'];
        if (
          typeof id !== 'number' ||
          !Number.isSafeInteger(id) ||
          id <= previous ||
          (before !== null && id > before + (idBounded ? 1 : 0)) ||
          row['car_id'] !== Number(input.carId) ||
          row['device_id'] !== input.expectedDeviceId ||
          row['eid'] !== 33 ||
          typeof eventDate !== 'string' ||
          !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(eventDate) ||
          (rawMessage !== null && rawMessage !== undefined && typeof rawMessage !== 'string') ||
          (typeof rawMessage === 'string' && rawMessage.length > 8192)
        ) {
          unavailable();
        }
        const eventTimeUtc = eventDate.replace(' ', 'T') + '.000Z';
        const parsed = new Date(eventTimeUtc);
        if (
          !Number.isFinite(parsed.getTime()) ||
          parsed.toISOString() !== eventTimeUtc ||
          (!idBounded && (eventTimeUtc < from || eventTimeUtc > to))
        ) {
          unavailable();
        }
        previous = id;
        oldest ||= id;
        if (
          typeof rawMessage === 'string' &&
          (before === null || id <= before) &&
          eventTimeUtc >= from &&
          eventTimeUtc <= to &&
          (input.afterMessageId === undefined || id > Number(input.afterMessageId))
        ) {
          visit(String(id), eventTimeUtc, rawMessage);
        }
      }
      if (
        oldest === 1 ||
        (input.afterMessageId !== undefined && oldest <= Number(input.afterMessageId))
      ) {
        coverageComplete = true;
        break;
      }
      before = oldest - 1;
    }
    return coverageComplete;
  }

  private async readTarget(
    carId: string,
    expectedDeviceId: string | undefined,
    signal: AbortSignal,
  ) {
    const result = cars(await this.karma.readConfigurationTarget(carId, signal));
    const car = result[0];
    if (result.length > 1 || (car && car.id !== carId)) {
      unavailable();
    }
    if (!car) {
      throw new NotFoundException('Karma target was not found');
    }
    if (!/^[\x21-\x7e]{1,128}$/.test(car.deviceId)) {
      unavailable();
    }
    if (expectedDeviceId !== undefined && car.deviceId !== expectedDeviceId) {
      throw new ConflictException('Karma target device has changed');
    }
    return { carId: car.id, deviceId: car.deviceId, carNumber: car.carNumber };
  }
}
