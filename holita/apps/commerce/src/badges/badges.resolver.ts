import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import type {
  MutationCreateProductBadgeArgs,
  MutationUpdateProductBadgeArgs,
  QueryProductBadgeArgs,
  QueryProductBadgesArgs,
} from '../generated/graphql/types.js';
import type { RequestContext } from '../scope.js';
import { BadgesService } from './badges.service.js';

@Resolver()
export class BadgesResolver {
  constructor(private readonly service: BadgesService) {}

  @Query('productBadges')
  productBadges(@Args() args: QueryProductBadgesArgs, @Context() context: RequestContext) {
    return this.service.list(context, args);
  }

  @Query('productBadgeChoices')
  productBadgeChoices(@Context() context: RequestContext) {
    return this.service.choices(context);
  }

  @Query('productBadge')
  productBadge(@Args() args: QueryProductBadgeArgs, @Context() context: RequestContext) {
    return this.service.find(context, args.id);
  }

  @Mutation('createProductBadge')
  create(@Args() args: MutationCreateProductBadgeArgs, @Context() context: RequestContext) {
    return this.service.save(context, args.input);
  }

  @Mutation('updateProductBadge')
  update(@Args() args: MutationUpdateProductBadgeArgs, @Context() context: RequestContext) {
    return this.service.save(context, args.input, args.id);
  }
}
