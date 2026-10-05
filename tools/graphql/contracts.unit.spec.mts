import { describe, expect, it } from '@jest/globals';
import { parse, print } from 'graphql';
import {
  composeContracts,
  readContracts,
  readOperations,
  validateOperation,
} from './contracts.mjs';

describe('local GraphQL contracts', () => {
  it('composes real subgraphs and validates every named application operation offline', async () => {
    const result = composeContracts(await readContracts());
    expect(result.clientSdl).toContain('store: Store!');
    expect(result.clientSdl).not.toContain('_entities');
    const operations = await readOperations(result.apiSchema);
    expect(operations).toHaveLength(12);
    expect(operations.map((operation) => operation.location)).toEqual(
      expect.arrayContaining([
        'apps/admin/src/app/features/stores/operations.graphql',
        'apps/admin/src/app/features/products/operations.graphql',
      ]),
    );
    expect(result.clientSdl).toContain('referenceVenues(');
    expect(result.clientSdl).toContain('reorderReferenceSessions(');
    expect(composeContracts(await readContracts()).supergraphSdl).toBe(result.supergraphSdl);
  });
  it('rejects an operation that no longer matches the API', async () => {
    const { apiSchema } = composeContracts(await readContracts());
    expect(() =>
      validateOperation(apiSchema, 'query Invalid { stores { removedField } }', 'invalid.graphql'),
    ).toThrow('removedField');
  });
  it('fails composition when subgraphs disagree about the Store key type', async () => {
    const contracts = await readContracts();
    const incompatible = contracts.map((contract) =>
      contract.name === 'core'
        ? { ...contract, typeDefs: parse(print(contract.typeDefs).replace('id: ID!', 'id: Int!')) }
        : contract,
    );
    expect(() => composeContracts(incompatible)).toThrow('Composition failed');
  });
});
