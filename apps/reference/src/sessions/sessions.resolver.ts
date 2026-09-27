import { UseGuards } from '@nestjs/common';
import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import type {
  QueryReferenceSessionsArgs,
  QueryReferenceSessionArgs,
  MutationCreateReferenceSessionArgs,
  MutationUpdateReferenceSessionArgs,
  MutationDeleteReferenceSessionArgs,
  MutationReorderReferenceSessionsArgs,
} from '../generated/graphql/types.js';
import type { RequestContext } from '../graphql/request-context.js';
import { ReferenceEnabledGuard } from '../reference-enabled.guard.js';
import { SessionsService } from './sessions.service.js';

@Resolver('ReferenceSession')
@UseGuards(ReferenceEnabledGuard)
export class SessionsResolver {
  constructor(private readonly sessions: SessionsService) {}
  @Query('referenceSessions')
  list(@Args() args: QueryReferenceSessionsArgs, @Context() context: RequestContext) {
    return this.sessions.list(context, args.eventId);
  }
  @Query('referenceSession')
  find(@Args() args: QueryReferenceSessionArgs, @Context() context: RequestContext) {
    return this.sessions.find(context, args.eventId, args.id);
  }
  @Mutation('createReferenceSession')
  create(@Args() args: MutationCreateReferenceSessionArgs, @Context() context: RequestContext) {
    return this.sessions.create(context, args.eventId, args.input);
  }
  @Mutation('updateReferenceSession')
  update(@Args() args: MutationUpdateReferenceSessionArgs, @Context() context: RequestContext) {
    return this.sessions.update(context, args.eventId, args.id, args.input);
  }
  @Mutation('deleteReferenceSession')
  delete(@Args() args: MutationDeleteReferenceSessionArgs, @Context() context: RequestContext) {
    return this.sessions.delete(context, args.eventId, args.id);
  }
  @Mutation('reorderReferenceSessions')
  reorder(@Args() args: MutationReorderReferenceSessionsArgs, @Context() context: RequestContext) {
    return this.sessions.reorder(context, args.eventId, args.ids);
  }
}
