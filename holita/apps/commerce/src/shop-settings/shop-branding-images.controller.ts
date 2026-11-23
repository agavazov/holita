import { Controller, Get, Header, Headers, Param, StreamableFile } from '@nestjs/common';
import { requireScope } from '../scope.js';
import { StorefrontService } from '../storefront.service.js';
import { ShopSettingsService } from './shop-settings.service.js';

@Controller('media/shop-branding')
export class ShopBrandingImagesController {
  constructor(
    private readonly shops: StorefrontService,
    private readonly settings: ShopSettingsService,
  ) {}

  @Get(':branchId/:key')
  @Header('Cache-Control', 'no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  async read(
    @Param('branchId') branchId: string,
    @Param('key') key: string,
    @Headers('authorization') authorization: string | undefined,
  ) {
    const context = { branchId, authorization };
    const scope = authorization
      ? await requireScope(context, false)
      : await this.shops.publicScope(context);
    const { bytes, type } = await this.settings.brandingImage(scope, key);
    return new StreamableFile(bytes, { type });
  }
}
