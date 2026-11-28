import {
  Body,
  Controller,
  ForbiddenException,
  Header,
  Headers,
  HttpCode,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from '../../auth/auth.service.js';
import { requireInternalToken } from '../../auth/internal-token.js';
import { PlatformService } from './platform.service.js';

@Controller('internal/platform')
export class InternalPlatformController {
  constructor(
    private readonly auth: AuthService,
    private readonly platform: PlatformService,
  ) {}

  @Post('provision-merchant')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async provisionMerchant(
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
    return this.platform.provisionMerchant(identity.tenantId, body);
  }
}
