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
  MutationCreateReferenceSpeakerArgs,
  MutationDeleteReferenceSpeakerArgs,
  MutationUpdateReferenceSpeakerArgs,
  ReferenceSpeaker,
  QueryReferenceSpeakerArgs,
  QueryReferenceSpeakersArgs,
  Store,
} from '../generated/graphql/types.js';
import type { RequestContext } from '../graphql/request-context.js';
import { SpeakersService, type SpeakerResult } from './speakers.service.js';

@Resolver('ReferenceSpeaker')
@UseGuards(ReferenceEnabledGuard)
export class SpeakersResolver {
  constructor(private readonly speakersService: SpeakersService) {}

  @Query('referenceSpeakers')
  referenceSpeakers(@Args() args: QueryReferenceSpeakersArgs, @Context() context: RequestContext) {
    return this.speakersService.list(context, args);
  }

  @Query('referenceSpeaker')
  referenceSpeaker(@Args() args: QueryReferenceSpeakerArgs, @Context() context: RequestContext) {
    return this.speakersService.find(context, args.id);
  }

  @Mutation('createReferenceSpeaker')
  createReferenceSpeaker(
    @Args() args: MutationCreateReferenceSpeakerArgs,
    @Context() context: RequestContext,
  ) {
    return this.speakersService.create(context, args.input);
  }

  @Mutation('updateReferenceSpeaker')
  updateReferenceSpeaker(
    @Args() args: MutationUpdateReferenceSpeakerArgs,
    @Context() context: RequestContext,
  ) {
    return this.speakersService.update(context, args.id, args.input);
  }

  @Mutation('deleteReferenceSpeaker')
  deleteReferenceSpeaker(
    @Args() args: MutationDeleteReferenceSpeakerArgs,
    @Context() context: RequestContext,
  ) {
    return this.speakersService.delete(context, args.id);
  }

  @ResolveReference()
  resolveReference(
    @Parent() reference: Pick<ReferenceSpeaker, 'id'>,
    @Context() context: RequestContext,
  ) {
    return this.speakersService.find(context, reference.id);
  }

  @ResolveField('store')
  store(@Parent() speaker: SpeakerResult): Store {
    return { __typename: 'Store', id: speaker.storeId };
  }
}
