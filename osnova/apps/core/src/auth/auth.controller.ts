import { Controller, Header, Headers, HttpCode, Post } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import type { SessionIdentity } from './session.js';
import { requireInternalToken } from './internal-token.js';

@Controller('internal/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('verify')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async verify(
    @Headers('x-core-internal-token') internalToken: string | undefined,
    @Headers('authorization') authorization: string | undefined,
  ): Promise<SessionIdentity | { authenticated: false }> {
    requireInternalToken(internalToken);
    const identity = await this.auth.verifyAuthorization(authorization);
    return identity ?? { authenticated: false };
  }
}
