import type { ErmDeviceAction } from '../../generated/graphql/types.js';
import type { DeviceCommand } from '../devices/command.js';

// StarLink C5/C48/C56 and the vendor's 2026-10-29 eData command reference.
export const deviceActions: Record<ErmDeviceAction, DeviceCommand> = {
  REQUEST_LOCATION: { command: '05', fields: [] },
  READ_STATUS: {
    command: '48',
    fields: ['IGN=#IGN#;ENG=#ENG#;VIN=#VIN#;VBAT=#VBAT#;CSS=#CSS#;JAM=#JAM#'],
  },
  READ_VERSION: { command: '48', fields: ['VER=#VER#'] },
  READ_ACCESSORIES: { command: '56', fields: [] },
  READ_EDATA_DIAGNOSTICS: { command: '30', fields: ['19', '0', '19', '306', '0', '1', '1', ''] },
  READ_EDATA_FAULTS: { command: '30', fields: ['19', '0', '19', '301', '0', '1', '1', '19'] },
};
