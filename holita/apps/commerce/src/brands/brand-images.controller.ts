import {
  Controller,
  Get,
  Header,
  Headers,
  NotFoundException,
  Param,
  StreamableFile,
} from '@nestjs/common';
import { requireScope } from '../scope.js';
import { StorefrontService } from '../storefront.service.js';
import { imageType } from '../media/image-files.js';
import { BrandImages } from './brand-images.js';
import { BrandsRepository } from './brands.repository.js';

@Controller('media/brands')
export class BrandImagesController {
  constructor(
    private readonly shops: StorefrontService,
    private readonly brands: BrandsRepository,
    private readonly images: BrandImages,
  ) {}

  @Get(':branchId/:key')
  @Header('Cache-Control', 'no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  async read(
    @Param('branchId') branchId: string,
    @Param('key') key: string,
    @Headers('authorization') authorization: string | undefined,
  ): Promise<StreamableFile> {
    const type = imageType(key);
    if (!type) {
      throw new NotFoundException();
    }
    const context = { branchId, authorization };
    const scope = authorization
      ? await requireScope(context, false)
      : await this.shops.publicScope(context);
    if (!(await this.brands.logo(scope, key, !authorization))) {
      throw new NotFoundException();
    }
    try {
      return new StreamableFile(await this.images.read(scope, key), { type });
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        throw new NotFoundException();
      }
      throw error;
    }
  }
}
