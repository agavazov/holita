import { BadRequestException } from '@nestjs/common';
import type { ErmDeviceAction } from '../../generated/graphql/types.js';
import { validateCommand, type DeviceCommand } from '../devices/command.js';
import { protectedParameter } from './operator-roles.js';

// StarLink C5/C48/C56 and the vendor's 2026-10-29 eData command reference.
export const deviceActions: Record<Exclude<ErmDeviceAction, 'READ_PARAMETERS'>, DeviceCommand> = {
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

/** The validated command of a request; READ_PARAMETERS reads its parameters with 03 or one 45. */
export function actionCommand(
  action: ErmDeviceAction,
  parameters: readonly number[],
): DeviceCommand {
  if (action !== 'READ_PARAMETERS') {
    if (parameters.length) {
      throw new BadRequestException('Only READ_PARAMETERS takes parameters');
    }
    return validateCommand(deviceActions[action]);
  }
  if (
    parameters.length === 0 ||
    parameters.length > 20 ||
    new Set(parameters).size !== parameters.length ||
    parameters.some((parameter) => protectedParameter(parameter))
  ) {
    throw new BadRequestException(
      'READ_PARAMETERS needs 1–20 distinct parameters, excluding routing and protected values',
    );
  }
  const fields = parameters.map((parameter) => String(parameter).padStart(4, '0'));
  return validateCommand({ command: fields.length === 1 ? '03' : '45', fields });
}
