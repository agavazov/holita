import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { demoAuthEnabled, issueDemoToken } from '../../auth/demo-auth.js';
import { TenantsRepository } from './tenants.repository.js';

@Injectable()
export class TenantsService {
  constructor(private readonly tenants: TenantsRepository) {}
  list() {
    if (!demoAuthEnabled()) {
      throw new UnauthorizedException('Demo login is disabled');
    }
    return this.tenants.list();
  }
  async login(tenantId: string) {
    if (!demoAuthEnabled()) {
      throw new UnauthorizedException('Demo login is disabled');
    }
    if (!isUUID(tenantId)) {
      throw new BadRequestException('Tenant ID must be a UUID');
    }
    const tenant = await this.tenants.find(tenantId.toLowerCase());
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    return { tenant, token: issueDemoToken(tenant.id) };
  }
}
