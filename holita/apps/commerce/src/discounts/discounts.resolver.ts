import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import type {
  MutationCreateDiscountArgs,
  MutationUpdateDiscountArgs,
  QueryDiscountArgs,
  QueryDiscountsArgs,
} from '../generated/graphql/types.js';
import type { RequestContext } from '../scope.js';
import { DiscountsService } from './discounts.service.js';

@Resolver()
export class DiscountsResolver {
  constructor(private readonly discounts: DiscountsService) {}

  @Query('discounts')
  list(@Args() args: QueryDiscountsArgs, @Context() context: RequestContext) {
    return this.discounts.list(context, args);
  }

  @Query('discount')
  detail(@Args() { id }: QueryDiscountArgs, @Context() context: RequestContext) {
    return this.discounts.find(context, id);
  }

  @Mutation('createDiscount')
  create(@Args() { input }: MutationCreateDiscountArgs, @Context() context: RequestContext) {
    return this.discounts.save(context, input);
  }

  @Mutation('updateDiscount')
  update(@Args() { id, input }: MutationUpdateDiscountArgs, @Context() context: RequestContext) {
    return this.discounts.save(context, input, id);
  }
}
