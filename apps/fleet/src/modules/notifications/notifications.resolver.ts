import { UseGuards } from '@nestjs/common';
import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FleetEnabledGuard } from '../../fleet-enabled.guard.js';
import type {
  MutationMarkNotificationReadArgs,
  QueryNotificationsArgs,
} from '../../generated/graphql/types.js';
import type { RequestContext } from '../../graphql/request-context.js';
import { NotificationsService } from './notifications.service.js';

@Resolver('FleetNotification')
@UseGuards(FleetEnabledGuard)
export class NotificationsResolver {
  constructor(private readonly notifications: NotificationsService) {}

  @Query('notifications')
  notificationsFeed(@Args() args: QueryNotificationsArgs, @Context() context: RequestContext) {
    return this.notifications.list(context, args);
  }

  @Mutation('markNotificationRead')
  markNotificationRead(
    @Args() args: MutationMarkNotificationReadArgs,
    @Context() context: RequestContext,
  ) {
    return this.notifications.markRead(context, args.id);
  }

  @Mutation('markAllNotificationsRead')
  markAllNotificationsRead(@Context() context: RequestContext) {
    return this.notifications.markAllRead(context);
  }
}
