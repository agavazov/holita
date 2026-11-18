import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { composeServices } from '@apollo/composition';
import { buildSubgraphSchema } from '@apollo/subgraph';
import {
  concatAST,
  lexicographicSortSchema,
  parse,
  printSchema,
  Source,
  validate,
  type GraphQLSchema,
} from 'graphql';

export const workspaceRoot = fileURLToPath(new URL('../../../', import.meta.url));

export interface Subgraph {
  name: string;
  url: string;
  path: string;
  additionalPaths: string[];
}

export async function readContracts(subgraphs: Subgraph[]) {
  return Promise.all(
    subgraphs.map(async (subgraph) => ({
      ...subgraph,
      typeDefs: parse(
        (
          await Promise.all(
            [subgraph.path, ...subgraph.additionalPaths].map((path) =>
              readFile(join(workspaceRoot, path), 'utf8'),
            ),
          )
        ).join('\n'),
      ),
    })),
  );
}

export function composeContracts(contracts: Awaited<ReturnType<typeof readContracts>>) {
  const result = composeServices(contracts);
  if (!result.schema || !result.supergraphSdl) {
    throw new Error(
      `Composition failed:\n${result.errors?.map((error) => error.message).join('\n') ?? 'No supergraph produced'}`,
    );
  }
  const apiSchema = result.schema.toAPISchema().toGraphQLJSSchema();
  const schemas = new Map(
    contracts.map((contract) => [
      contract.name,
      buildSubgraphSchema({ typeDefs: contract.typeDefs }),
    ]),
  );
  return {
    apiSchema,
    schemas,
    supergraphSdl: result.supergraphSdl,
    clientSdl: printSchema(lexicographicSortSchema(apiSchema)) + '\n',
  };
}

export async function readOperations(schema: GraphQLSchema, operationPaths: string[]) {
  const documents = await Promise.all(
    operationPaths.map(async (location) => ({
      document: parse(new Source(await readFile(join(workspaceRoot, location), 'utf8'), location)),
      location,
    })),
  );
  const errors = validate(schema, concatAST(documents.map(({ document }) => document)));
  if (errors.length) {
    throw new Error(errors.map((error) => error.toString()).join('\n'));
  }
  return documents;
}
