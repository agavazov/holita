import { BadRequestException } from '@nestjs/common';
import type { KarmaPositionSamplesInput } from '../../generated/graphql/types.js';

export const positionSamplesLimits = { maxRows: 500, deadlineMs: 4000 };

export function positionSamplesInput(input: KarmaPositionSamplesInput): KarmaPositionSamplesInput {
  const ids = [input.carId, input.startMessageId, input.stopMessageId];
  if (
    ids.some((value) => !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) ||
    Number(input.startMessageId) > Number(input.stopMessageId) ||
    !Number.isSafeInteger(Number(input.stopMessageId) + 1)
  ) {
    throw new BadRequestException('Invalid Karma position message window');
  }
  return input;
}

export function positionSamplesParameters(input: KarmaPositionSamplesInput): URLSearchParams {
  const parameters = new URLSearchParams({
    car: input.carId,
    from_id: String(Number(input.startMessageId) - 1),
    to_id: String(Number(input.stopMessageId) + 1),
    date_type: 'utc',
  });
  for (const field of ['spd', 'odo', 'edt_tz', 'pdt']) {
    parameters.append('fields[]', field);
  }
  return parameters;
}
