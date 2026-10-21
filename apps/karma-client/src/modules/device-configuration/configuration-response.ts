import { ServiceUnavailableException } from '@nestjs/common';

export interface ConfigurationParameter {
  parameterId: number;
  reportingIntervalSeconds: number;
  rawDefinition: string;
}

export interface ConfigurationObservation {
  messageId: string;
  eventTimeUtc: string;
  rawMessage: string;
  configurationId: string;
  messageNumber: number;
  lastMessage: boolean;
  parameters: ConfigurationParameter[];
}

export interface ConfigurationReadback {
  status: 'ABSENT' | 'INCOMPLETE' | 'CONFLICT' | 'COMPLETE';
  configurationId: string | null;
  parameters: ConfigurationParameter[];
}

function unavailable(): never {
  throw new ServiceUnavailableException('Karma configuration observations are unavailable');
}

export function configurationObservation(
  messageId: string,
  eventTimeUtc: string,
  rawMessage: string,
): ConfigurationObservation | null {
  if (!/^19,0,401,/.test(rawMessage)) {
    return null;
  }
  const fields = /^19,0,401,0,([01]),([1-9]\d{0,3}),(0|[1-9]\d{0,4}),07([a-f\d]*)$/i.exec(
    rawMessage,
  );
  if (!fields || rawMessage.length > 8192) {
    unavailable();
  }
  const configurationId = fields[3];
  const definitions = fields[4];
  const messageNumber = Number(fields[2]);
  if (
    configurationId === undefined ||
    definitions === undefined ||
    Number(configurationId) > 65535 ||
    messageNumber > 1000 ||
    definitions.length % 44 !== 0
  ) {
    unavailable();
  }
  const parameters: ConfigurationParameter[] = [];
  for (let offset = 0; offset < definitions.length; offset += 44) {
    const rawDefinition = definitions.slice(offset, offset + 44).toUpperCase();
    parameters.push({
      parameterId: Number.parseInt(rawDefinition.slice(0, 4), 16),
      reportingIntervalSeconds: Number.parseInt(rawDefinition.slice(40, 44), 16),
      rawDefinition,
    });
  }
  return {
    messageId,
    eventTimeUtc,
    rawMessage,
    configurationId,
    messageNumber,
    lastMessage: fields[1] === '1',
    parameters,
  };
}

export function configurationReadback(
  observations: ConfigurationObservation[],
  coverageComplete: boolean,
): ConfigurationReadback {
  if (!observations.length) {
    return { status: 'ABSENT', configurationId: null, parameters: [] };
  }
  const configurationId = observations[0]?.configurationId ?? null;
  const incomplete: ConfigurationReadback = {
    status: 'INCOMPLETE',
    configurationId,
    parameters: [],
  };
  const conflict: ConfigurationReadback = {
    status: 'CONFLICT',
    configurationId: null,
    parameters: [],
  };
  const parts = new Map<number, ConfigurationObservation>();
  for (const observation of observations) {
    if (observation.configurationId !== configurationId) {
      return conflict;
    }
    const previous = parts.get(observation.messageNumber);
    if (
      previous &&
      (previous.lastMessage !== observation.lastMessage ||
        JSON.stringify(previous.parameters) !== JSON.stringify(observation.parameters))
    ) {
      return conflict;
    }
    parts.set(observation.messageNumber, observation);
  }
  const last = [...parts.values()].filter((part) => part.lastMessage);
  if (last.length > 1) {
    return conflict;
  }
  const finalNumber = last[0]?.messageNumber;
  if (finalNumber === undefined || !coverageComplete) {
    return incomplete;
  }
  if ([...parts.keys()].some((number) => number > finalNumber)) {
    return conflict;
  }
  const parameters: ConfigurationParameter[] = [];
  for (let number = 1; number <= finalNumber; number++) {
    const part = parts.get(number);
    if (!part) {
      return incomplete;
    }
    parameters.push(...part.parameters);
  }
  if (
    parameters.length > 1000 ||
    new Set(parameters.map((row) => row.parameterId)).size !== parameters.length
  ) {
    return conflict;
  }
  return { status: 'COMPLETE', configurationId, parameters };
}
