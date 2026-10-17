import { Args, Context, Query, Resolver } from '@nestjs/graphql';
import type { QueryKarmaCarArgs } from '../../generated/graphql/types.js';
import type { RequestContext } from '../../graphql/request-context.js';
import { CarsService } from './cars.service.js';

@Resolver('KarmaCar')
export class CarsResolver {
  constructor(private readonly cars: CarsService) {}

  @Query('karmaCars')
  karmaCars(@Context() context: RequestContext) {
    return this.cars.list(context);
  }

  @Query('karmaCar')
  karmaCar(@Args() args: QueryKarmaCarArgs, @Context() context: RequestContext) {
    return this.cars.find(args.id, context);
  }
}
