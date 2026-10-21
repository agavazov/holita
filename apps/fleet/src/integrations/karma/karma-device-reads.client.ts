import { Injectable, ServiceUnavailableException } from '@nestjs/common';

export const KARMA_COMMAND_TIMEOUT_MS = 4500;

export interface KarmaReadParameter {
  parameterId: number;
  reportingIntervalSeconds: number;
  rawDefinition: string;
}

export interface KarmaReadObservation {
  messageId: string;
  eventTimeUtc: string;
  rawMessage: string;
  configurationId: string;
  messageNumber: number;
  lastMessage: boolean;
  parameters: KarmaReadParameter[];
}

export interface KarmaReadback {
  coverageComplete: boolean;
  readback: {
    status: 'COMPLETE' | 'INCOMPLETE' | 'CONFLICT' | 'ABSENT';
    configurationId: string | null;
    parameters: KarmaReadParameter[];
  };
  observations: KarmaReadObservation[];
}

export interface KarmaProfileObservation {
  messageId: string;
  eventTimeUtc: string;
  rawMessage: string;
  configurationId: string;
  messageNumber: number;
  lastMessage: boolean;
  profileId: number;
}

export interface KarmaProfileReadback {
  coverageComplete: boolean;
  readback: { status: 'COMPLETE' | 'INCOMPLETE' | 'CONFLICT' | 'ABSENT'; profileId: number | null };
  observations: KarmaProfileObservation[];
}

export class KarmaDeviceReadError extends ServiceUnavailableException {
  constructor(readonly code: 'KARMA_UNAVAILABLE' | 'TARGET_CHANGED' | 'INVALID_READBACK') {
    super('Device configuration reading is unavailable; try again later');
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function identifier(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[1-9][0-9]{0,15}$/.test(value) &&
    Number.isSafeInteger(Number(value))
  );
}

function parameter(value: unknown): KarmaReadParameter {
  if (
    !record(value) ||
    typeof value.parameterId !== 'number' ||
    !Number.isInteger(value.parameterId) ||
    value.parameterId < 0 ||
    value.parameterId > 65535 ||
    typeof value.reportingIntervalSeconds !== 'number' ||
    !Number.isInteger(value.reportingIntervalSeconds) ||
    value.reportingIntervalSeconds < 0 ||
    value.reportingIntervalSeconds > 65535 ||
    typeof value.rawDefinition !== 'string' ||
    !/^[0-9A-Fa-f]{44}$/.test(value.rawDefinition) ||
    Number.parseInt(value.rawDefinition.slice(0, 4), 16) !== value.parameterId ||
    Number.parseInt(value.rawDefinition.slice(40), 16) !== value.reportingIntervalSeconds
  ) {
    throw new KarmaDeviceReadError('INVALID_READBACK');
  }
  return {
    parameterId: value.parameterId,
    reportingIntervalSeconds: value.reportingIntervalSeconds,
    rawDefinition: value.rawDefinition.toUpperCase(),
  };
}

function parameters(value: unknown): KarmaReadParameter[] {
  if (!Array.isArray(value) || value.length > 1000) {
    throw new KarmaDeviceReadError('INVALID_READBACK');
  }
  return value.map(parameter);
}

export function karmaReadObservation(value: unknown): KarmaReadObservation {
  if (
    !record(value) ||
    !identifier(value.messageId) ||
    typeof value.eventTimeUtc !== 'string' ||
    !Number.isFinite(Date.parse(value.eventTimeUtc)) ||
    typeof value.rawMessage !== 'string' ||
    value.rawMessage.length > 8192 ||
    !value.rawMessage.startsWith('19,0,401,') ||
    typeof value.configurationId !== 'string' ||
    !/^[0-9A-Fa-f]{1,16}$/.test(value.configurationId) ||
    typeof value.messageNumber !== 'number' ||
    !Number.isInteger(value.messageNumber) ||
    value.messageNumber < 1 ||
    value.messageNumber > 1000 ||
    typeof value.lastMessage !== 'boolean'
  ) {
    throw new KarmaDeviceReadError('INVALID_READBACK');
  }
  return {
    messageId: value.messageId,
    eventTimeUtc: value.eventTimeUtc,
    rawMessage: value.rawMessage,
    configurationId: value.configurationId,
    messageNumber: value.messageNumber,
    lastMessage: value.lastMessage,
    parameters: parameters(value.parameters),
  };
}

function readback(value: unknown): KarmaReadback {
  if (
    !record(value) ||
    typeof value.coverageComplete !== 'boolean' ||
    !record(value.readback) ||
    !Array.isArray(value.observations) ||
    value.observations.length > 64
  ) {
    throw new KarmaDeviceReadError('INVALID_READBACK');
  }
  const result = value.readback;
  const status = result.status;
  if (
    status !== 'COMPLETE' &&
    status !== 'INCOMPLETE' &&
    status !== 'CONFLICT' &&
    status !== 'ABSENT'
  ) {
    throw new KarmaDeviceReadError('INVALID_READBACK');
  }
  if (
    result.configurationId !== null &&
    (typeof result.configurationId !== 'string' ||
      !/^[0-9A-Fa-f]{1,16}$/.test(result.configurationId))
  ) {
    throw new KarmaDeviceReadError('INVALID_READBACK');
  }
  if (status === 'COMPLETE' && result.configurationId === null) {
    throw new KarmaDeviceReadError('INVALID_READBACK');
  }
  return {
    coverageComplete: value.coverageComplete,
    readback: {
      status,
      configurationId: result.configurationId,
      parameters: parameters(result.parameters),
    },
    observations: value.observations.map(karmaReadObservation),
  };
}

export function karmaProfileObservation(value: unknown): KarmaProfileObservation {
  if (
    !record(value) ||
    !identifier(value.messageId) ||
    typeof value.eventTimeUtc !== 'string' ||
    !Number.isFinite(Date.parse(value.eventTimeUtc)) ||
    typeof value.rawMessage !== 'string' ||
    value.rawMessage.length > 8192 ||
    !value.rawMessage.startsWith('19,0,416,') ||
    typeof value.configurationId !== 'string' ||
    !/^[0-9A-Fa-f]{1,16}$/.test(value.configurationId) ||
    !Number.isInteger(value.messageNumber) ||
    typeof value.messageNumber !== 'number' ||
    value.messageNumber < 1 ||
    value.messageNumber > 1000 ||
    typeof value.lastMessage !== 'boolean' ||
    typeof value.profileId !== 'number' ||
    !Number.isInteger(value.profileId) ||
    value.profileId < 0 ||
    value.profileId > 65535
  ) {
    throw new KarmaDeviceReadError('INVALID_READBACK');
  }
  return {
    messageId: value.messageId,
    eventTimeUtc: value.eventTimeUtc,
    rawMessage: value.rawMessage,
    configurationId: value.configurationId,
    messageNumber: value.messageNumber,
    lastMessage: value.lastMessage,
    profileId: value.profileId,
  };
}

function profileReadback(value: unknown): KarmaProfileReadback {
  if (
    !record(value) ||
    typeof value.coverageComplete !== 'boolean' ||
    !record(value.readback) ||
    !Array.isArray(value.observations) ||
    value.observations.length > 64
  ) {
    throw new KarmaDeviceReadError('INVALID_READBACK');
  }
  const { status, profileId } = value.readback;
  if (
    (status !== 'COMPLETE' &&
      status !== 'INCOMPLETE' &&
      status !== 'CONFLICT' &&
      status !== 'ABSENT') ||
    (profileId !== null &&
      (typeof profileId !== 'number' ||
        !Number.isInteger(profileId) ||
        profileId < 0 ||
        profileId > 65535)) ||
    (status === 'COMPLETE' && profileId === null)
  ) {
    throw new KarmaDeviceReadError('INVALID_READBACK');
  }
  return {
    coverageComplete: value.coverageComplete,
    readback: { status, profileId },
    observations: value.observations.map(karmaProfileObservation),
  };
}

@Injectable()
export class KarmaDeviceReadsClient {
  async target(carId: string): Promise<{ carId: string; deviceId: string }> {
    const result = await this.post('target', { carId });
    if (
      !record(result) ||
      result.carId !== carId ||
      typeof result.deviceId !== 'string' ||
      !result.deviceId ||
      result.deviceId.length > 128 ||
      result.deviceId.includes('\u0000')
    ) {
      throw new KarmaDeviceReadError('INVALID_READBACK');
    }
    return { carId, deviceId: result.deviceId };
  }

  async request(
    carId: string,
    expectedDeviceId: string,
  ): Promise<{ status: 'ACCEPTED' | 'UNCERTAIN'; queueIds: string[] }> {
    return this.send('request', { carId, expectedDeviceId });
  }

  requestProfile(carId: string, expectedDeviceId: string) {
    return this.send('profile-request', { carId, expectedDeviceId });
  }

  requestParameter(
    carId: string,
    expectedDeviceId: string,
    parameterId: number,
    reportingIntervalSeconds: number,
    rawDefinition: string,
  ) {
    return this.send('parameter-request', {
      carId,
      expectedDeviceId,
      parameterId,
      reportingIntervalSeconds,
      rawDefinition,
    });
  }

  private async send(
    action: 'request' | 'profile-request' | 'parameter-request',
    body: Record<string, string | number>,
  ): Promise<{ status: 'ACCEPTED' | 'UNCERTAIN'; queueIds: string[] }> {
    const result = await this.post(action, body);
    if (
      !record(result) ||
      (result.status !== 'ACCEPTED' && result.status !== 'UNCERTAIN') ||
      !Array.isArray(result.queueIds) ||
      result.queueIds.length > 10 ||
      !result.queueIds.every(identifier)
    ) {
      throw new KarmaDeviceReadError('INVALID_READBACK');
    }
    return { status: result.status, queueIds: result.queueIds };
  }

  async observations(
    carId: string,
    expectedDeviceId: string,
    from: Date,
    to: Date,
    afterMessageId?: string,
  ): Promise<KarmaReadback> {
    return readback(
      await this.post('observations', {
        carId,
        expectedDeviceId,
        fromUtc: from.toISOString(),
        toUtc: to.toISOString(),
        ...(afterMessageId ? { afterMessageId } : {}),
      }),
    );
  }

  async profileObservations(
    carId: string,
    expectedDeviceId: string,
    from: Date,
    to: Date,
    afterMessageId?: string,
  ): Promise<KarmaProfileReadback> {
    return profileReadback(
      await this.post('profile-observations', {
        carId,
        expectedDeviceId,
        fromUtc: from.toISOString(),
        toUtc: to.toISOString(),
        ...(afterMessageId ? { afterMessageId } : {}),
      }),
    );
  }

  private async post(
    action:
      | 'target'
      | 'request'
      | 'observations'
      | 'profile-request'
      | 'parameter-request'
      | 'profile-observations',
    body: Record<string, string | number>,
  ): Promise<unknown> {
    const token = process.env.KARMA_INTERNAL_TOKEN;
    if (!token || token.length < 32) {
      throw new KarmaDeviceReadError('KARMA_UNAVAILABLE');
    }
    try {
      const base = new URL(process.env.FLEET_KARMA_INTERNAL_URL ?? 'http://127.0.0.1:11014');
      if (
        !['http:', 'https:'].includes(base.protocol) ||
        base.username ||
        base.password ||
        base.search ||
        base.hash ||
        base.pathname !== '/'
      ) {
        throw new KarmaDeviceReadError('KARMA_UNAVAILABLE');
      }
      base.pathname = `/internal/device-configuration/${action}`;
      const response = await fetch(base, {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(
          action.endsWith('observations') ? 21000 : KARMA_COMMAND_TIMEOUT_MS,
        ),
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      if (response.status === 409) {
        await response.body?.cancel();
        throw new KarmaDeviceReadError('TARGET_CHANGED');
      }
      if (!response.ok || Number(response.headers.get('content-length') ?? 0) > 2_097_152) {
        await response.body?.cancel();
        throw new KarmaDeviceReadError('KARMA_UNAVAILABLE');
      }
      if (!response.body) {
        throw new KarmaDeviceReadError('INVALID_READBACK');
      }
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) {
          break;
        }
        const bytes: unknown = chunk.value;
        if (!(bytes instanceof Uint8Array)) {
          await reader.cancel();
          throw new KarmaDeviceReadError('INVALID_READBACK');
        }
        size += bytes.byteLength;
        if (size > 2_097_152) {
          await reader.cancel();
          throw new KarmaDeviceReadError('INVALID_READBACK');
        }
        chunks.push(bytes);
      }
      const data: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      return data;
    } catch (error) {
      if (error instanceof KarmaDeviceReadError) {
        throw error;
      }
      throw new KarmaDeviceReadError('KARMA_UNAVAILABLE');
    }
  }
}
