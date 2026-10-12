import { Args, Context, Query, Resolver } from '@nestjs/graphql';
import type { QueryKarmaEdataArgs } from '../generated/graphql/types.js';
import type { RequestContext } from '../graphql/request-context.js';
import { EdataService } from './edata.service.js';

@Resolver('KarmaEdataPage')
export class EdataResolver {
  constructor(private readonly edata: EdataService) {}

  @Query('karmaEdata')
  karmaEdata(@Args() args: QueryKarmaEdataArgs, @Context() context: RequestContext) {
    return this.edata.list(args.input, context);
  }
}
