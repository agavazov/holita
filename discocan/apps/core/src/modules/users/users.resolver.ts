import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import type {
  MutationCreateUserArgs,
  MutationDeactivateUserArgs,
  MutationReactivateUserArgs,
  MutationUpdateProfileArgs,
  MutationUpdateUserArgs,
  User,
} from '../../generated/graphql/types.js';
import type { RequestContext } from '../../graphql/request-context.js';
import { UsersService } from './users.service.js';

@Resolver('User')
export class UsersResolver {
  constructor(private readonly users: UsersService) {}

  @Query('users')
  list(@Context() context: RequestContext): Promise<User[]> {
    return this.users.list(context);
  }

  @Query('me')
  me(@Context() context: RequestContext): Promise<User> {
    return this.users.me(context);
  }

  @Mutation('createUser')
  create(@Args() args: MutationCreateUserArgs, @Context() context: RequestContext): Promise<User> {
    return this.users.create(context, args.name, args.email, args.password, args.role);
  }

  @Mutation('updateUser')
  update(@Args() args: MutationUpdateUserArgs, @Context() context: RequestContext): Promise<User> {
    return this.users.update(context, args.id, args.name, args.email, args.role);
  }

  @Mutation('updateProfile')
  updateProfile(
    @Args() args: MutationUpdateProfileArgs,
    @Context() context: RequestContext,
  ): Promise<User> {
    return this.users.updateProfile(context, args.name, args.email);
  }

  @Mutation('deactivateUser')
  deactivate(
    @Args() args: MutationDeactivateUserArgs,
    @Context() context: RequestContext,
  ): Promise<User> {
    return this.users.setActive(context, args.id, false);
  }

  @Mutation('reactivateUser')
  reactivate(
    @Args() args: MutationReactivateUserArgs,
    @Context() context: RequestContext,
  ): Promise<User> {
    return this.users.setActive(context, args.id, true);
  }
}
