import { Args, Context, Query, Resolver } from '@nestjs/graphql';
import type {
  QueryKarmaTripsArgs,
  QueryKarmaEventsArgs,
  QueryKarmaDrivingProfileArgs,
  QueryKarmaDailyReportArgs,
  QueryKarmaPositionSamplesArgs,
  QueryKarmaDiagnosticHistoryArgs,
} from '../../generated/graphql/types.js';
import type { RequestContext } from '../../graphql/request-context.js';
import { HistoryService } from './history.service.js';
import { DailyReportService } from './daily-report.service.js';
import { PositionSamplesService } from './position-samples.service.js';
import { DiagnosticHistoryService } from './diagnostic-history.service.js';
@Resolver()
export class HistoryResolver {
  constructor(
    private readonly history: HistoryService,
    private readonly dailyReport: DailyReportService,
    private readonly positions: PositionSamplesService,
    private readonly diagnostics: DiagnosticHistoryService,
  ) {}
  @Query('karmaDiagnosticHistory') diagnosticHistory(
    @Args() args: QueryKarmaDiagnosticHistoryArgs,
    @Context() context: RequestContext,
  ) {
    return this.diagnostics.read(args.input, context);
  }
  @Query('karmaPositionSamples') positionsForWindow(
    @Args() args: QueryKarmaPositionSamplesArgs,
    @Context() context: RequestContext,
  ) {
    return this.positions.read(args.input, context);
  }
  @Query('karmaDailyReport') report(
    @Args() args: QueryKarmaDailyReportArgs,
    @Context() context: RequestContext,
  ) {
    return this.dailyReport.report(args.input, context);
  }
  @Query('karmaTrips') trips(
    @Args() args: QueryKarmaTripsArgs,
    @Context() context: RequestContext,
  ) {
    return this.history.trips(args.input, context);
  }
  @Query('karmaEvents') events(
    @Args() args: QueryKarmaEventsArgs,
    @Context() context: RequestContext,
  ) {
    return this.history.events(args.input, context);
  }
  @Query('karmaDrivingProfile') profile(
    @Args() args: QueryKarmaDrivingProfileArgs,
    @Context() context: RequestContext,
  ) {
    return this.history.profile(args.input, context);
  }
}
