import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import type {
  MutationCreateOptionArgs,
  MutationUpdateOptionArgs,
  QueryOptionArgs,
  QueryOptionsArgs,
} from '../generated/graphql/types.js';
import type { RequestContext } from '../scope.js';
import { OptionsService } from './options.service.js';

@Resolver()
export class OptionsResolver {
  constructor(private readonly service: OptionsService) {}

  @Query('options')
  options(@Args() args: QueryOptionsArgs, @Context() context: RequestContext) {
    return this.service.list(context, args);
  }

  @Query('option')
  option(@Args() args: QueryOptionArgs, @Context() context: RequestContext) {
    return this.service.find(context, args.id);
  }

  @Query('productOptions')
  productOptions(@Context() context: RequestContext) {
    return this.service.productOptions(context);
  }

  @Mutation('createOption')
  create(@Args() args: MutationCreateOptionArgs, @Context() context: RequestContext) {
    return this.service.save(context, args.input);
  }

  @Mutation('updateOption')
  update(@Args() args: MutationUpdateOptionArgs, @Context() context: RequestContext) {
    return this.service.save(context, args.input, args.id);
  }
}
