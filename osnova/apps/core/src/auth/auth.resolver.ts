import { Args, Context, Mutation, Resolver } from '@nestjs/graphql';
import type {
  MutationChangePasswordArgs,
  MutationSignInArgs,
  SignInPayload,
} from '../generated/graphql/types.js';
import type { RequestContext } from '../graphql/request-context.js';
import { AuthService } from './auth.service.js';

@Resolver()
export class AuthResolver {
  constructor(private readonly auth: AuthService) {}

  @Mutation('signIn')
  signIn(@Args() args: MutationSignInArgs): Promise<SignInPayload> {
    return this.auth.signIn(args.email, args.password);
  }

  @Mutation('signOut')
  signOut(@Context() context: RequestContext): Promise<boolean> {
    return this.auth.signOut(context);
  }

  @Mutation('changePassword')
  changePassword(
    @Args() args: MutationChangePasswordArgs,
    @Context() context: RequestContext,
  ): Promise<boolean> {
    return this.auth.changePassword(context, args.currentPassword, args.newPassword);
  }
}
