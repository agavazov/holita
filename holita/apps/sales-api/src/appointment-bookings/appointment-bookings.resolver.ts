import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import type {
  MutationCreateAppointmentBookingArgs,
  MutationRescheduleAppointmentBookingArgs,
  MutationUpdateAppointmentBookingStatusArgs,
  QueryAppointmentBookingArgs,
  QueryAppointmentSlotsArgs,
} from '../generated/graphql/types.js';
import { requireSalesScope, type RequestContext } from '../scope.js';
import { AppointmentBookingsService } from './appointment-bookings.service.js';

@Resolver()
export class AppointmentBookingsResolver {
  constructor(private readonly bookings: AppointmentBookingsService) {}

  @Query()
  async appointmentSlots(
    @Context() context: RequestContext,
    @Args() args: QueryAppointmentSlotsArgs,
  ) {
    return this.bookings.slots(await requireSalesScope(context), args);
  }

  @Query()
  async appointmentBooking(
    @Context() context: RequestContext,
    @Args() { id }: QueryAppointmentBookingArgs,
  ) {
    return this.bookings.find(await requireSalesScope(context), id);
  }

  @Mutation()
  async createAppointmentBooking(
    @Context() context: RequestContext,
    @Args() { input }: MutationCreateAppointmentBookingArgs,
  ) {
    return this.bookings.create(await requireSalesScope(context), input);
  }

  @Mutation()
  async rescheduleAppointmentBooking(
    @Context() context: RequestContext,
    @Args() { id, input }: MutationRescheduleAppointmentBookingArgs,
  ) {
    return this.bookings.reschedule(await requireSalesScope(context), id, input);
  }

  @Mutation()
  async updateAppointmentBookingStatus(
    @Context() context: RequestContext,
    @Args() { id, status }: MutationUpdateAppointmentBookingStatusArgs,
  ) {
    return this.bookings.updateStatus(await requireSalesScope(context), id, status);
  }
}
