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
import { ProductImages } from './product-images.js';
import { CommerceRepository } from './commerce.repository.js';

@Controller('media/products')
export class ProductImagesController {
  constructor(
    private readonly shops: StorefrontService,
    private readonly products: CommerceRepository,
    private readonly images: ProductImages,
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
    if (!(await this.products.image(scope, key, !authorization))) {
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
