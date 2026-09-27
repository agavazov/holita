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
  MutationCreateReferenceEventArgs,
  MutationRestoreReferenceEventArgs,
  MutationSetReferenceEventsStatusArgs,
  MutationTrashReferenceEventsArgs,
  MutationRestoreReferenceEventsArgs,
  QueryReferenceEventHistoryArgs,
  MutationDeleteReferenceEventArgs,
  MutationUpdateReferenceEventArgs,
  ReferenceEvent,
  QueryReferenceEventArgs,
  QueryReferenceEventsArgs,
  Store,
} from '../generated/graphql/types.js';
import type { RequestContext } from '../graphql/request-context.js';
import { EventsService, type EventResult } from './events.service.js';

@Resolver('ReferenceEvent')
@UseGuards(ReferenceEnabledGuard)
export class EventsResolver {
  constructor(private readonly eventsService: EventsService) {}

  @Query('referenceEvents')
  referenceEvents(@Args() args: QueryReferenceEventsArgs, @Context() context: RequestContext) {
    return this.eventsService.list(context, args);
  }

  @Query('referenceEvent')
  referenceEvent(@Args() args: QueryReferenceEventArgs, @Context() context: RequestContext) {
    return this.eventsService.find(context, args.id, args.includeDeleted);
  }

  @Mutation('createReferenceEvent')
  createReferenceEvent(
    @Args() args: MutationCreateReferenceEventArgs,
    @Context() context: RequestContext,
  ) {
    return this.eventsService.create(context, args.input);
  }

  @Mutation('updateReferenceEvent')
  updateReferenceEvent(
    @Args() args: MutationUpdateReferenceEventArgs,
    @Context() context: RequestContext,
  ) {
    return this.eventsService.update(context, args.id, args.input);
  }

  @Mutation('deleteReferenceEvent')
  deleteReferenceEvent(
    @Args() args: MutationDeleteReferenceEventArgs,
    @Context() context: RequestContext,
  ) {
    return this.eventsService.delete(context, args.id);
  }

  @Query('referenceEventHistory')
  referenceEventHistory(
    @Args() args: QueryReferenceEventHistoryArgs,
    @Context() context: RequestContext,
  ) {
    return this.eventsService.historyPage(context, args);
  }
  @Mutation('restoreReferenceEvent')
  restoreReferenceEvent(
    @Args() args: MutationRestoreReferenceEventArgs,
    @Context() context: RequestContext,
  ) {
    return this.eventsService.restore(context, args.id);
  }
  @Mutation('setReferenceEventsStatus')
  setReferenceEventsStatus(
    @Args() args: MutationSetReferenceEventsStatusArgs,
    @Context() context: RequestContext,
  ) {
    return this.eventsService.bulk(context, args.ids, args.status);
  }
  @Mutation('trashReferenceEvents')
  trashReferenceEvents(
    @Args() args: MutationTrashReferenceEventsArgs,
    @Context() context: RequestContext,
  ) {
    return this.eventsService.bulk(context, args.ids, 'trash');
  }
  @Mutation('restoreReferenceEvents')
  restoreReferenceEvents(
    @Args() args: MutationRestoreReferenceEventsArgs,
    @Context() context: RequestContext,
  ) {
    return this.eventsService.bulk(context, args.ids, 'restore');
  }

  @ResolveReference()
  resolveReference(
    @Parent() reference: Pick<ReferenceEvent, 'id'>,
    @Context() context: RequestContext,
  ) {
    return this.eventsService.find(context, reference.id);
  }

  @ResolveField('store')
  store(@Parent() event: EventResult): Store {
    return { __typename: 'Store', id: event.storeId };
  }
}
