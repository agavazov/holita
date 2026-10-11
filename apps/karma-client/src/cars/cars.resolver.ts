import { Context, Query, Resolver } from '@nestjs/graphql';
import type { RequestContext } from '../graphql/request-context.js';
import { CarsService } from './cars.service.js';

@Resolver('KarmaCar')
export class CarsResolver {
  constructor(private readonly cars: CarsService) {}

  @Query('karmaCars')
  karmaCars(@Context() context: RequestContext) {
    return this.cars.list(context);
  }
}
