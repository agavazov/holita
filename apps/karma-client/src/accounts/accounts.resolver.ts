import { Context, Query, Resolver } from '@nestjs/graphql';
import type { RequestContext } from '../graphql/request-context.js';
import { AccountsService } from './accounts.service.js';

@Resolver()
export class AccountsResolver {
  constructor(private readonly service: AccountsService) {}
  @Query('karmaUsers')
  karmaUsers(@Context() context: RequestContext) {
    return this.service.users(context);
  }
  @Query('karmaRoles')
  karmaRoles(@Context() context: RequestContext) {
    return this.service.roles(context);
  }
}
