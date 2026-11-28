import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  linkedSignal,
  resource,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink, RouterOutlet } from '@angular/router';
import { operatorStrings } from '@holita/operator';
import {
  FilterBuilder,
  PageHeader,
  TablePanel,
  UI_LANGUAGE,
  UrlListState,
  tableView,
  toneSeverity,
  uiMessages,
  type DrawerHost,
  type ListDefinition,
  type PageHeaderAction,
  type TableColumn,
} from '@osnova/ui';
import { MessageService } from 'primeng/api';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import type {
  AppointmentServiceColor,
  AppointmentServiceRowFragment,
  SalesAppointmentServicesQuery,
} from '../generated/appointment-services-operations';
import { appointmentServiceStrings } from './appointment-service-strings';
import { AppointmentServicesApi } from './appointment-services-api';

type ServicePage = SalesAppointmentServicesQuery['appointmentServices'];
const definition: ListDefinition<Record<string, never>, 'NAME'> = {
  pageSizes: [10, 20, 50, 100],
  defaultPageSize: 20,
  sorts: [],
  defaultSort: { field: 'NAME', direction: 'ASC' },
  filters: {},
};

@Component({
  selector: 'holita-appointment-services-page',
  imports: [PageHeader, TablePanel, FilterBuilder, RouterLink, RouterOutlet, TableModule, Tag],
  templateUrl: './appointment-services-page.html',
  host: { class: 'app-view' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppointmentServicesPage {
  private readonly api = inject(AppointmentServicesApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly messages = inject(MessageService);
  private readonly language = inject(UI_LANGUAGE);
  protected readonly text = computed(() => appointmentServiceStrings[this.language()]);
  protected readonly title = computed(() => operatorStrings[this.language()].appointmentServices);
  protected readonly shared = computed(() => uiMessages[this.language()]);
  protected readonly url = new UrlListState(definition, () => !!this.api.scope());
  protected readonly toneSeverity = toneSeverity;
  protected readonly trackByService = (_index: number, row: AppointmentServiceRowFragment) =>
    row.id;
  protected readonly actions = computed<readonly PageHeaderAction[]>(() => [
    { id: 'new', label: this.text().newService, primary: true },
  ]);
  protected readonly columns = computed<readonly TableColumn[]>(() => [
    {
      id: 'name',
      label: this.text().name,
      width: 'auto',
      kind: 'identity',
      className: 'app-col-identity',
    },
    { id: 'status', label: this.text().status, width: '7rem', kind: 'status' },
    {
      id: 'duration',
      label: this.text().durationMinutes,
      width: '10rem',
      className: 'app-table-merged-column',
    },
    {
      id: 'buffer',
      label: this.text().bufferMinutes,
      width: '7rem',
      className: 'app-table-merged-column',
    },
    {
      id: 'schedule',
      label: this.text().schedule,
      width: '14rem',
      className: 'app-table-merged-column',
    },
  ]);
  protected readonly list = resource({
    params: () => {
      const scope = this.api.scope();
      const { page, pageSize, search } = this.url.state();
      return scope
        ? { scope, variables: { offset: (page - 1) * pageSize, limit: pageSize, search } }
        : undefined;
    },
    loader: ({ params, abortSignal }) => this.api.list(params.scope, params.variables, abortSignal),
  });
  protected readonly page = linkedSignal<
    { scope: ReturnType<AppointmentServicesApi['scope']>; data: ServicePage | undefined },
    ServicePage | null
  >({
    source: () => ({
      scope: this.api.scope(),
      data: this.list.hasValue() ? this.list.value() : undefined,
    }),
    computation: (current, previous) =>
      current.data ?? (previous?.source.scope === current.scope ? (previous?.value ?? null) : null),
  });
  protected readonly view = computed(() =>
    tableView({
      loading: this.list.isLoading(),
      error: this.list.error(),
      rows: this.page()?.items.length ?? null,
      filtered: !!this.url.state().search,
    }),
  );
  protected readonly pagination = computed(() => ({
    page: this.url.state().page,
    pageSize: this.url.state().pageSize,
    total: this.page()?.total ?? 0,
  }));
  protected readonly drawerHost: DrawerHost = {
    saved: ({ message }) => {
      this.messages.add({ severity: 'success', summary: message });
      this.list.reload();
    },
  };

  constructor() {
    effect(() => {
      if (this.list.hasValue() && !this.list.isLoading()) {
        this.url.correctPage(Math.ceil(this.list.value().total / this.url.state().pageSize));
      }
    });
  }

  protected days(weekdays: readonly number[]): string {
    return weekdays.map((day) => this.text().shortDays[day - 1]).join(', ');
  }

  protected colorLabel(color: AppointmentServiceColor): string {
    return this.text().colors[color];
  }

  protected newService(): void {
    void this.router.navigate(['new'], {
      relativeTo: this.route,
      queryParamsHandling: 'preserve',
      preserveFragment: true,
    });
  }
}
