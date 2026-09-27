import { UseGuards } from '@nestjs/common';
import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import type {
  QueryReferenceEventMediaArgs,
  MutationCreateReferenceUploadIntentArgs,
  MutationFinalizeReferenceUploadArgs,
  MutationUpdateReferenceEventMediaArgs,
  MutationDeleteReferenceEventMediaArgs,
  MutationSetReferenceEventCoverArgs,
  MutationReorderReferenceEventMediaArgs,
} from '../generated/graphql/types.js';
import type { RequestContext } from '../graphql/request-context.js';
import { ReferenceEnabledGuard } from '../reference-enabled.guard.js';
import { MediaService } from './media.service.js';

@Resolver()
@UseGuards(ReferenceEnabledGuard)
export class MediaResolver {
  constructor(private readonly media: MediaService) {}
  @Query('referenceEventMedia')
  list(@Args() args: QueryReferenceEventMediaArgs, @Context() context: RequestContext) {
    return this.media.list(context, args.eventId);
  }
  @Mutation('createReferenceUploadIntent')
  createIntent(
    @Args() args: MutationCreateReferenceUploadIntentArgs,
    @Context() context: RequestContext,
  ) {
    return this.media.createIntent(context, args.eventId, args.input);
  }
  @Mutation('finalizeReferenceUpload')
  finalize(@Args() args: MutationFinalizeReferenceUploadArgs, @Context() context: RequestContext) {
    return this.media.finalize(context, args.uploadId);
  }
  @Mutation('updateReferenceEventMedia')
  update(@Args() args: MutationUpdateReferenceEventMediaArgs, @Context() context: RequestContext) {
    return this.media.update(context, args.eventId, args.id, args.input);
  }
  @Mutation('deleteReferenceEventMedia')
  delete(@Args() args: MutationDeleteReferenceEventMediaArgs, @Context() context: RequestContext) {
    return this.media.delete(context, args.eventId, args.id);
  }
  @Mutation('setReferenceEventCover')
  cover(@Args() args: MutationSetReferenceEventCoverArgs, @Context() context: RequestContext) {
    return this.media.cover(context, args.eventId, args.id);
  }
  @Mutation('reorderReferenceEventMedia')
  reorder(
    @Args() args: MutationReorderReferenceEventMediaArgs,
    @Context() context: RequestContext,
  ) {
    return this.media.reorder(context, args.eventId, args.ids);
  }
}
