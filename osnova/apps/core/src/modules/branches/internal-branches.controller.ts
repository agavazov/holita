import { Body, Controller, Header, Headers, HttpCode, Post } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { requireInternalToken } from '../../auth/internal-token.js';
import { BranchesRepository } from './branches.repository.js';

@Controller('internal/branches')
export class InternalBranchesController {
  constructor(private readonly branches: BranchesRepository) {}

  @Post('resolve')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  resolve(@Headers('x-core-internal-token') token: string | undefined, @Body() body: unknown) {
    requireInternalToken(token);
    if (
      typeof body !== 'object' ||
      body === null ||
      !('id' in body) ||
      typeof body.id !== 'string' ||
      !isUUID(body.id)
    ) {
      return null;
    }
    return this.branches.resolvePublic(body.id.toLowerCase());
  }
}
