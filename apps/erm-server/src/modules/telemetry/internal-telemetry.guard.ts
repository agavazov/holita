import {
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';

@Injectable()
export class InternalTelemetryGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const token = process.env.ERM_TELEMETRY_TOKEN;
    if (!token || token.length < 32) {
      throw new ServiceUnavailableException('Internal telemetry access is disabled');
    }
    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string | string[] };
      socket: { remoteAddress?: string };
    }>();
    const address = request.socket.remoteAddress ?? '';
    if (address !== '::1' && !/^(?:::ffff:)?127\./.test(address)) {
      throw new ForbiddenException('Internal telemetry access requires a loopback connection');
    }
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
      throw new UnauthorizedException('Internal telemetry authentication required');
    }
    return true;
  }
}
