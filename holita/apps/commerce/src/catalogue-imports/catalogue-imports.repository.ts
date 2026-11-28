import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service.js';
import type { CatalogueImportRow } from '../generated/graphql/types.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { Scope } from '../scope.js';
import type { CatalogueCsvRow } from './catalogue-csv.js';

@Injectable()
export class CatalogueImportsRepository {
  constructor(private readonly database: DatabaseService) {}

  start(scope: Scope, requestedByUserId: string, fileName: string, rows: CatalogueCsvRow[]) {
    return this.database.client.catalogueImportJob.create({
      data: {
        ...scope,
        requestedByUserId,
        fileName,
        rows: {
          createMany: {
            data: rows.map(({ rowNumber, columns }) => ({ rowNumber, normalizedInput: columns })),
          },
        },
      },
      select: { id: true, fileName: true },
    });
  }

  find(scope: Scope, id: string) {
    return this.database.client.catalogueImportJob.findUnique({
      where: { ...scope, id },
      select: {
        id: true,
        fileName: true,
        rows: {
          where: { ...scope, status: { not: null } },
          orderBy: { rowNumber: 'asc' },
          select: { rowNumber: true, status: true, errorCode: true, error: true },
        },
      },
    });
  }

  apply(
    scope: Scope,
    jobId: string,
    rowNumber: number,
    createProduct: (transaction: Prisma.TransactionClient) => Promise<unknown>,
  ) {
    const outcome = { rowNumber, status: 'APPLIED', errorCode: null, error: null } as const;
    return this.database.client.$transaction(async (transaction) => {
      await createProduct(transaction);
      return this.record(transaction, scope, jobId, outcome);
    });
  }

  reject(scope: Scope, jobId: string, rowNumber: number, errorCode: string, error: string) {
    return this.record(this.database.client, scope, jobId, {
      rowNumber,
      status: 'REJECTED',
      errorCode,
      error,
    });
  }

  private async record(
    transaction: Prisma.TransactionClient,
    scope: Scope,
    jobId: string,
    { rowNumber, ...data }: CatalogueImportRow,
  ): Promise<CatalogueImportRow> {
    await transaction.catalogueImportRow.update({
      where: { tenantId_branchId_jobId_rowNumber: { ...scope, jobId, rowNumber } },
      data,
    });
    return { rowNumber, ...data };
  }
}
