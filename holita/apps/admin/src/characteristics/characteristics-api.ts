import { computed, inject, Injectable } from '@angular/core';
import { ApolloClient } from '@apollo/client/core';
import { OperatorLanguage } from '@holita/operator';
import { DemoSession, OperatorConfig, graphqlOptions, type Language } from '@osnova/ui/app';
import { HttpLink } from 'apollo-angular/http';
import {
  OperatorCreateCharacteristicGroupDocument,
  OperatorCharacteristicGroupDocument,
  OperatorCharacteristicGroupsDocument,
  OperatorUpdateCharacteristicGroupDocument,
  type OperatorCharacteristicGroupsQueryVariables,
  type CharacteristicGroupInput,
} from '../generated/characteristics-operations';

interface CharacteristicGroupScope {
  readonly tenantId: string;
  readonly branchId: string;
  readonly language: Language;
  readonly token: string;
}

@Injectable({ providedIn: 'root' })
export class CharacteristicsApi {
  private readonly session = inject(DemoSession);
  private readonly language = inject(OperatorLanguage);
  private readonly link = inject(HttpLink);
  private readonly config = inject(OperatorConfig);
  private readonly token = computed(() => this.session.current()?.token);
  private readonly tenantId = computed(() => this.session.current()?.tenant.id);
  readonly scope = computed<CharacteristicGroupScope | null>(() => {
    const branchId = this.session.branchId();
    const language = this.language.value();
    const tenantId = this.tenantId();
    const token = this.token();
    return branchId && tenantId && token ? { tenantId, branchId, language, token } : null;
  });

  private client(scope: CharacteristicGroupScope): ApolloClient {
    return new ApolloClient(graphqlOptions(this.link, this.config.graphqlUrl, scope, scope));
  }

  async list(
    scope: CharacteristicGroupScope,
    variables: OperatorCharacteristicGroupsQueryVariables,
  ) {
    const client = this.client(scope);
    try {
      const { data } = await client.query({
        query: OperatorCharacteristicGroupsDocument,
        variables,
        fetchPolicy: 'no-cache',
      });
      if (!data) {
        throw new Error('Missing characteristic groups');
      }
      return data.characteristicGroups;
    } finally {
      client.stop();
    }
  }

  async find(scope: CharacteristicGroupScope, id: string) {
    const client = this.client(scope);
    try {
      const { data } = await client.query({
        query: OperatorCharacteristicGroupDocument,
        variables: { id },
        fetchPolicy: 'no-cache',
      });
      if (!data) {
        throw new Error('Missing characteristic group result');
      }
      return data.characteristicGroup;
    } finally {
      client.stop();
    }
  }

  async save(
    scope: CharacteristicGroupScope,
    input: CharacteristicGroupInput,
    id: string | null,
  ): Promise<string> {
    const client = this.client(scope);
    try {
      if (id) {
        const { data } = await client.mutate({
          mutation: OperatorUpdateCharacteristicGroupDocument,
          variables: { id, input },
        });
        if (data) {
          return data.updateCharacteristicGroup.id;
        }
      } else {
        const { data } = await client.mutate({
          mutation: OperatorCreateCharacteristicGroupDocument,
          variables: { input },
        });
        if (data) {
          return data.createCharacteristicGroup.id;
        }
      }
      throw new Error('Missing saved characteristic group');
    } finally {
      client.stop();
    }
  }
}
