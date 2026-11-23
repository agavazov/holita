import { Injectable } from '@nestjs/common';
import type { SalesWorkspaceViewer } from '../generated/graphql/types.js';
import type { SalesScope } from '../scope.js';

@Injectable()
export class WorkspaceService {
  viewer({ tenantId, userId }: SalesScope): SalesWorkspaceViewer {
    return { tenantId, userId };
  }
}
