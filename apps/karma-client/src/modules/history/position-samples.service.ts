import { Injectable } from '@nestjs/common';
import { requireTenant } from '../../auth/demo-auth.js';
import type { KarmaPositionSamplesInput } from '../../generated/graphql/types.js';
import type { RequestContext } from '../../graphql/request-context.js';
import { KarmaTransport } from '../../integrations/karma/karma-transport.js';
import { CarsService } from '../cars/cars.service.js';
import {
  positionSamplesInput,
  positionSamplesLimits,
  positionSamplesParameters,
} from './position-samples-query.js';
import { initialPositionSamples, positionSamplesResult } from './position-samples-response.js';

@Injectable()
export class PositionSamplesService {
  constructor(
    private readonly karma: KarmaTransport,
    private readonly cars: CarsService,
  ) {}

  async read(input: KarmaPositionSamplesInput, context: RequestContext) {
    requireTenant(context);
    const selection = positionSamplesInput(input);
    const result = initialPositionSamples(selection);
    const signal = AbortSignal.timeout(positionSamplesLimits.deadlineMs);
    let source: unknown;
    try {
      const car = await this.cars.find(selection.carId, context, signal);
      if (!car) {
        result.retrieval = 'UNAVAILABLE';
        result.reason = 'CAR_NOT_FOUND';
        result.retrievedAt = new Date().toISOString();
        return result;
      }
      source = await this.karma.readPositionEvents(positionSamplesParameters(selection), signal);
    } catch {
      result.retrieval = 'UNAVAILABLE';
      result.reason = 'UPSTREAM_FAILURE';
      result.retrievedAt = new Date().toISOString();
      return result;
    }
    try {
      return positionSamplesResult(result, source);
    } catch {
      result.retrieval = 'UNAVAILABLE';
      result.reason = 'INCOMPATIBLE_SOURCE';
      return result;
    } finally {
      result.retrievedAt = new Date().toISOString();
    }
  }
}
