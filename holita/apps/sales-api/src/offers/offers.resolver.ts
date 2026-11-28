import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import type {
  MutationCreateSalesOfferArgs,
  MutationTransitionSalesOfferArgs,
  MutationUpdateSalesOfferArgs,
  QuerySalesOfferArgs,
  QuerySalesOffersArgs,
} from '../generated/graphql/types.js';
import { requireSalesScope, type RequestContext } from '../scope.js';
import { OffersService } from './offers.service.js';

@Resolver()
export class OffersResolver {
  constructor(private readonly offers: OffersService) {}

  @Query()
  async salesOffers(@Context() context: RequestContext, @Args() args: QuerySalesOffersArgs) {
    return this.offers.list(await requireSalesScope(context), args);
  }

  @Query()
  async salesOffer(@Context() context: RequestContext, @Args() { id }: QuerySalesOfferArgs) {
    return this.offers.find(await requireSalesScope(context), id);
  }

  @Mutation()
  async createSalesOffer(
    @Context() context: RequestContext,
    @Args() { leadId, input }: MutationCreateSalesOfferArgs,
  ) {
    return this.offers.create(await requireSalesScope(context), leadId ?? null, input);
  }

  @Mutation()
  async updateSalesOffer(
    @Context() context: RequestContext,
    @Args() { id, input }: MutationUpdateSalesOfferArgs,
  ) {
    return this.offers.update(await requireSalesScope(context), id, input);
  }

  @Mutation()
  async transitionSalesOffer(
    @Context() context: RequestContext,
    @Args() { id, action }: MutationTransitionSalesOfferArgs,
  ) {
    return this.offers.transition(await requireSalesScope(context), id, action);
  }
}
