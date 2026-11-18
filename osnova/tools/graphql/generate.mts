import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { codegen } from '@graphql-codegen/core';
import * as typescript from '@graphql-codegen/typescript';
import * as operationsPlugin from '@graphql-codegen/typescript-operations';
import * as typedDocumentNode from '@graphql-codegen/typed-document-node';
import { parse, printSchema, type GraphQLSchema } from 'graphql';
import {
  composeContracts,
  readContracts,
  readOperations,
  workspaceRoot,
  type Subgraph,
} from './contracts.mjs';

export interface GenerationTarget {
  supergraph?: string;
  schema?: string;
  server?: { subgraph: string; path: string };
  clients?: { path: string; operations: string[]; subgraph?: string }[];
}

export async function generate(
  subgraphs: Subgraph[],
  operationPaths: string[],
  targets: Record<string, GenerationTarget>,
  target: string,
  extraScalars: Record<string, string> = {},
) {
  if (target !== 'check' && !targets[target]) {
    throw new Error(`Unknown GraphQL target: ${target}`);
  }
  const composition = composeContracts(await readContracts(subgraphs));
  const documents = await readOperations(composition.apiSchema, operationPaths);
  async function writeChanged(path: string, content: string) {
    const absolute = join(workspaceRoot, path);
    let previous: string | undefined;
    try {
      previous = await readFile(absolute, 'utf8');
    } catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') {
        throw error;
      }
    }
    if (previous === content) {
      return;
    }
    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, content);
  }

  async function generateTypes(
    path: string,
    schema: GraphQLSchema,
    client: boolean,
    selectedDocuments = documents,
  ) {
    const content = await codegen({
      filename: path,
      schema: parse(printSchema(schema)),
      schemaAst: schema,
      documents: client ? selectedDocuments : [],
      plugins: client ? [{ operations: {} }, { typedDocumentNode: {} }] : [{ typescript: {} }],
      pluginMap: { typescript, operations: operationsPlugin, typedDocumentNode },
      config: {
        useTypeImports: true,
        enumsAsTypes: true,
        defaultScalarType: 'unknown',
        // Servers read DateTime inputs as strings (validated by the service) and return Dates;
        // Date is always a YYYY-MM-DD string.
        scalars: {
          ID: 'string',
          DateTime: client ? 'string' : { input: 'string', output: 'Date' },
          Date: 'string',
          ...extraScalars,
        },
      },
    });
    await writeChanged(path, content);
  }

  const selected = targets[target];
  if (selected?.supergraph) {
    await writeChanged(selected.supergraph, composition.supergraphSdl + '\n');
  }
  if (selected?.schema) {
    await writeChanged(selected.schema, composition.clientSdl);
  }
  if (selected?.server) {
    const schema = composition.schemas.get(selected.server.subgraph);
    if (!schema) {
      throw new Error(`Missing ${selected.server.subgraph} schema`);
    }
    await generateTypes(selected.server.path, schema, false);
  }
  for (const client of selected?.clients ?? []) {
    const clientSchema = client.subgraph
      ? composition.schemas.get(client.subgraph)
      : composition.apiSchema;
    if (!clientSchema) {
      throw new Error(`Missing ${client.subgraph ?? 'client'} schema`);
    }
    await generateTypes(
      client.path,
      clientSchema,
      true,
      documents.filter(({ location }) => client.operations.includes(location)),
    );
  }
  console.info(
    target === 'check'
      ? 'All subgraphs compose; all local operations validate without running services'
      : `Generated ${target} GraphQL artifacts from local contracts`,
  );
}
