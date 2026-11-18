import type {
  ErmCommandsPage,
  ErmEventsPage,
  ErmFramesPage,
  ErmUnitState,
  ErmParameterSnapshotsPage,
  ErmConfigurationChange,
  ErmCommandRequest,
} from '../../generated/graphql/types.js';

export interface DeviceTelemetryRequest {
  unitIds: string[];
  deviceIds: string[];
  devices: { id: string; imei: string }[];
  states?: Promise<Map<string, ErmUnitState | null>>;
  events: Map<string, Promise<Map<string, ErmEventsPage>>>;
  frames: Map<string, Promise<Map<string, ErmFramesPage>>>;
  commands: Map<string, Promise<Map<string, ErmCommandsPage>>>;
  snapshots: Map<string, Promise<Map<string, ErmParameterSnapshotsPage>>>;
  configurationChanges?: Promise<Map<string, ErmConfigurationChange[]>>;
  commandRequests?: Promise<Map<string, ErmCommandRequest[]>>;
}

export function deviceTelemetryRequest(
  unitIds: string[],
  devices: { id: string; imei: string }[] = [],
): DeviceTelemetryRequest {
  return {
    unitIds: [...new Set(unitIds)],
    deviceIds: [...new Set(devices.map(({ id }) => id))],
    devices,
    events: new Map(),
    frames: new Map(),
    commands: new Map(),
    snapshots: new Map(),
  };
}
