import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';

@Injectable()
export class DeviceTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ headers: { authorization?: string } }>();
    const token = process.env.DEVICE_SERVER_TOKEN;
    const actual = request.headers.authorization;
    if (token && actual) {
      const expected = Buffer.from(`Bearer ${token}`);
      const provided = Buffer.from(actual);
      if (provided.length === expected.length && timingSafeEqual(provided, expected)) {
        return true;
      }
    }
    throw new UnauthorizedException();
  }
}
