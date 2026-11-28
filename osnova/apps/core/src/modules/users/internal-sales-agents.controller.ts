import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Header,
  Headers,
  HttpCode,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { AuthService } from '../../auth/auth.service.js';
import { requireInternalToken } from '../../auth/internal-token.js';
import { UsersRepository } from './users.repository.js';

function isUserId(value: unknown): value is string {
  return typeof value === 'string' && isUUID(value);
}

function userIds(value: unknown): string[] | undefined {
  if (Array.isArray(value) && value.length <= 101 && value.every(isUserId)) {
    return value.map((id) => id.toLowerCase());
  }
  return undefined;
}

@Controller('internal/sales-agents')
export class InternalSalesAgentsController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersRepository,
  ) {}

  @Post('lookup')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async lookup(
    @Headers('x-core-internal-token') internalToken: string | undefined,
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    requireInternalToken(internalToken);
    const identity = await this.auth.verifyAuthorization(authorization);
    if (!identity) {
      throw new UnauthorizedException('Sign in first');
    }
    if (!identity.platform || identity.role !== 'SALES') {
      throw new ForbiddenException('A platform Sales account is required');
    }
    const lookup = this.lookupInput(body);
    const users = await this.users.salesAgents(identity.tenantId, lookup);
    return users.map(({ id, name, active, role }) => ({
      id,
      name,
      active,
      eligible: active && role === 'SALES',
    }));
  }

  private lookupInput(body: unknown) {
    if (typeof body === 'object' && body !== null) {
      if ('ids' in body && !('search' in body)) {
        const ids = userIds(body.ids);
        const historicalIds = 'historicalIds' in body ? userIds(body.historicalIds) : [];
        if (ids && historicalIds) {
          return { ids, historicalIds };
        }
      }
      if (
        'search' in body &&
        !('ids' in body) &&
        !('historicalIds' in body) &&
        typeof body.search === 'string' &&
        body.search.length <= 255 &&
        !body.search.includes('\u0000')
      ) {
        return { search: body.search.trim() };
      }
    }
    throw new BadRequestException('Invalid Sales agent lookup');
  }
}
