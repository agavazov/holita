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
  MutationCreateReferenceVenueArgs,
  MutationDeleteReferenceVenueArgs,
  MutationUpdateReferenceVenueArgs,
  ReferenceVenue,
  QueryReferenceVenueArgs,
  QueryReferenceVenuesArgs,
  Store,
} from '../generated/graphql/types.js';
import type { RequestContext } from '../graphql/request-context.js';
import { VenuesService, type VenueResult } from './venues.service.js';

@Resolver('ReferenceVenue')
@UseGuards(ReferenceEnabledGuard)
export class VenuesResolver {
  constructor(private readonly venuesService: VenuesService) {}

  @Query('referenceVenues')
  referenceVenues(@Args() args: QueryReferenceVenuesArgs, @Context() context: RequestContext) {
    return this.venuesService.list(context, args);
  }

  @Query('referenceVenue')
  referenceVenue(@Args() args: QueryReferenceVenueArgs, @Context() context: RequestContext) {
    return this.venuesService.find(context, args.id);
  }

  @Mutation('createReferenceVenue')
  createReferenceVenue(
    @Args() args: MutationCreateReferenceVenueArgs,
    @Context() context: RequestContext,
  ) {
    return this.venuesService.create(context, args.input);
  }

  @Mutation('updateReferenceVenue')
  updateReferenceVenue(
    @Args() args: MutationUpdateReferenceVenueArgs,
    @Context() context: RequestContext,
  ) {
    return this.venuesService.update(context, args.id, args.input);
  }

  @Mutation('deleteReferenceVenue')
  deleteReferenceVenue(
    @Args() args: MutationDeleteReferenceVenueArgs,
    @Context() context: RequestContext,
  ) {
    return this.venuesService.delete(context, args.id);
  }

  @ResolveReference()
  resolveReference(
    @Parent() reference: Pick<ReferenceVenue, 'id'>,
    @Context() context: RequestContext,
  ) {
    return this.venuesService.find(context, reference.id);
  }

  @ResolveField('store')
  store(@Parent() venue: VenueResult): Store {
    return { __typename: 'Store', id: venue.storeId };
  }
}
