import { ChangeDetectionStrategy, Component, computed, inject, resource } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { OperatorLanguage, operatorStrings } from '@holita/operator';
import {
  KpiStrip,
  KpiTile,
  PageHeader,
  TablePanel,
  formatDateRange,
  formatDateTime,
  formatNumber,
  formatUtcInstant,
  injectDisplayFormat,
  interpolate,
  localeOf,
  tableView,
  trackById,
  type TableColumn,
} from '@osnova/ui';
import { ColumnSeries } from '@osnova/ui/charts';
import { Message } from 'primeng/message';
import { SelectButton } from 'primeng/selectbutton';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import type { DashboardPeriod } from '../generated/dashboard-operations';
import { orderAmount, orderStatusSeverity, orderStatusText } from '../orders/order-format';
import { DashboardApi } from './dashboard-api';

const periods = [
  { days: '7', period: 'DAYS_7' },
  { days: '14', period: 'DAYS_14' },
  { days: '30', period: 'DAYS_30' },
] as const satisfies readonly { days: string; period: DashboardPeriod }[];

@Component({
  selector: 'holita-dashboard-page',
  imports: [
    ColumnSeries,
    FormsModule,
    KpiStrip,
    KpiTile,
    Message,
    PageHeader,
    RouterLink,
    SelectButton,
    TableModule,
    TablePanel,
    Tag,
  ],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.scss',
  host: { class: 'app-view' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage {
  private readonly api = inject(DashboardApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly query = toSignal(this.route.queryParamMap, { requireSync: true });
  protected readonly language = inject(OperatorLanguage).value;
  protected readonly text = computed(() => operatorStrings[this.language()]);
  protected readonly scope = this.api.scope;
  protected readonly periodOptions = computed(() =>
    periods.map(({ days }) => ({
      value: days,
      label: interpolate(this.text().dashboardDays, { count: days }),
    })),
  );
  protected readonly selectedPeriod = computed(
    () => periods.find(({ days }) => days === this.query().get('days')) ?? periods[2],
  );

  protected readonly dashboard = resource({
    params: () => {
      const scope = this.scope();
      return scope ? { scope, period: this.selectedPeriod().period } : undefined;
    },
    loader: ({ params }) => this.api.read(params.scope, params.period),
  });
  protected readonly data = computed(() =>
    this.dashboard.hasValue() ? this.dashboard.value() : null,
  );
  protected readonly error = computed(() =>
    this.dashboard.error() ? this.text().dashboardUnavailable : null,
  );
  protected readonly range = computed(() => {
    const data = this.data();
    return data ? formatDateRange(data.startDate, data.endDate, this.language()) : null;
  });
  protected readonly asOf = computed(() => {
    const data = this.data();
    return data
      ? interpolate(this.text().dashboardAsOf, {
          time: formatDateTime(data.asOf, this.language(), data.timeZone),
        })
      : null;
  });
  protected readonly orderCount = computed(() => this.count(this.data()?.orderCount));
  protected readonly completedRevenue = computed(() => {
    const data = this.data();
    return data ? this.amount(data.completedRevenue, data.currency, this.language()) : null;
  });
  protected readonly newCustomers = computed(() => this.count(this.data()?.newCustomerCount));
  protected readonly outOfStock = computed(() => this.count(this.data()?.outOfStockVariantCount));

  protected readonly series = computed(() => {
    const data = this.data();
    if (!data) {
      return null;
    }
    const language = this.language();
    const label = new Intl.DateTimeFormat(localeOf(language), {
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    });
    const daily = data.daily.map((day) => ({
      ...day,
      key: day.date,
      label: label.format(new Date(`${day.date}T00:00:00Z`)),
    }));
    return {
      orders: daily.map(({ key, label, orderCount }) => ({
        key,
        label,
        value: orderCount,
        valueText: formatNumber(orderCount, language),
      })),
      revenue: daily.map(({ key, label, completedRevenue }) => ({
        key,
        label,
        value: Number(completedRevenue),
        valueText: this.amount(completedRevenue, data.currency, language),
      })),
    };
  });

  protected readonly columns = computed<readonly TableColumn[]>(() => [
    {
      id: 'number',
      label: this.text().order,
      width: 'auto',
      kind: 'identity',
      className: 'app-col-identity',
    },
    {
      id: 'placedAt',
      label: this.text().orderDate,
      width: '12rem',
      kind: 'date',
      className: 'app-table-merged-column',
    },
    {
      id: 'status',
      label: this.text().orderStatus,
      width: '10rem',
      kind: 'status',
      className: 'app-table-merged-column',
    },
    { id: 'total', label: this.text().orderTotal, width: '9rem', kind: 'number' },
  ]);
  protected readonly recent = computed(() => this.data()?.recentOrders ?? []);
  protected readonly view = computed(() =>
    tableView({
      loading: this.dashboard.isLoading(),
      error: this.dashboard.error(),
      rows: this.data()?.recentOrders.length ?? null,
      filtered: false,
    }),
  );
  protected readonly trackById = trackById;
  protected readonly amount = orderAmount;
  protected readonly statusText = orderStatusText;
  protected readonly statusSeverity = orderStatusSeverity;
  protected readonly utc = formatUtcInstant;
  private readonly format = injectDisplayFormat();

  protected dateTime(instant: string): string {
    return formatDateTime(
      instant,
      this.language(),
      this.data()?.timeZone ?? this.format.preferences().timeZone,
    );
  }

  protected changeDays(value: string): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { days: value === '30' ? null : value },
      queryParamsHandling: 'merge',
    });
  }

  private count(value: number | undefined): string | null {
    return value === undefined ? null : formatNumber(value, this.language());
  }
}
