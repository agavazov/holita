import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import type {
  MutationCreateCharacteristicGroupArgs,
  MutationUpdateCharacteristicGroupArgs,
  QueryCharacteristicGroupArgs,
  QueryCharacteristicGroupsArgs,
  QueryProductCharacteristicsArgs,
} from '../generated/graphql/types.js';
import type { RequestContext } from '../scope.js';
import { CharacteristicsService } from './characteristics.service.js';

@Resolver()
export class CharacteristicsResolver {
  constructor(private readonly service: CharacteristicsService) {}

  @Query('characteristicGroups')
  groups(@Args() args: QueryCharacteristicGroupsArgs, @Context() context: RequestContext) {
    return this.service.list(context, args);
  }

  @Query('characteristicGroup')
  group(@Args() args: QueryCharacteristicGroupArgs, @Context() context: RequestContext) {
    return this.service.find(context, args.id);
  }

  @Query('productCharacteristics')
  productCharacteristics(
    @Args() args: QueryProductCharacteristicsArgs,
    @Context() context: RequestContext,
  ) {
    return this.service.productCharacteristics(context, args.productId);
  }

  @Mutation('createCharacteristicGroup')
  create(@Args() args: MutationCreateCharacteristicGroupArgs, @Context() context: RequestContext) {
    return this.service.save(context, args.input);
  }

  @Mutation('updateCharacteristicGroup')
  update(@Args() args: MutationUpdateCharacteristicGroupArgs, @Context() context: RequestContext) {
    return this.service.save(context, args.input, args.id);
  }
}
