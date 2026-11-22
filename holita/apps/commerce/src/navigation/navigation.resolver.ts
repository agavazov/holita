import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import type {
  MutationCreateNavigationMenuArgs,
  MutationUpdateNavigationMenuArgs,
  QueryNavigationDestinationChoicesArgs,
  QueryNavigationMenuArgs,
} from '../generated/graphql/types.js';
import type { RequestContext } from '../scope.js';
import { NavigationService } from './navigation.service.js';

@Resolver()
export class NavigationResolver {
  constructor(private readonly service: NavigationService) {}

  @Query('navigationMenus')
  menus(@Context() context: RequestContext) {
    return this.service.list(context);
  }

  @Query('navigationMenu')
  menu(@Args() args: QueryNavigationMenuArgs, @Context() context: RequestContext) {
    return this.service.find(context, args.id);
  }

  @Query('navigationDestinationChoices')
  choices(@Args() args: QueryNavigationDestinationChoicesArgs, @Context() context: RequestContext) {
    return this.service.choices(context, args);
  }

  @Mutation('createNavigationMenu')
  create(@Args() { input }: MutationCreateNavigationMenuArgs, @Context() context: RequestContext) {
    return this.service.save(context, { placement: input.placement }, input.items);
  }

  @Mutation('updateNavigationMenu')
  update(@Args() args: MutationUpdateNavigationMenuArgs, @Context() context: RequestContext) {
    return this.service.save(context, { id: args.id }, args.items);
  }
}
