import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { codegen } from '@graphql-codegen/core';
import * as typescript from '@graphql-codegen/typescript';
import { buildSubgraphSchema } from '@apollo/subgraph';
import { parse, printSchema } from 'graphql';

for (const name of ['commerce', 'storefront']) {
  const schemaPath = new URL(`../../apps/commerce/src/${name}.graphql`, import.meta.url);
  const outputPath = new URL('../../apps/commerce/src/generated/graphql/', import.meta.url);
  const schema = buildSubgraphSchema({ typeDefs: parse(await readFile(schemaPath, 'utf8')) });
  const content = await codegen({
    filename: name === 'commerce' ? 'types.ts' : 'storefront-types.ts',
    schema: parse(printSchema(schema)),
    schemaAst: schema,
    documents: [],
    plugins: [{ typescript: {} }],
    pluginMap: { typescript },
    config: {
      useTypeImports: true,
      enumsAsTypes: true,
      defaultScalarType: 'unknown',
      scalars: { ID: 'string' },
    },
  });
  await mkdir(outputPath, { recursive: true });
  await writeFile(
    new URL(name === 'commerce' ? 'types.ts' : 'storefront-types.ts', outputPath),
    content,
  );
}
