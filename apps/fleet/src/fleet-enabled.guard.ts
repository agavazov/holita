import { Injectable, ServiceUnavailableException, type CanActivate } from '@nestjs/common';

@Injectable()
export class FleetEnabledGuard implements CanActivate {
  private readonly enabled: boolean;

  constructor() {
    const value = process.env.FLEET_ENABLED ?? 'true';
    if (value !== 'true' && value !== 'false') {
      throw new Error('FLEET_ENABLED must be true or false');
    }
    this.enabled = value === 'true';
  }

  canActivate(): boolean {
    if (!this.enabled) {
      throw new ServiceUnavailableException('Fleet is disabled');
    }
    return true;
  }
}
