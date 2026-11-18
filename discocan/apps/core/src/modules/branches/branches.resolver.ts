import {
  Args,
  Context,
  Mutation,
  Parent,
  Query,
  ResolveReference,
  Resolver,
} from '@nestjs/graphql';
import type {
  QueryBranchArgs,
  MutationUpdateBranchNameArgs,
  Branch,
} from '../../generated/graphql/types.js';
import type { RequestContext } from '../../graphql/request-context.js';
import { BranchesService } from './branches.service.js';

@Resolver('Branch')
export class BranchesResolver {
  constructor(private readonly branchesService: BranchesService) {}

  @Query('branches')
  branches(@Context() context: RequestContext): Promise<Branch[]> {
    return this.branchesService.list(context);
  }

  @Query('branch')
  branch(
    @Args() args: QueryBranchArgs,
    @Context() context: RequestContext,
  ): Promise<Branch | null> {
    return this.branchesService.find(context, args.id);
  }

  @Mutation('updateBranchName')
  updateName(
    @Args() args: MutationUpdateBranchNameArgs,
    @Context() context: RequestContext,
  ): Promise<Branch> {
    return this.branchesService.updateName(context, args.id, args.name);
  }

  @ResolveReference()
  resolveReference(
    @Parent() reference: Pick<Branch, 'id'>,
    @Context() context: RequestContext,
  ): Promise<Branch | null> {
    return this.branchesService.find(context, reference.id);
  }
}
