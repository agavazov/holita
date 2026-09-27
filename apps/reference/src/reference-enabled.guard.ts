import { Injectable, ServiceUnavailableException, type CanActivate } from '@nestjs/common';

@Injectable()
export class ReferenceEnabledGuard implements CanActivate {
  private readonly enabled: boolean;

  constructor() {
    const value = process.env.REFERENCE_ENABLED ?? 'true';
    if (value !== 'true' && value !== 'false')
      throw new Error('REFERENCE_ENABLED must be true or false');
    this.enabled = value === 'true';
  }

  canActivate(): boolean {
    if (!this.enabled) throw new ServiceUnavailableException('Reference is disabled');
    return true;
  }
}
