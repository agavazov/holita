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
  configurationTarget,
  configurationWindow,
} from './configuration-input.js';
import {
  configurationObservation,
  configurationReadback,
  type ConfigurationObservation,
} from './configuration-response.js';
import {
  profileObservation,
  profileReadback,
  type ProfileObservation,
} from './profile-response.js';

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

  async observations(value: unknown) {
    const input = configurationWindow(value);
    const observations: ConfigurationObservation[] = [];
    let truncated = false;
    const scanned = await this.scanConfigurationEvents(
      input,
      (messageId, eventTimeUtc, rawMessage) => {
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

  private async scanConfigurationEvents(
    input: ReturnType<typeof configurationWindow>,
    visit: (messageId: string, eventTimeUtc: string, rawMessage: string) => void,
  ): Promise<boolean> {
    // Background polling includes identity lookup, login renewal and up to four event pages.
    const signal = AbortSignal.timeout(20000);
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
        from_date: from.slice(0, 19).replace('T', ' '),
        to_date: to.slice(0, 19).replace('T', ' '),
      });
      parameters.append('event_type[]', '33');
      if (before !== null) {
        parameters.set('to_id', String(before));
      }
      const data = await this.karma.readConfigurationEvents(parameters, signal);
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
          (before !== null && id > before) ||
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
          eventTimeUtc < from ||
          eventTimeUtc > to
        ) {
          unavailable();
        }
        previous = id;
        oldest ||= id;
        if (
          typeof rawMessage === 'string' &&
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
