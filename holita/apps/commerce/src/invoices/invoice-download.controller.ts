import {
  Controller,
  Get,
  Header,
  Headers,
  NotFoundException,
  Param,
  StreamableFile,
} from '@nestjs/common';
import type { Invoice } from '../generated/graphql/types.js';
import { renderInvoicePdf } from './invoice-pdf.js';
import { InvoicesService } from './invoices.service.js';

@Controller('documents/invoices')
export class InvoiceDownloadController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get(':orderId/pdf')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  async download(
    @Param('orderId') orderId: string,
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-branch-id') branchId: string | undefined,
  ): Promise<StreamableFile> {
    return this.file(await this.invoices.find({ authorization, branchId }, orderId));
  }

  @Get('document/:id/pdf')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  async downloadById(
    @Param('id') id: string,
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-branch-id') branchId: string | undefined,
  ): Promise<StreamableFile> {
    return this.file(await this.invoices.findById({ authorization, branchId }, id));
  }

  private async file(invoice: Invoice | null): Promise<StreamableFile> {
    if (!invoice) {
      throw new NotFoundException();
    }
    const filename = invoice.number.replace(/[^a-zA-Z0-9_-]+/gu, '-');
    return new StreamableFile(await renderInvoicePdf(invoice), {
      type: 'application/pdf',
      disposition: `attachment; filename="invoice-${filename}.pdf"`,
    });
  }
}
