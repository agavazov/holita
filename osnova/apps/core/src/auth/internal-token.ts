import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';

export function requireInternalToken(internalToken: string | undefined): void {
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
}
