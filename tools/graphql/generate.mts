import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { codegen } from '@graphql-codegen/core';
import * as typescript from '@graphql-codegen/typescript';
import * as operationsPlugin from '@graphql-codegen/typescript-operations';
import * as typedDocumentNode from '@graphql-codegen/typed-document-node';
import { parse, printSchema, type GraphQLSchema } from 'graphql';
import { composeContracts, readContracts, readOperations, workspaceRoot } from './contracts.mjs';

const target = process.argv[2];
if (
  !target ||
  !['check', 'core', 'products', 'gateway', 'admin'].includes(target) ||
  process.argv.length !== 3
) {
  throw new Error('Use npm run codegen, schema:compose or schema:check');
}
const composition = composeContracts(await readContracts());
const documents = await readOperations(composition.apiSchema);

async function writeChanged(path: string, content: string) {
  const absolute = join(workspaceRoot, path);
  let previous: string | undefined;
  try {
    previous = await readFile(absolute, 'utf8');
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
  }
  if (previous === content) return;
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
      scalars: { ID: 'string', DateTime: client ? 'string' : 'Date' },
    },
  });
  await writeChanged(path, content);
}

if (target === 'gateway') {
  await writeChanged(
    'apps/gateway/src/generated/graphql/supergraph.graphql',
    composition.supergraphSdl + '\n',
  );
  await writeChanged('apps/gateway/src/generated/graphql/schema.graphql', composition.clientSdl);
} else if (target === 'admin') {
  await generateTypes(
    'apps/admin/src/generated/graphql/operations.ts',
    composition.apiSchema,
    true,
    documents.filter((document) => document.location.startsWith('apps/admin/')),
  );
} else if (target === 'core' || target === 'products') {
  const schema = composition.schemas.get(target);
  if (!schema) throw new Error(`Missing ${target} schema`);
  await generateTypes(`apps/${target}/src/generated/graphql/types.ts`, schema, false);
  if (target === 'products') {
    await generateTypes(
      'apps/products/src/generated/graphql/core-operations.ts',
      composition.apiSchema,
      true,
      documents.filter((document) => document.location.startsWith('apps/products/')),
    );
  }
}
console.info(
  target === 'check'
    ? 'Both subgraphs compose; all local operations validate without running services'
    : `Generated ${target} GraphQL artifacts from local contracts`,
);
