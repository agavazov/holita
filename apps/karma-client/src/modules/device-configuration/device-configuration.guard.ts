import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';

@Injectable()
export class DeviceConfigurationGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const token = process.env.KARMA_INTERNAL_TOKEN;
    if (!token || token.length < 32) {
      throw new ServiceUnavailableException('Internal device configuration access is disabled');
    }
    const request = context
      .switchToHttp()
      .getRequest<{ headers: { authorization?: string | string[] } }>();
    const authorization = request.headers.authorization;
    const supplied =
      typeof authorization === 'string' &&
      authorization.length <= 4096 &&
      authorization.startsWith('Bearer ')
        ? authorization.slice(7)
        : '';
    const expectedHash = createHash('sha256').update(token).digest();
    const suppliedHash = createHash('sha256').update(supplied).digest();
    if (!timingSafeEqual(expectedHash, suppliedHash)) {
      throw new UnauthorizedException('Internal service authentication required');
    }
    return true;
  }
}
