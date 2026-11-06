import type {
  ErmCommand,
  ErmConfigurationChange,
  ErmConfigurationStep,
} from '../../generated/graphql/types.js';
import type { ErmConfigurationChange as StoredChange } from '../../generated/prisma/client.js';

export function configurationChangeView(
  change: StoredChange,
  commands: ReadonlyMap<string, ErmCommand> = new Map(),
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
      outcomeCode:
        outcome === 'ANSWERED 01'
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
  return { ...change, stepDetails };
}
