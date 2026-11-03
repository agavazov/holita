import type {
  ErmCommandsPage,
  ErmEventsPage,
  ErmFramesPage,
  ErmUnitState,
} from '../../generated/graphql/types.js';

export interface DeviceTelemetryRequest {
  unitIds: string[];
  states?: Promise<Map<string, ErmUnitState | null>>;
  events: Map<string, Promise<Map<string, ErmEventsPage>>>;
  frames: Map<string, Promise<Map<string, ErmFramesPage>>>;
  commands: Map<string, Promise<Map<string, ErmCommandsPage>>>;
}

export function deviceTelemetryRequest(unitIds: string[]): DeviceTelemetryRequest {
  return {
    unitIds: [...new Set(unitIds)],
    events: new Map(),
    frames: new Map(),
    commands: new Map(),
  };
}
