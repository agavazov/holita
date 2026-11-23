import { Context, Query, Resolver } from '@nestjs/graphql';
import type { SalesWorkspaceViewer } from '../generated/graphql/types.js';
import { requireSalesScope, type RequestContext } from '../scope.js';
import { WorkspaceService } from './workspace.service.js';

@Resolver()
export class WorkspaceResolver {
  constructor(private readonly workspace: WorkspaceService) {}

  @Query()
  async salesWorkspaceAccess(@Context() context: RequestContext): Promise<SalesWorkspaceViewer> {
    return this.workspace.viewer(await requireSalesScope(context));
  }
}
