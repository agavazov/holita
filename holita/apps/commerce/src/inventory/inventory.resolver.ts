import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import type {
  MutationUpdateInventoryQuantityArgs,
  QueryInventoryArgs,
  QueryInventoryVariantArgs,
} from '../generated/graphql/types.js';
import type { RequestContext } from '../scope.js';
import { InventoryService } from './inventory.service.js';

@Resolver()
export class InventoryResolver {
  constructor(private readonly service: InventoryService) {}

  @Query('inventory')
  inventory(@Args() args: QueryInventoryArgs, @Context() context: RequestContext) {
    return this.service.list(context, args);
  }

  @Query('inventoryVariant')
  variant(@Args() args: QueryInventoryVariantArgs, @Context() context: RequestContext) {
    return this.service.find(context, args.id);
  }

  @Mutation('updateInventoryQuantity')
  updateQuantity(
    @Args() args: MutationUpdateInventoryQuantityArgs,
    @Context() context: RequestContext,
  ) {
    return this.service.updateQuantity(context, args.id, args.quantity);
  }
}
