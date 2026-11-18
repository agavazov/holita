import type {
  ErmCommand,
  ErmConfigurationChange,
  ErmConfigurationStep,
} from '../../generated/graphql/types.js';
import type { ErmConfigurationChange as StoredChange } from '../../generated/prisma/client.js';
import type { RequestContext } from '../../graphql/request-context.js';
import { maskCommandEvidence } from './command-evidence.js';
import { isViewer, maskParameterValue, protectedParameter } from './operator-roles.js';

function maskParameterJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(maskParameterJson);
  }
  if (typeof value !== 'object' || value === null) {
    return value;
  }
  const entries: [string, unknown][] = Object.entries(value);
  const parameter = entries.find(([key]) => key === 'parameter')?.[1];
  const secret =
    (typeof parameter === 'string' || typeof parameter === 'number') &&
    protectedParameter(parameter);
  return Object.fromEntries(
    entries.map(([key, entry]) => [
      key,
      secret && key === 'value' ? '[REDACTED]' : maskParameterJson(entry),
    ]),
  );
}

export function maskConfigurationChange(
  change: ErmConfigurationChange,
  context?: RequestContext,
): ErmConfigurationChange {
  if (!context || !isViewer(context)) {
    return change;
  }
  const viewerContext = context;
  const parameter = change.operation === 'PARAMETER' ? change.parameter : null;
  const secret = parameter != null && protectedParameter(parameter);
  const hasSecrets = secret || change.parameters.some(protectedParameter);
  function maskPayload(payload: string | null | undefined): string | null {
    if (payload == null) {
      return null;
    }
    if (secret) {
      return maskParameterValue(parameter, payload, viewerContext);
    }
    if (!hasSecrets) {
      return payload;
    }
    try {
      const value: unknown = JSON.parse(payload);
      return JSON.stringify(maskParameterJson(value));
    } catch {
      return '[REDACTED]';
    }
  }
  return {
    ...change,
    baseline: maskParameterJson(change.baseline),
    intended: maskPayload(change.intended),
    steps: Array.isArray(change.steps)
      ? change.steps.map((step: unknown) => {
          if (typeof step !== 'object' || step === null || Array.isArray(step)) {
            return step;
          }
          return Object.fromEntries(
            Object.entries(step).map(([key, value]) => [
              key,
              key === 'payload' && typeof value === 'string'
                ? maskPayload(value)
                : maskParameterJson(value),
            ]),
          );
        })
      : change.steps,
    stepDetails: change.stepDetails.map((step) => ({
      ...step,
      payload: maskPayload(step.payload),
      configuration: maskParameterJson(step.configuration),
      transportCommand: step.transportCommand
        ? maskCommandEvidence(step.transportCommand, context)
        : null,
    })),
  };
}

export function configurationChangeView(
  change: StoredChange,
  commands: ReadonlyMap<string, ErmCommand> = new Map(),
  context?: RequestContext,
): ErmConfigurationChange {
  if (!Array.isArray(change.steps)) {
    throw new Error('Invalid stored configuration steps');
  }
  const stepDetails = change.steps.map((step): ErmConfigurationStep => {
    if (
      typeof step !== 'object' ||
      step === null ||
      Array.isArray(step) ||
      typeof step['name'] !== 'string' ||
      typeof step['time'] !== 'string' ||
      typeof step['outcome'] !== 'string' ||
      (step['commandId'] !== null && typeof step['commandId'] !== 'string')
    ) {
      throw new Error('Invalid stored configuration step');
    }
    const commandId = step['commandId'];
    const command = commandId === null ? undefined : commands.get(commandId);
    const outcome = step['outcome'];
    return {
      name: step['name'],
      at: new Date(step['time']),
      outcome,
      outcomeCode: /^ANSWERED \d+$/.test(outcome)
        ? 'ACKNOWLEDGED'
        : outcome.startsWith('ANSWERED REJECTED ')
          ? 'REJECTED'
          : outcome,
      commandId,
      transportCommand: command?.unitId === change.unitId ? command : null,
      payload: typeof step['payload'] === 'string' ? step['payload'] : null,
      configuration: step['configuration'] ?? null,
    };
  });
  return maskConfigurationChange({ ...change, stepDetails }, context);
}
