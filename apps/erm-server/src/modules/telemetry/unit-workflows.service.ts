import { ConflictException, Injectable } from '@nestjs/common';

/** A configuration workflow owns its unit through every read, write and verification step. */
@Injectable()
export class UnitWorkflowsService {
  private readonly units = new Set<string>();

  acquire(unitId: string): void {
    if (this.units.has(unitId)) {
      throw new ConflictException('A unit workflow is already running');
    }
    this.units.add(unitId);
  }

  release(unitId: string): void {
    this.units.delete(unitId);
  }
}
