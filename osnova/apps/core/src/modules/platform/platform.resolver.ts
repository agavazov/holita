import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import type {
  MutationCreateMerchantArgs,
  MutationCreateMerchantBranchArgs,
  MutationSetMerchantStatusArgs,
  MutationSetMerchantBranchStatusArgs,
  QueryMerchantArgs,
  QueryMerchantsArgs,
} from '../../generated/graphql/types.js';
import type { RequestContext } from '../../graphql/request-context.js';
import { PlatformService } from './platform.service.js';

@Resolver()
export class PlatformResolver {
  constructor(private readonly platform: PlatformService) {}

  @Query('merchants')
  list(@Args() args: QueryMerchantsArgs, @Context() context: RequestContext) {
    return this.platform.list(context, args.offset, args.limit);
  }

  @Query('merchant')
  find(@Args() args: QueryMerchantArgs, @Context() context: RequestContext) {
    return this.platform.find(context, args.tenantId);
  }

  @Mutation('createMerchant')
  create(@Args() args: MutationCreateMerchantArgs, @Context() context: RequestContext) {
    return this.platform.create(
      context,
      args.name,
      args.adminName,
      args.adminEmail,
      args.initialPassword,
    );
  }

  @Mutation('createMerchantBranch')
  createBranch(@Args() args: MutationCreateMerchantBranchArgs, @Context() context: RequestContext) {
    return this.platform.createBranch(context, args.tenantId, args.name);
  }

  @Mutation('setMerchantStatus')
  setStatus(@Args() args: MutationSetMerchantStatusArgs, @Context() context: RequestContext) {
    return this.platform.setStatus(context, args.tenantId, args.status);
  }

  @Mutation('setMerchantBranchStatus')
  setBranchStatus(
    @Args() args: MutationSetMerchantBranchStatusArgs,
    @Context() context: RequestContext,
  ) {
    return this.platform.setBranchStatus(context, args.tenantId, args.branchId, args.status);
  }
}
