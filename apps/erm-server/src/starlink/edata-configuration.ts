import { decodeEdata } from './edata.js';

export interface EdataConfigurationObservation {
  eventId: string;
  receivedAt: string;
  fields: readonly string[];
}

export interface EdataConfigurationDefinition {
  parameter: number;
  interval: number;
  definition: string;
}

export interface EdataConfiguration {
  configurationId: string;
  definitions: EdataConfigurationDefinition[];
  observedAt: string;
  eventIds: string[];
}

function definitionFromHex(definition: string): EdataConfigurationDefinition {
  return {
    parameter: Number.parseInt(definition.slice(0, 4), 16),
    interval: Number.parseInt(definition.slice(40, 44), 16),
    definition: definition.toUpperCase(),
  };
}

// Simple eData 4.04 sections 2 and 3.1: retain the complete 22-byte definitions.
// The caller supplies only observations received after its read command.
export function assembleEdataConfiguration(
  observations: readonly EdataConfigurationObservation[],
): EdataConfiguration | undefined {
  const parts = new Map<number, { final: boolean; payload: string }>();
  let configurationId: string | undefined;
  let observedAt: string | undefined;
  const eventIds: string[] = [];
  for (const observation of observations) {
    const fields = observation.fields;
    if (fields[0] !== '19' || fields[1] !== '0' || fields[2] !== '401') {
      continue;
    }
    const numberText = fields[5];
    const id = fields[6];
    if (
      !['0', '1'].includes(fields[4] ?? '') ||
      numberText === undefined ||
      !/^[1-9]\d*$/.test(numberText) ||
      id === undefined ||
      !/^(0|[1-9]\d*)$/.test(id) ||
      Number(id) > 65535
    ) {
      return undefined;
    }
    const number = Number(numberText);
    const report = decodeEdata(fields);
    if (!Number.isSafeInteger(number) || !report || !('parameters' in report)) {
      return undefined;
    }
    const payload = report.payload.toUpperCase();
    if (!/^07(?:[0-9A-F]{44})*$/.test(payload)) {
      return undefined;
    }
    if (configurationId !== undefined && configurationId !== id) {
      return undefined;
    }
    configurationId = id;
    const final = fields[4] === '1';
    const previous = parts.get(number);
    if (previous && (previous.final !== final || previous.payload !== payload)) {
      return undefined;
    }
    parts.set(number, { final, payload });
    if (observedAt === undefined || observation.receivedAt > observedAt) {
      observedAt = observation.receivedAt;
    }
    eventIds.push(observation.eventId);
  }
  const finals = [...parts.entries()].filter(([, part]) => part.final);
  const finalNumber = finals[0]?.[0];
  if (
    configurationId === undefined ||
    observedAt === undefined ||
    finals.length !== 1 ||
    finalNumber === undefined ||
    parts.size !== finalNumber
  ) {
    return undefined;
  }
  const definitions = new Map<number, EdataConfigurationDefinition>();
  for (let number = 1; number <= finalNumber; number++) {
    const part = parts.get(number);
    if (!part) {
      return undefined;
    }
    for (let offset = 2; offset < part.payload.length; offset += 44) {
      const definition = definitionFromHex(part.payload.slice(offset, offset + 44));
      const previous = definitions.get(definition.parameter);
      if (previous && previous.definition !== definition.definition) {
        return undefined;
      }
      definitions.set(definition.parameter, definition);
    }
  }
  return {
    configurationId,
    definitions: [...definitions.values()].sort((left, right) => left.parameter - right.parameter),
    observedAt,
    eventIds,
  };
}

// Monitor's text export contains headings and complete server-command lines.
// Extract only parameter 301/01 or 301/02 payloads; never execute exported commands.
export function splitEdataDefinitions(input: string): EdataConfigurationDefinition[] {
  const text = input.trim();
  const payloads = /^[0-9A-Fa-f]+$/.test(text)
    ? [text]
    : text.split(/\r?\n/).flatMap((line) => {
        // ERM's exports may prefix the command with tab-separated message columns.
        const match = /(?:^|\s)(?:30,1,)?19,0,19,301,0,1,1,([0-9A-Fa-f]*)/.exec(line);
        const payload = match?.[1];
        return payload !== undefined && /^(01|02)/i.test(payload) ? [payload] : [];
      });
  if (payloads.length === 0) {
    throw new Error('No 301 parameter definitions found');
  }
  const definitions: EdataConfigurationDefinition[] = [];
  for (const payload of payloads) {
    if (!/^(01|02)(?:[0-9A-Fa-f]{44})+$/.test(payload)) {
      throw new Error('Expected a 301 payload with operation 01 or 02 and 22-byte definitions');
    }
    for (let offset = 2; offset < payload.length; offset += 44) {
      definitions.push(definitionFromHex(payload.slice(offset, offset + 44)));
    }
  }
  return definitions;
}
