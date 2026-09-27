import {
  Controller,
  Get,
  Header,
  Headers,
  HttpCode,
  Param,
  Put,
  Query,
  Req,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { IncomingMessage } from 'node:http';
import { ReferenceEnabledGuard } from '../reference-enabled.guard.js';
import { MediaService } from './media.service.js';

@Controller('media')
@UseGuards(ReferenceEnabledGuard)
export class MediaController {
  constructor(private readonly media: MediaService) {}
  @Put('uploads/:id')
  @HttpCode(204)
  upload(
    @Param('id') id: string,
    @Headers('authorization') authorization: string | undefined,
    @Req() request: IncomingMessage,
  ) {
    return this.media.upload(id, authorization, request);
  }
  @Get('files/:storeId/:id')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Content-Security-Policy', "default-src 'none'; sandbox")
  async read(
    @Param('storeId') storeId: string,
    @Param('id') id: string,
    @Query('expires') expires: unknown = '',
    @Query('signature') signature: unknown = '',
  ) {
    const file = await this.media.read(storeId, id, expires, signature);
    return new StreamableFile(file.stream, {
      type: file.contentType,
      length: file.byteSize,
      disposition: 'inline',
    });
  }
}
