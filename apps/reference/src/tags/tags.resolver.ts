import { UseGuards } from '@nestjs/common';
import { ReferenceEnabledGuard } from '../reference-enabled.guard.js';
import {
  Args,
  Context,
  Mutation,
  Parent,
  Query,
  ResolveField,
  ResolveReference,
  Resolver,
} from '@nestjs/graphql';
import type {
  MutationCreateReferenceTagArgs,
  MutationDeleteReferenceTagArgs,
  MutationUpdateReferenceTagArgs,
  ReferenceTag,
  QueryReferenceTagArgs,
  QueryReferenceTagsArgs,
  Store,
} from '../generated/graphql/types.js';
import type { RequestContext } from '../graphql/request-context.js';
import { TagsService, type TagResult } from './tags.service.js';

@Resolver('ReferenceTag')
@UseGuards(ReferenceEnabledGuard)
export class TagsResolver {
  constructor(private readonly tagsService: TagsService) {}

  @Query('referenceTags')
  referenceTags(@Args() args: QueryReferenceTagsArgs, @Context() context: RequestContext) {
    return this.tagsService.list(context, args);
  }

  @Query('referenceTag')
  referenceTag(@Args() args: QueryReferenceTagArgs, @Context() context: RequestContext) {
    return this.tagsService.find(context, args.id);
  }

  @Mutation('createReferenceTag')
  createReferenceTag(
    @Args() args: MutationCreateReferenceTagArgs,
    @Context() context: RequestContext,
  ) {
    return this.tagsService.create(context, args.input);
  }

  @Mutation('updateReferenceTag')
  updateReferenceTag(
    @Args() args: MutationUpdateReferenceTagArgs,
    @Context() context: RequestContext,
  ) {
    return this.tagsService.update(context, args.id, args.input);
  }

  @Mutation('deleteReferenceTag')
  deleteReferenceTag(
    @Args() args: MutationDeleteReferenceTagArgs,
    @Context() context: RequestContext,
  ) {
    return this.tagsService.delete(context, args.id);
  }

  @ResolveReference()
  resolveReference(
    @Parent() reference: Pick<ReferenceTag, 'id'>,
    @Context() context: RequestContext,
  ) {
    return this.tagsService.find(context, reference.id);
  }

  @ResolveField('store')
  store(@Parent() tag: TagResult): Store {
    return { __typename: 'Store', id: tag.storeId };
  }
}
