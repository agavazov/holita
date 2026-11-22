import { computed, inject, Injectable } from '@angular/core';
import { ApolloClient } from '@apollo/client/core';
import { OperatorLanguage } from '@holita/operator';
import { DemoSession, OperatorConfig, graphqlOptions, type Language } from '@osnova/ui/app';
import { HttpLink } from 'apollo-angular/http';
import {
  OperatorIssueOrderInvoiceDocument,
  OperatorMarkOrderPaidDocument,
  OperatorOrderInvoiceDocument,
  type IssueOrderInvoiceInput,
  OperatorOrderDocument,
  OperatorOrdersDocument,
  OperatorRecordOrderRefundDocument,
  type RecordOrderRefundInput,
  OperatorUpdateOrderStatusDocument,
  type OperatorOrdersQueryVariables,
  type OrderStatus,
} from '../generated/orders-operations';

interface OrdersScope {
  readonly tenantId: string;
  readonly branchId: string;
  readonly language: Language;
  readonly token: string;
}

export const orderIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable({ providedIn: 'root' })
export class OrdersApi {
  private readonly session = inject(DemoSession);
  private readonly language = inject(OperatorLanguage);
  private readonly link = inject(HttpLink);
  private readonly config = inject(OperatorConfig);
  private readonly tenantId = computed(() => this.session.current()?.tenant.id);
  private readonly token = computed(() => this.session.current()?.token);
  readonly scope = computed<OrdersScope | null>(() => {
    const branchId = this.session.branchId();
    const language = this.language.value();
    const tenantId = this.tenantId();
    const token = this.token();
    return branchId && tenantId && token ? { tenantId, branchId, language, token } : null;
  });
  readonly canWrite = computed(() => {
    const role = this.session.role();
    return !!this.scope() && (role === 'OPERATOR' || role === 'ADMINISTRATOR');
  });

  private client(scope: OrdersScope): ApolloClient {
    return new ApolloClient(graphqlOptions(this.link, this.config.graphqlUrl, scope, scope));
  }

  async list(scope: OrdersScope, variables: OperatorOrdersQueryVariables) {
    const client = this.client(scope);
    try {
      const { data } = await client.query({
        query: OperatorOrdersDocument,
        variables,
        fetchPolicy: 'no-cache',
      });
      if (!data) {
        throw new Error('Missing orders result');
      }
      return data.orders;
    } finally {
      client.stop();
    }
  }

  async find(scope: OrdersScope, id: string) {
    const client = this.client(scope);
    try {
      const { data } = await client.query({
        query: OperatorOrderDocument,
        variables: { id },
        fetchPolicy: 'no-cache',
      });
      if (!data) {
        throw new Error('Missing order result');
      }
      return data.order ? { ...data.order, refundSummary: data.orderRefundSummary } : null;
    } finally {
      client.stop();
    }
  }

  async invoice(scope: OrdersScope, orderId: string) {
    const client = this.client(scope);
    try {
      const { data } = await client.query({
        query: OperatorOrderInvoiceDocument,
        variables: { orderId },
        fetchPolicy: 'no-cache',
      });
      if (!data) {
        throw new Error('Missing invoice result');
      }
      return data.orderInvoice;
    } finally {
      client.stop();
    }
  }

  async issueInvoice(scope: OrdersScope, orderId: string, input: IssueOrderInvoiceInput) {
    const client = this.client(scope);
    try {
      const { data } = await client.mutate({
        mutation: OperatorIssueOrderInvoiceDocument,
        variables: { orderId, input },
      });
      if (!data) {
        throw new Error('Missing issued invoice result');
      }
      return data.issueOrderInvoice;
    } finally {
      client.stop();
    }
  }

  async recordRefund(scope: OrdersScope, orderId: string, input: RecordOrderRefundInput) {
    const client = this.client(scope);
    try {
      const { data } = await client.mutate({
        mutation: OperatorRecordOrderRefundDocument,
        variables: { orderId, input },
      });
      if (!data) {
        throw new Error('Missing recorded refund result');
      }
      return data.recordOrderRefund;
    } finally {
      client.stop();
    }
  }

  async updateStatus(scope: OrdersScope, id: string, status: OrderStatus): Promise<string> {
    const client = this.client(scope);
    try {
      const { data } = await client.mutate({
        mutation: OperatorUpdateOrderStatusDocument,
        variables: { id, status },
      });
      if (!data) {
        throw new Error('Missing updated order status');
      }
      return data.updateOrderStatus.id;
    } finally {
      client.stop();
    }
  }

  async markPaid(scope: OrdersScope, id: string) {
    const client = this.client(scope);
    try {
      const { data } = await client.mutate({
        mutation: OperatorMarkOrderPaidDocument,
        variables: { id },
      });
      if (!data) {
        throw new Error('Missing updated order payment');
      }
      return data.markOrderPaid;
    } finally {
      client.stop();
    }
  }
}
