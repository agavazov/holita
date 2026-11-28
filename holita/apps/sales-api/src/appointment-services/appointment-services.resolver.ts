import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import type {
  MutationCreateAppointmentServiceArgs,
  MutationDeactivateAppointmentServiceArgs,
  MutationUpdateAppointmentServiceArgs,
  QueryAppointmentServiceArgs,
  QueryAppointmentServicesArgs,
} from '../generated/graphql/types.js';
import { requireSalesScope, type RequestContext } from '../scope.js';
import { AppointmentServicesService } from './appointment-services.service.js';

@Resolver()
export class AppointmentServicesResolver {
  constructor(private readonly services: AppointmentServicesService) {}

  @Query()
  async appointmentServices(
    @Context() context: RequestContext,
    @Args() args: QueryAppointmentServicesArgs,
  ) {
    return this.services.list(await requireSalesScope(context), args);
  }

  @Query()
  async appointmentService(
    @Context() context: RequestContext,
    @Args() { id }: QueryAppointmentServiceArgs,
  ) {
    return this.services.find(await requireSalesScope(context), id);
  }

  @Mutation()
  async createAppointmentService(
    @Context() context: RequestContext,
    @Args() { input }: MutationCreateAppointmentServiceArgs,
  ) {
    return this.services.create(await requireSalesScope(context), input);
  }

  @Mutation()
  async updateAppointmentService(
    @Context() context: RequestContext,
    @Args() { id, input }: MutationUpdateAppointmentServiceArgs,
  ) {
    return this.services.update(await requireSalesScope(context), id, input);
  }

  @Mutation()
  async deactivateAppointmentService(
    @Context() context: RequestContext,
    @Args() { id }: MutationDeactivateAppointmentServiceArgs,
  ) {
    return this.services.deactivate(await requireSalesScope(context), id);
  }
}
