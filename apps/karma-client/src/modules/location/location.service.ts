import { BadRequestException, Injectable } from '@nestjs/common';
import { KarmaTransport } from '../../integrations/karma/karma-transport.js';
import { CarsService } from '../cars/cars.service.js';
import { location } from './location-response.js';
import { requireTenant } from '../../auth/demo-auth.js';
import type { RequestContext } from '../../graphql/request-context.js';

@Injectable()
export class LocationService {
  constructor(
    private readonly karma: KarmaTransport,
    private readonly cars: CarsService,
  ) {}

  find(carId: string, context: RequestContext) {
    requireTenant(context);
    return this.readLocation(carId, context);
  }

  private async readLocation(carId: string, context: RequestContext) {
    if (!/^[1-9]\d*$/.test(carId) || !Number.isSafeInteger(Number(carId))) {
      throw new BadRequestException('Invalid Karma car ID');
    }
    const signal = AbortSignal.timeout(4000);
    const car = await this.cars.find(carId, context, signal);
    if (!car) {
      return null;
    }
    const parameters = new URLSearchParams({ car: carId });
    for (const field of ['spd', 'odo', 'edt_tz', 'pdt']) {
      parameters.append('fields[]', field);
    }
    return location(await this.karma.read('location', parameters, signal), carId);
  }
}
