import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { codegen } from '@graphql-codegen/core';
import * as typescript from '@graphql-codegen/typescript';
import { buildSubgraphSchema } from '@apollo/subgraph';
import { parse, printSchema } from 'graphql';

const root = new URL('../../apps/core/src/', import.meta.url);
const source = await Promise.all(
  ['modules/branches/branches.graphql', 'modules/tenants/tenants.graphql'].map((path) =>
    readFile(new URL(path, root), 'utf8'),
  ),
);
const schema = buildSubgraphSchema({ typeDefs: parse(source.join('\n')) });
const content = await codegen({
  filename: 'types.ts',
  schema: parse(printSchema(schema)),
  schemaAst: schema,
  documents: [],
  plugins: [{ typescript: {} }],
  pluginMap: { typescript },
  config: {
    useTypeImports: true,
    enumsAsTypes: true,
    defaultScalarType: 'unknown',
    scalars: { ID: 'string', DateTime: { input: 'string', output: 'Date' }, Date: 'string' },
  },
});
const output = new URL('generated/graphql/', root);
await mkdir(output, { recursive: true });
await writeFile(new URL('types.ts', output), content);
