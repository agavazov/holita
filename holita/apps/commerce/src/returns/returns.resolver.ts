import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import type {
  MutationDecideOrderReturnArgs,
  QueryOrderReturnArgs,
  QueryOrderReturnsArgs,
} from '../generated/graphql/types.js';
import type { RequestContext } from '../scope.js';
import { ReturnsService } from './returns.service.js';

@Resolver()
export class ReturnsResolver {
  constructor(private readonly returns: ReturnsService) {}

  @Query('orderReturns')
  list(@Args() args: QueryOrderReturnsArgs, @Context() context: RequestContext) {
    return this.returns.list(context, args);
  }

  @Query('orderReturn')
  find(@Args() { id }: QueryOrderReturnArgs, @Context() context: RequestContext) {
    return this.returns.find(context, id);
  }

  @Mutation('decideOrderReturn')
  decide(@Args() args: MutationDecideOrderReturnArgs, @Context() context: RequestContext) {
    return this.returns.decide(context, args);
  }
}
