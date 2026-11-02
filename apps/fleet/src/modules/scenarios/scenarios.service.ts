import { Injectable, NotFoundException } from '@nestjs/common';
import { FleetClock } from '../../clock/fleet-clock.js';
import type { FleetScenario } from '../../generated/graphql/types.js';
import type { RequestContext } from '../../graphql/request-context.js';
import { CoreClient } from '../../integrations/core/core.client.js';
import { requireScope } from '../../validation.js';
import { operationalScenario, operationalScenarioId } from './scenario-data.js';

@Injectable()
export class ScenariosService {
  constructor(
    private readonly core: CoreClient,
    private readonly clock: FleetClock,
  ) {}

  async find(context: RequestContext, id: string): Promise<FleetScenario> {
    const scope = requireScope(context);
    // Static examples have no persisted scoped row to establish Branch ownership.
    await this.core.requireBranch(scope.branchId, context);
    if (id !== operationalScenarioId) {
      throw new NotFoundException('Scenario not found');
    }
    return operationalScenario(scope, this.clock.now());
  }
}
