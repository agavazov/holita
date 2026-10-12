import { Context, Query, Resolver } from '@nestjs/graphql';
import type { RequestContext } from '../graphql/request-context.js';
import { ReferencesService } from './references.service.js';

@Resolver()
export class ReferencesResolver {
  constructor(private readonly service: ReferencesService) {}

  @Query('karmaProjects')
  karmaProjects(@Context() context: RequestContext) {
    return this.service.projects(context);
  }

  @Query('karmaTimeZones')
  karmaTimeZones(@Context() context: RequestContext) {
    return this.service.timeZones(context);
  }

  @Query('karmaVersion')
  karmaVersion(@Context() context: RequestContext) {
    return this.service.version(context);
  }
}
