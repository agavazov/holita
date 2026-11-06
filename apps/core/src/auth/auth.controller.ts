import {
  Controller,
  Header,
  Headers,
  HttpCode,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';
import { AuthService } from './auth.service.js';
import type { SessionIdentity } from './session.js';

@Controller('internal/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('verify')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async verify(
    @Headers('x-core-internal-token') internalToken: string | undefined,
    @Headers('authorization') authorization: string | undefined,
  ): Promise<SessionIdentity> {
    const expected = process.env.CORE_INTERNAL_AUTH_TOKEN;
    if (!expected || expected.length < 32) {
      throw new ServiceUnavailableException('Internal session verification is not configured');
    }
    if (
      !internalToken ||
      !timingSafeEqual(
        createHash('sha256').update(internalToken).digest(),
        createHash('sha256').update(expected).digest(),
      )
    ) {
      throw new UnauthorizedException('Invalid internal authentication');
    }
    const identity = await this.auth.verifyAuthorization(authorization);
    if (!identity) {
      throw new UnauthorizedException('Invalid session');
    }
    return identity;
  }
}
