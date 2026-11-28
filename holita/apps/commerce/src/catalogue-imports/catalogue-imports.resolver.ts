import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import type {
  MutationImportCatalogueArgs,
  QueryCatalogueImportArgs,
} from '../generated/graphql/types.js';
import type { RequestContext } from '../scope.js';
import { CatalogueImportsService } from './catalogue-imports.service.js';

@Resolver()
export class CatalogueImportsResolver {
  constructor(private readonly service: CatalogueImportsService) {}

  @Query('catalogueImport')
  catalogueImport(@Args() args: QueryCatalogueImportArgs, @Context() context: RequestContext) {
    return this.service.find(context, args.id);
  }

  @Mutation('importCatalogue')
  importCatalogue(@Args() args: MutationImportCatalogueArgs, @Context() context: RequestContext) {
    return this.service.submit(context, args.input);
  }
}
