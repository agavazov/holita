import { BadRequestException, Injectable } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { GraphQLError } from 'graphql';
import type {
  CatalogueImportJob,
  CatalogueImportRow,
  ImportCatalogueInput,
} from '../generated/graphql/types.js';
import { CommerceService } from '../products/commerce.service.js';
import { requireMerchant, requireScope, type RequestContext } from '../scope.js';
import { catalogueFileName, parseCatalogueCsv } from './catalogue-csv.js';
import { CatalogueImportsRepository } from './catalogue-imports.repository.js';

function catalogueErrorCode(error: GraphQLError): string {
  const fields = error.extensions['fieldErrors'];
  const field: unknown = Array.isArray(fields) ? fields[0] : undefined;
  if (typeof field === 'object' && field !== null && 'path' in field) {
    if ('code' in field && field.code === 'DUPLICATE_SKU') {
      return 'DUPLICATE_SKU';
    }
    switch (field.path) {
      case 'name':
        return 'INVALID_NAME';
      case 'variants.0.sku':
        return 'INVALID_SKU';
      case 'variants.0.price':
        return 'INVALID_PRICE';
    }
  }
  return 'CATALOGUE_VALIDATION';
}

@Injectable()
export class CatalogueImportsService {
  constructor(
    private readonly repository: CatalogueImportsRepository,
    private readonly products: CommerceService,
  ) {}

  async find(context: RequestContext, id: string): Promise<CatalogueImportJob | null> {
    const scope = await requireScope(context, false);
    if (!isUUID(id)) {
      throw new BadRequestException('Catalogue import ID must be a UUID');
    }
    const job = await this.repository.find(scope, id.toLowerCase());
    return (
      job && {
        ...job,
        rows: job.rows.flatMap(({ status, ...row }) => (status ? [{ status, ...row }] : [])),
      }
    );
  }

  async submit(context: RequestContext, input: ImportCatalogueInput): Promise<CatalogueImportJob> {
    const { scope, userId } = await requireMerchant(context, true);
    const fileName = catalogueFileName(input.fileName);
    const records = parseCatalogueCsv(input.csv);
    const job = await this.repository.start(scope, userId, fileName, records);
    const rows: CatalogueImportRow[] = [];

    for (const { rowNumber, columns } of records) {
      const [name, sku, price] = columns;
      if (columns.length !== 3 || name === undefined || sku === undefined || price === undefined) {
        rows.push(
          await this.repository.reject(
            scope,
            job.id,
            rowNumber,
            'COLUMN_COUNT',
            'Expected three CSV columns',
          ),
        );
        continue;
      }
      try {
        rows.push(
          await this.repository.apply(scope, job.id, rowNumber, (transaction) =>
            this.products.createImported(
              scope,
              {
                name,
                status: 'DRAFT',
                variants: [
                  { sku, price, inventoryTracked: false, active: true, optionValueIds: [] },
                ],
              },
              transaction,
            ),
          ),
        );
      } catch (error: unknown) {
        if (!(error instanceof GraphQLError) || error.extensions['code'] !== 'BAD_USER_INPUT') {
          throw error;
        }
        rows.push(
          await this.repository.reject(
            scope,
            job.id,
            rowNumber,
            catalogueErrorCode(error),
            error.message,
          ),
        );
      }
    }
    return { ...job, rows };
  }
}
