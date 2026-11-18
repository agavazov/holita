import { HttpException, type Logger } from '@nestjs/common';
import type { FleetVehicleActionFailure } from './generated/graphql/types.js';
import type { RequestContext } from './graphql/request-context.js';

const ACTION_FAILURE_CODES = new Map([
  [400, 'BAD_USER_INPUT'],
  [404, 'NOT_FOUND'],
  [409, 'CONFLICT'],
  [503, 'SERVICE_UNAVAILABLE'],
]);

/** Sequential Fleet batch writes retain independent successes and sanitized failures. */
export async function runFleetActions(
  selected: readonly string[],
  context: RequestContext,
  logger: Logger,
  failureMessage: string,
  action: (id: string) => Promise<unknown>,
) {
  const succeededIds: string[] = [];
  const failures: Pick<FleetVehicleActionFailure, 'id' | 'code' | 'message'>[] = [];
  for (const id of selected) {
    try {
      await action(id);
      succeededIds.push(id);
    } catch (error: unknown) {
      const code =
        error instanceof HttpException ? ACTION_FAILURE_CODES.get(error.getStatus()) : undefined;
      if (code && error instanceof HttpException) {
        failures.push({ id, code, message: error.message });
      } else {
        logger.error({
          requestId: context.requestId,
          error: error instanceof Error ? error.name : 'UnknownError',
        });
        failures.push({ id, code: 'INTERNAL_SERVER_ERROR', message: failureMessage });
      }
    }
  }
  return { succeededIds, failures };
}
