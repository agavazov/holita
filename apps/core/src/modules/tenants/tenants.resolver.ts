import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { MutationDemoLoginArgs, DemoSession, Tenant } from '../../generated/graphql/types.js';
import { TenantsService } from './tenants.service.js';

@Resolver()
export class TenantsResolver {
  constructor(private readonly tenants: TenantsService) {}
  @Query('tenants')
  list(): Promise<Tenant[]> {
    return this.tenants.list();
  }
  @Mutation('demoLogin')
  login(@Args() args: MutationDemoLoginArgs): Promise<DemoSession> {
    return this.tenants.login(args.tenantId);
  }
}
