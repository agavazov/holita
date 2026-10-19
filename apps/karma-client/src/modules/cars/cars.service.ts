import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { KarmaTransport } from '../../integrations/karma/karma-transport.js';
import { requireTenant } from '../../auth/demo-auth.js';
import type { RequestContext } from '../../graphql/request-context.js';
import { cars } from './cars-response.js';

@Injectable()
export class CarsService {
  constructor(private readonly karma: KarmaTransport) {}

  list(context: RequestContext) {
    requireTenant(context);
    // This account's cars are intentionally shared by all authenticated tenants.
    return this.karma.read('cars', new URLSearchParams()).then(cars);
  }

  find(id: string, context: RequestContext, signal?: AbortSignal) {
    requireTenant(context);
    return this.readCar(id, signal);
  }

  private async readCar(id: string, signal?: AbortSignal) {
    if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) {
      throw new BadRequestException('Invalid Karma car ID');
    }
    const result = cars(await this.karma.readCar(id, signal));
    if (result.length > 1 || (result[0] && result[0].id !== id)) {
      throw new ServiceUnavailableException('Karma is unavailable; try again later');
    }
    return result[0] ?? null;
  }
}
