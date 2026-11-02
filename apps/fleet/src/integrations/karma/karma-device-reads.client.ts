import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { decodeRuleRecord } from '@holita/edata-rules';

export const KARMA_COMMAND_TIMEOUT_MS = 4500;

export interface KarmaReadParameter {
  parameterId: number;
  reportingIntervalSeconds: number;
  rawDefinition: string;
}

export interface KarmaReadTerminalResponse {
  messageId: string;
  eventTimeUtc: string;
  rawMessage: '19,0,154,0';
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
  terminalResponse?: KarmaReadTerminalResponse;
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

export interface KarmaReadRule {
  ruleId: number;
  rawDefinition: string;
}

export interface KarmaRuleObservation {
  messageId: string;
  eventTimeUtc: string;
  rawMessage: string;
  configurationId: string;
  messageNumber: number;
  lastMessage: boolean;
  rules: KarmaReadRule[];
}

export interface KarmaRulesReadback {
  coverageComplete: boolean;
  terminalResponse?: KarmaReadTerminalResponse;
  readback: {
    status: 'COMPLETE' | 'INCOMPLETE' | 'CONFLICT' | 'ABSENT';
    configurationId: string | null;
    rules: KarmaReadRule[];
  };
  observations: KarmaRuleObservation[];
}

export type KarmaDiagnosticReadKind = 'READ_FAULT_LOGGER' | 'READ_COMMUNICATION_DIAGNOSTICS';

export interface KarmaDiagnosticObservation {
  messageId: string;
  eventTimeUtc: string;
  rawMessage: string;
  family: 'SPECIAL_ACK' | 'FAULT_REPORT' | 'UNRESOLVED_FAULT_REPORT' | 'COMMUNICATION_DIAGNOSTICS';
  acknowledgement: 'NACK' | 'POSITIVE_ACK' | null;
}

export interface KarmaDiagnosticReadback {
  coverageComplete: boolean;
  queue: { id: string; state: number | null }[];
  observations: KarmaDiagnosticObservation[];
}

export class KarmaDeviceReadError extends ServiceUnavailableException {
  constructor(
    readonly code: 'KARMA_UNAVAILABLE' | 'KARMA_TIMEOUT' | 'TARGET_CHANGED' | 'INVALID_READBACK',
  ) {
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

function diagnosticFamily(rawMessage: string): KarmaDiagnosticObservation['family'] | null {
  if (rawMessage === '19,0,154,0' || rawMessage === '19,0,154,1') {
    return 'SPECIAL_ACK';
  }
  const parts = rawMessage.split(',');
  const payload = parts[7];
  if (
    parts.length !== 8 ||
    parts[0] !== '19' ||
    parts[1] !== '0' ||
    parts[3] !== '0' ||
    !/^[01]$/.test(parts[4] ?? '') ||
    !/^[1-9][0-9]*$/.test(parts[5] ?? '') ||
    !Number.isSafeInteger(Number(parts[5])) ||
    !/^[0-9]{1,5}$/.test(parts[6] ?? '') ||
    Number(parts[6]) > 65535 ||
    payload === undefined ||
    !/^(?:[0-9a-f]{2})*$/i.test(payload)
  ) {
    return null;
  }
  if (parts[2] === '411') {
    return payload.length >= 8 ? 'COMMUNICATION_DIAGNOSTICS' : null;
  }
  if (parts[2] !== '413' && parts[2] !== '418' && parts[2] !== '419') {
    return null;
  }
  return payload.length <= 2 ? 'UNRESOLVED_FAULT_REPORT' : 'FAULT_REPORT';
}

export function karmaDiagnosticReadback(value: unknown): KarmaDiagnosticReadback {
  if (
    !record(value) ||
    typeof value.coverageComplete !== 'boolean' ||
    !Array.isArray(value.queue) ||
    value.queue.length > 32 ||
    !Array.isArray(value.observations) ||
    value.observations.length > 64
  ) {
    throw new KarmaDeviceReadError('INVALID_READBACK');
  }
  return {
    coverageComplete: value.coverageComplete,
    queue: value.queue.map((item: unknown) => {
      if (
        !record(item) ||
        !identifier(item.id) ||
        (item.state !== null &&
          (typeof item.state !== 'number' || !Number.isSafeInteger(item.state) || item.state < 0))
      ) {
        throw new KarmaDeviceReadError('INVALID_READBACK');
      }
      return { id: item.id, state: item.state };
    }),
    observations: value.observations.map((item: unknown) => {
      if (
        !record(item) ||
        !identifier(item.messageId) ||
        typeof item.eventTimeUtc !== 'string' ||
        !Number.isFinite(Date.parse(item.eventTimeUtc)) ||
        typeof item.rawMessage !== 'string' ||
        item.rawMessage.length > 8192 ||
        (item.family !== 'SPECIAL_ACK' &&
          item.family !== 'FAULT_REPORT' &&
          item.family !== 'UNRESOLVED_FAULT_REPORT' &&
          item.family !== 'COMMUNICATION_DIAGNOSTICS') ||
        item.family !== diagnosticFamily(item.rawMessage) ||
        (item.acknowledgement !== null &&
          item.acknowledgement !== 'NACK' &&
          item.acknowledgement !== 'POSITIVE_ACK') ||
        (item.family === 'SPECIAL_ACK') !== (item.acknowledgement !== null) ||
        (item.acknowledgement === 'NACK' && item.rawMessage !== '19,0,154,0') ||
        (item.acknowledgement === 'POSITIVE_ACK' && item.rawMessage !== '19,0,154,1')
      ) {
        throw new KarmaDeviceReadError('INVALID_READBACK');
      }
      return {
        messageId: item.messageId,
        eventTimeUtc: item.eventTimeUtc,
        rawMessage: item.rawMessage,
        family: item.family,
        acknowledgement: item.acknowledgement,
      };
    }),
  };
}

export function karmaReadTerminalResponse(value: unknown): KarmaReadTerminalResponse {
  if (
    !record(value) ||
    !identifier(value.messageId) ||
    typeof value.eventTimeUtc !== 'string' ||
    !Number.isFinite(Date.parse(value.eventTimeUtc)) ||
    value.rawMessage !== '19,0,154,0'
  ) {
    throw new KarmaDeviceReadError('INVALID_READBACK');
  }
  return {
    messageId: value.messageId,
    eventTimeUtc: value.eventTimeUtc,
    rawMessage: value.rawMessage,
  };
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

export function karmaReadRule(value: unknown): KarmaReadRule {
  if (
    !record(value) ||
    typeof value.ruleId !== 'number' ||
    typeof value.rawDefinition !== 'string'
  ) {
    throw new KarmaDeviceReadError('INVALID_READBACK');
  }
  try {
    const rule = decodeRuleRecord(value.rawDefinition);
    if (rule.ruleId !== value.ruleId) {
      throw new KarmaDeviceReadError('INVALID_READBACK');
    }
    return { ruleId: rule.ruleId, rawDefinition: value.rawDefinition.toUpperCase() };
  } catch {
    throw new KarmaDeviceReadError('INVALID_READBACK');
  }
}

function rules(value: unknown): KarmaReadRule[] {
  if (!Array.isArray(value) || value.length > 1000) {
    throw new KarmaDeviceReadError('INVALID_READBACK');
  }
  return value.map(karmaReadRule);
}

export function karmaRuleObservation(value: unknown): KarmaRuleObservation {
  if (
    !record(value) ||
    !identifier(value.messageId) ||
    typeof value.eventTimeUtc !== 'string' ||
    !Number.isFinite(Date.parse(value.eventTimeUtc)) ||
    typeof value.rawMessage !== 'string' ||
    value.rawMessage.length > 8192 ||
    !value.rawMessage.startsWith('19,0,402,') ||
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
    rules: rules(value.rules),
  };
}

function rulesReadback(value: unknown): KarmaRulesReadback {
  if (
    !record(value) ||
    typeof value.coverageComplete !== 'boolean' ||
    !record(value.readback) ||
    !Array.isArray(value.observations) ||
    value.observations.length > 64
  ) {
    throw new KarmaDeviceReadError('INVALID_READBACK');
  }
  const { status, configurationId } = value.readback;
  if (
    (status !== 'COMPLETE' &&
      status !== 'INCOMPLETE' &&
      status !== 'CONFLICT' &&
      status !== 'ABSENT') ||
    (configurationId !== null &&
      (typeof configurationId !== 'string' || !/^[0-9A-Fa-f]{1,16}$/.test(configurationId))) ||
    (status === 'COMPLETE' && configurationId === null)
  ) {
    throw new KarmaDeviceReadError('INVALID_READBACK');
  }
  return {
    coverageComplete: value.coverageComplete,
    readback: { status, configurationId, rules: rules(value.readback.rules) },
    observations: value.observations.map(karmaRuleObservation),
    ...(value.terminalResponse === undefined
      ? {}
      : { terminalResponse: karmaReadTerminalResponse(value.terminalResponse) }),
  };
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
    ...(value.terminalResponse === undefined
      ? {}
      : { terminalResponse: karmaReadTerminalResponse(value.terminalResponse) }),
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

  requestRules(carId: string, expectedDeviceId: string) {
    return this.send('rules-request', { carId, expectedDeviceId });
  }

  async diagnosticWatermark(carId: string, expectedDeviceId: string): Promise<string | null> {
    const result = await this.post('diagnostic-watermark', { carId, expectedDeviceId });
    if (!record(result) || (result.afterMessageId !== null && !identifier(result.afterMessageId))) {
      throw new KarmaDeviceReadError('INVALID_READBACK');
    }
    return result.afterMessageId;
  }

  async requestDiagnostic(
    carId: string,
    expectedDeviceId: string,
    kind: KarmaDiagnosticReadKind,
    existingQueueIds: string[],
  ): Promise<{ status: 'ACCEPTED' | 'UNCERTAIN' | 'PENDING'; queueIds: string[] }> {
    const result = await this.post('diagnostic-request', {
      carId,
      expectedDeviceId,
      kind,
      existingQueueIds,
    });
    if (
      !record(result) ||
      (result.status !== 'ACCEPTED' &&
        result.status !== 'UNCERTAIN' &&
        result.status !== 'PENDING') ||
      !Array.isArray(result.queueIds) ||
      result.queueIds.length > 32 ||
      !result.queueIds.every(identifier)
    ) {
      throw new KarmaDeviceReadError('INVALID_READBACK');
    }
    return { status: result.status, queueIds: result.queueIds };
  }

  async diagnosticObservations(
    carId: string,
    expectedDeviceId: string,
    from: Date,
    to: Date,
    queueIds: string[],
    afterMessageId?: string,
  ): Promise<KarmaDiagnosticReadback> {
    return karmaDiagnosticReadback(
      await this.post('diagnostic-observations', {
        carId,
        expectedDeviceId,
        fromUtc: from.toISOString(),
        toUtc: to.toISOString(),
        queueIds,
        ...(afterMessageId ? { afterMessageId } : {}),
      }),
    );
  }

  requestRule(carId: string, expectedDeviceId: string, ruleId: number, rawDefinition: string) {
    return this.send('rule-request', { carId, expectedDeviceId, ruleId, rawDefinition });
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
    action: 'request' | 'profile-request' | 'parameter-request' | 'rules-request' | 'rule-request',
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

  async rulesObservations(
    carId: string,
    expectedDeviceId: string,
    from: Date,
    to: Date,
    afterMessageId?: string,
  ): Promise<KarmaRulesReadback> {
    return rulesReadback(
      await this.post('rules-observations', {
        carId,
        expectedDeviceId,
        fromUtc: from.toISOString(),
        toUtc: to.toISOString(),
        ...(afterMessageId ? { afterMessageId } : {}),
      }),
    );
  }

  monitoring(
    action: 'status' | 'history',
    body: Record<string, string | number | string[]> = {},
  ): Promise<unknown> {
    return this.post(action === 'status' ? 'monitoring-status' : 'monitoring-history', body);
  }

  private async post(
    action:
      | 'monitoring-status'
      | 'monitoring-history'
      | 'target'
      | 'request'
      | 'observations'
      | 'profile-request'
      | 'parameter-request'
      | 'profile-observations'
      | 'rules-request'
      | 'rule-request'
      | 'rules-observations'
      | 'diagnostic-watermark'
      | 'diagnostic-request'
      | 'diagnostic-observations',
    body: Record<string, string | number | string[]>,
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
      base.pathname = action.startsWith('monitoring-')
        ? `/internal/karma-monitoring/${action.slice('monitoring-'.length)}`
        : `/internal/device-configuration/${action}`;
      const response = await fetch(base, {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(
          action.startsWith('monitoring-')
            ? 50000
            : action.endsWith('observations') || action === 'diagnostic-request'
              ? 21000
              : KARMA_COMMAND_TIMEOUT_MS,
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
      const monitoringFailure = action.startsWith('monitoring-') && response.status === 503;
      if (
        (!response.ok && !monitoringFailure) ||
        Number(response.headers.get('content-length') ?? 0) > 2_097_152
      ) {
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
      if (!response.ok) {
        // Only fixed internal codes cross into persisted monitoring details.
        throw new KarmaDeviceReadError(
          record(data) && data.code === 'MONITORING_TIMEOUT'
            ? 'KARMA_TIMEOUT'
            : record(data) && data.code === 'MONITORING_INVALID_RESPONSE'
              ? 'INVALID_READBACK'
              : 'KARMA_UNAVAILABLE',
        );
      }
      return data;
    } catch (error) {
      if (error instanceof KarmaDeviceReadError) {
        throw error;
      }
      throw new KarmaDeviceReadError('KARMA_UNAVAILABLE');
    }
  }
}
