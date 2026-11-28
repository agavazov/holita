import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable } from '@angular/core';
import { ApolloClient } from '@apollo/client/core';
import { OperatorLanguage } from '@holita/operator';
import { DemoSession, OperatorConfig, graphqlOptions, type Language } from '@osnova/ui/app';
import { HttpLink } from 'apollo-angular/http';
import { firstValueFrom } from 'rxjs';
import {
  OperatorCreateManualOrderDocument,
  OperatorDecideOrderReturnDocument,
  OperatorInvoiceByIdDocument,
  OperatorInvoiceIssuerSettingsDocument,
  OperatorInvoicesDocument,
  OperatorIssueStandaloneInvoiceDocument,
  OperatorUpdateInvoiceIssuerSettingsDocument,
  type InvoiceIssuerSettingsInput,
  type IssueStandaloneInvoiceInput,
  OperatorManualOrderChoicesDocument,
  OperatorManualOrderCustomersDocument,
  OperatorManualOrderVariantsDocument,
  OperatorUpdateManualOrderDocument,
  type ManualOrderInput,
  type ManualOrderUpdateInput,
  OperatorIssueOrderInvoiceDocument,
  OperatorMarkOrderPaidDocument,
  OperatorMarkAllOrderNotificationsReadDocument,
  OperatorMarkOrderNotificationReadDocument,
  OperatorOrderInvoiceDocument,
  type IssueOrderInvoiceInput,
  OperatorOrderDocument,
  OperatorOrderFilterCustomerDocument,
  OperatorOrderFilterMethodsDocument,
  OperatorOrderNotificationsDocument,
  OperatorOrderReturnDocument,
  OperatorOrderReturnsDocument,
  OperatorOrdersDocument,
  OperatorRecordOrderRefundDocument,
  type RecordOrderRefundInput,
  OperatorUpdateOrderStatusDocument,
  type OperatorInvoicesQueryVariables,
  type OperatorOrderNotificationsQueryVariables,
  type OperatorOrderReturnsQueryVariables,
  type OperatorOrdersQueryVariables,
  type OrderReturnOutcome,
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
  private readonly http = inject(HttpClient);
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
  readonly canDecideReturn = computed(() => {
    const role = this.session.user()?.role;
    return !!this.scope() && (role === 'OPERATOR' || role === 'ADMINISTRATOR');
  });

  private client(scope: OrdersScope): ApolloClient {
    return new ApolloClient(graphqlOptions(this.link, this.config.graphqlUrl, scope, scope));
  }

  async notifications(
    scope: OrdersScope,
    variables: OperatorOrderNotificationsQueryVariables,
    signal: AbortSignal,
  ) {
    const client = this.client(scope);
    try {
      const { data } = await client.query({
        query: OperatorOrderNotificationsDocument,
        variables,
        context: { fetchOptions: { signal } },
        fetchPolicy: 'no-cache',
      });
      if (!data) {
        throw new Error('Missing order notifications');
      }
      return data.orderNotifications;
    } finally {
      client.stop();
    }
  }

  async markNotificationsRead(scope: OrdersScope, orderId?: string): Promise<void> {
    const client = this.client(scope);
    try {
      const marked = orderId
        ? (
            await client.mutate({
              mutation: OperatorMarkOrderNotificationReadDocument,
              variables: { orderId },
            })
          ).data?.markOrderNotificationRead
        : (await client.mutate({ mutation: OperatorMarkAllOrderNotificationsReadDocument })).data
            ?.markAllOrderNotificationsRead;
      if (!marked) {
        throw new Error('Missing order notification read result');
      }
    } finally {
      client.stop();
    }
  }

  async returns(
    scope: OrdersScope,
    variables: OperatorOrderReturnsQueryVariables,
    signal: AbortSignal,
  ) {
    const client = this.client(scope);
    try {
      const { data } = await client.query({
        query: OperatorOrderReturnsDocument,
        variables,
        context: { fetchOptions: { signal } },
        fetchPolicy: 'no-cache',
      });
      if (!data) {
        throw new Error('Missing order returns');
      }
      return data.orderReturns;
    } finally {
      client.stop();
    }
  }

  async returnCase(scope: OrdersScope, id: string, signal: AbortSignal) {
    const client = this.client(scope);
    try {
      const { data } = await client.query({
        query: OperatorOrderReturnDocument,
        variables: { id },
        context: { fetchOptions: { signal } },
        fetchPolicy: 'no-cache',
      });
      if (!data) {
        throw new Error('Missing order return result');
      }
      return data.orderReturn;
    } finally {
      client.stop();
    }
  }

  async decideReturn(scope: OrdersScope, id: string, outcome: OrderReturnOutcome) {
    const client = this.client(scope);
    try {
      const { data } = await client.mutate({
        mutation: OperatorDecideOrderReturnDocument,
        variables: { id, outcome },
      });
      if (!data) {
        throw new Error('Missing order return decision');
      }
      return data.decideOrderReturn;
    } finally {
      client.stop();
    }
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

  async filterMethods(scope: OrdersScope, signal: AbortSignal) {
    const client = this.client(scope);
    try {
      const { data } = await client.query({
        query: OperatorOrderFilterMethodsDocument,
        context: { fetchOptions: { signal } },
        fetchPolicy: 'no-cache',
      });
      if (!data) {
        throw new Error('Missing order filter methods');
      }
      return data.orderFilterMethods;
    } finally {
      client.stop();
    }
  }

  async filterCustomer(scope: OrdersScope, id: string, signal: AbortSignal) {
    const client = this.client(scope);
    try {
      const { data } = await client.query({
        query: OperatorOrderFilterCustomerDocument,
        variables: { id },
        context: { fetchOptions: { signal } },
        fetchPolicy: 'no-cache',
      });
      if (!data) {
        throw new Error('Missing order filter customer');
      }
      return data.customerContact;
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

  async manualChoices(scope: OrdersScope, customerId: string | null) {
    const client = this.client(scope);
    try {
      const { data } = await client.query({
        query: OperatorManualOrderChoicesDocument,
        variables: { customerId: customerId ?? '', includeCustomer: !!customerId },
        fetchPolicy: 'no-cache',
      });
      if (!data) {
        throw new Error('Missing manual order choices');
      }
      return data;
    } finally {
      client.stop();
    }
  }

  async manualCustomers(scope: OrdersScope, search: string, signal: AbortSignal) {
    const client = this.client(scope);
    try {
      const { data } = await client.query({
        query: OperatorManualOrderCustomersDocument,
        variables: { search },
        context: { fetchOptions: { signal } },
        fetchPolicy: 'no-cache',
      });
      if (!data) {
        throw new Error('Missing manual order customers');
      }
      return data.customers.items;
    } finally {
      client.stop();
    }
  }

  async manualVariants(scope: OrdersScope, search: string, offset: number, signal: AbortSignal) {
    const client = this.client(scope);
    try {
      const { data } = await client.query({
        query: OperatorManualOrderVariantsDocument,
        variables: { search, offset },
        context: { fetchOptions: { signal } },
        fetchPolicy: 'no-cache',
      });
      if (!data) {
        throw new Error('Missing manual order variants');
      }
      return data.manualOrderVariants;
    } finally {
      client.stop();
    }
  }

  async createManual(scope: OrdersScope, input: ManualOrderInput) {
    const client = this.client(scope);
    try {
      const { data } = await client.mutate({
        mutation: OperatorCreateManualOrderDocument,
        variables: { input },
      });
      if (!data) {
        throw new Error('Missing created manual order');
      }
      return data.createManualOrder.id;
    } finally {
      client.stop();
    }
  }

  async updateManual(scope: OrdersScope, id: string, input: ManualOrderUpdateInput) {
    const client = this.client(scope);
    try {
      const { data } = await client.mutate({
        mutation: OperatorUpdateManualOrderDocument,
        variables: { id, input },
      });
      if (!data) {
        throw new Error('Missing updated manual order');
      }
      return data.updateManualOrder.id;
    } finally {
      client.stop();
    }
  }

  async invoices(scope: OrdersScope, variables: OperatorInvoicesQueryVariables) {
    const client = this.client(scope);
    try {
      const { data } = await client.query({
        query: OperatorInvoicesDocument,
        variables,
        fetchPolicy: 'no-cache',
      });
      if (!data) {
        throw new Error('Missing invoices result');
      }
      return data.invoices;
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

  async invoiceById(scope: OrdersScope, id: string) {
    const client = this.client(scope);
    try {
      const { data } = await client.query({
        query: OperatorInvoiceByIdDocument,
        variables: { id },
        fetchPolicy: 'no-cache',
      });
      if (!data) {
        throw new Error('Missing invoice result');
      }
      return data.invoice;
    } finally {
      client.stop();
    }
  }

  async issuerSettings(scope: OrdersScope) {
    const client = this.client(scope);
    try {
      const { data } = await client.query({
        query: OperatorInvoiceIssuerSettingsDocument,
        fetchPolicy: 'no-cache',
      });
      if (!data) {
        throw new Error('Missing invoice issuer settings result');
      }
      return data.invoiceIssuerSettings;
    } finally {
      client.stop();
    }
  }

  async saveIssuerSettings(scope: OrdersScope, input: InvoiceIssuerSettingsInput) {
    const client = this.client(scope);
    try {
      const { data } = await client.mutate({
        mutation: OperatorUpdateInvoiceIssuerSettingsDocument,
        variables: { input },
      });
      if (!data) {
        throw new Error('Missing updated invoice issuer settings result');
      }
      return data.updateInvoiceIssuerSettings;
    } finally {
      client.stop();
    }
  }

  async issueStandaloneInvoice(scope: OrdersScope, input: IssueStandaloneInvoiceInput) {
    const client = this.client(scope);
    try {
      const { data } = await client.mutate({
        mutation: OperatorIssueStandaloneInvoiceDocument,
        variables: { input },
      });
      if (!data) {
        throw new Error('Missing issued invoice result');
      }
      return data.issueStandaloneInvoice;
    } finally {
      client.stop();
    }
  }

  downloadInvoice(
    scope: OrdersScope,
    invoice: { id: string; orderId?: string | null },
  ): Promise<Blob> {
    const identifier = invoice.orderId ?? `document/${invoice.id}`;
    return firstValueFrom(
      this.http.get(`/documents/invoices/${identifier}/pdf`, {
        headers: { Authorization: `Bearer ${scope.token}`, 'x-branch-id': scope.branchId },
        responseType: 'blob',
      }),
    );
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
