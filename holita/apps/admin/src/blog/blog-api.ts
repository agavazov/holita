import { computed, inject, Injectable } from '@angular/core';
import { ApolloClient } from '@apollo/client/core';
import { OperatorLanguage } from '@holita/operator';
import { DemoSession, OperatorConfig, graphqlOptions, type Language } from '@osnova/ui/app';
import { HttpLink } from 'apollo-angular/http';
import {
  OperatorBlogArticleDocument,
  OperatorBlogArticlesDocument,
  OperatorBlogTagChoicesDocument,
  OperatorBlogTagDocument,
  OperatorBlogTagsDocument,
  OperatorCreateBlogArticleDocument,
  OperatorCreateBlogTagDocument,
  OperatorUpdateBlogArticleDocument,
  OperatorUpdateBlogTagDocument,
  type BlogArticleInput,
  type BlogTagInput,
  type OperatorBlogArticlesQueryVariables,
  type OperatorBlogTagsQueryVariables,
} from '../generated/blog-operations';

interface BlogScope {
  readonly tenantId: string;
  readonly branchId: string;
  readonly language: Language;
  readonly token: string;
}

@Injectable({ providedIn: 'root' })
export class BlogApi {
  private readonly session = inject(DemoSession);
  private readonly language = inject(OperatorLanguage);
  private readonly link = inject(HttpLink);
  private readonly config = inject(OperatorConfig);
  private readonly token = computed(() => this.session.current()?.token);
  private readonly tenantId = computed(() => this.session.current()?.tenant.id);
  readonly scope = computed<BlogScope | null>(() => {
    const branchId = this.session.branchId();
    const language = this.language.value();
    const tenantId = this.tenantId();
    const token = this.token();
    return branchId && tenantId && token ? { tenantId, branchId, language, token } : null;
  });
  readonly canWrite = computed(() => !!this.scope() && this.session.hasRole('OPERATOR'));

  private client(scope: BlogScope): ApolloClient {
    return new ApolloClient(graphqlOptions(this.link, this.config.graphqlUrl, scope, scope));
  }

  async articles(scope: BlogScope, variables: OperatorBlogArticlesQueryVariables) {
    const client = this.client(scope);
    try {
      const { data } = await client.query({
        query: OperatorBlogArticlesDocument,
        variables,
        fetchPolicy: 'no-cache',
      });
      if (!data) {
        throw new Error('Missing blog articles');
      }
      return data.blogArticles;
    } finally {
      client.stop();
    }
  }

  async article(scope: BlogScope, id: string) {
    const client = this.client(scope);
    try {
      const { data } = await client.query({
        query: OperatorBlogArticleDocument,
        variables: { id },
        fetchPolicy: 'no-cache',
      });
      if (!data) {
        throw new Error('Missing blog article result');
      }
      return data.blogArticle;
    } finally {
      client.stop();
    }
  }

  async tags(scope: BlogScope, variables: OperatorBlogTagsQueryVariables) {
    const client = this.client(scope);
    try {
      const { data } = await client.query({
        query: OperatorBlogTagsDocument,
        variables,
        fetchPolicy: 'no-cache',
      });
      if (!data) {
        throw new Error('Missing blog tags');
      }
      return data.blogTags;
    } finally {
      client.stop();
    }
  }

  async tag(scope: BlogScope, id: string) {
    const client = this.client(scope);
    try {
      const { data } = await client.query({
        query: OperatorBlogTagDocument,
        variables: { id },
        fetchPolicy: 'no-cache',
      });
      if (!data) {
        throw new Error('Missing blog tag result');
      }
      return data.blogTag;
    } finally {
      client.stop();
    }
  }

  async tagChoices(scope: BlogScope) {
    const client = this.client(scope);
    try {
      const { data } = await client.query({
        query: OperatorBlogTagChoicesDocument,
        fetchPolicy: 'no-cache',
      });
      if (!data) {
        throw new Error('Missing blog tag choices');
      }
      return data.blogTagChoices;
    } finally {
      client.stop();
    }
  }

  async saveArticle(scope: BlogScope, input: BlogArticleInput, id: string | null): Promise<string> {
    const client = this.client(scope);
    try {
      if (id) {
        const { data } = await client.mutate({
          mutation: OperatorUpdateBlogArticleDocument,
          variables: { id, input },
        });
        if (data) {
          return data.updateBlogArticle.id;
        }
      } else {
        const { data } = await client.mutate({
          mutation: OperatorCreateBlogArticleDocument,
          variables: { input },
        });
        if (data) {
          return data.createBlogArticle.id;
        }
      }
      throw new Error('Missing saved blog article');
    } finally {
      client.stop();
    }
  }

  async saveTag(scope: BlogScope, input: BlogTagInput, id: string | null): Promise<string> {
    const client = this.client(scope);
    try {
      if (id) {
        const { data } = await client.mutate({
          mutation: OperatorUpdateBlogTagDocument,
          variables: { id, input },
        });
        if (data) {
          return data.updateBlogTag.id;
        }
      } else {
        const { data } = await client.mutate({
          mutation: OperatorCreateBlogTagDocument,
          variables: { input },
        });
        if (data) {
          return data.createBlogTag.id;
        }
      }
      throw new Error('Missing saved blog tag');
    } finally {
      client.stop();
    }
  }
}
