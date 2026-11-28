import {
  computed,
  inject,
  Injectable,
  linkedSignal,
  resource,
  signal,
  type Signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { isActive, Router } from '@angular/router';
import { OperatorLanguage, operatorStrings } from '@holita/operator';
import { injectDisplayFormat, interpolate } from '@osnova/ui';
import { timer } from 'rxjs';
import { OrdersApi } from './orders-api';

type NotificationScope = NonNullable<ReturnType<OrdersApi['scope']>>;

@Injectable({ providedIn: 'root' })
export class OrderNotifications {
  private readonly api = inject(OrdersApi);
  private readonly router = inject(Router);
  private readonly format = injectDisplayFormat();
  private readonly language = inject(OperatorLanguage).value;
  private readonly activeBranch = signal<Signal<string | null> | null>(null);
  readonly text = computed(() => operatorStrings[this.language()]);
  readonly scope = computed(() => {
    const scope = this.api.scope();
    return scope && scope.branchId === this.activeBranch()?.() ? scope : null;
  });
  readonly canWrite = computed(() => !!this.scope() && this.api.canWrite());
  private readonly feed = resource({
    params: () => this.scope() ?? undefined,
    loader: ({ params, abortSignal }) =>
      this.api.notifications(params, { offset: 0, limit: 5 }, abortSignal),
  });
  private readonly revision = signal(0);
  readonly refresh = this.revision.asReadonly();
  private readonly saving = linkedSignal({ source: this.scope, computation: () => false });
  private readonly saveFailed = linkedSignal({ source: this.scope, computation: () => false });
  readonly busy = this.saving.asReadonly();
  readonly loading = this.feed.isLoading;
  readonly items = computed(() => {
    if (!this.scope()) {
      return null;
    }
    const items = this.feed.hasValue() ? this.feed.value().items : [];
    return items.map(({ orderId, orderNumber, placedAt, readAt }) => ({
      id: orderId,
      title: interpolate(this.text().newOrderNotification, { number: orderNumber }),
      at: placedAt,
      atTitle: this.format.utc(placedAt),
      unread: !readAt,
    }));
  });
  readonly unreadCount = computed(() => (this.feed.hasValue() ? this.feed.value().unreadCount : 0));
  readonly writeError = computed(() =>
    this.saveFailed() ? this.text().orderNotificationsUpdateFailed : null,
  );
  readonly error = computed(() =>
    this.feed.error() ? this.text().orderNotificationsUnavailable : null,
  );
  readonly seeAllLink = computed(() => ['/', this.language(), 'order-notifications']);

  constructor() {
    timer(30_000, 30_000)
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        if (this.scope()) {
          this.reload();
        }
      });
  }

  connect(activeBranch: Signal<string | null>): void {
    this.activeBranch.set(activeBranch);
  }

  reload(): void {
    this.feed.reload();
    this.revision.update((revision) => revision + 1);
  }

  async open(
    orderId: string,
    unread = this.items()?.find((item) => item.id === orderId)?.unread ?? false,
  ): Promise<void> {
    const scope = this.scope();
    if (!scope) {
      return;
    }
    const target = this.router.createUrlTree(['/', scope.language, 'orders', orderId]);
    const alreadyOpen = isActive(target, this.router, {
      paths: 'exact',
      queryParams: 'ignored',
      fragment: 'ignored',
      matrixParams: 'ignored',
    })();
    const opened = alreadyOpen || (await this.router.navigateByUrl(target));
    if (opened && unread) {
      await this.markRead(scope, orderId);
    }
  }

  async markAllRead(): Promise<void> {
    const scope = this.scope();
    if (scope) {
      await this.markRead(scope);
    }
  }

  private async markRead(scope: NotificationScope, orderId?: string): Promise<void> {
    if (this.scope() !== scope || !this.canWrite() || this.busy()) {
      return;
    }
    this.saving.set(true);
    this.saveFailed.set(false);
    try {
      await this.api.markNotificationsRead(scope, orderId);
      if (this.scope() === scope) {
        this.reload();
      }
    } catch {
      if (this.scope() === scope) {
        this.saveFailed.set(true);
      }
    } finally {
      if (this.scope() === scope) {
        this.saving.set(false);
      }
    }
  }
}
