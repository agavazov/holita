import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
  ROUTER_OUTLET_DATA,
} from '@angular/router';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';
import { AlertsView } from '../../../app/features/fleet/alerts/alerts-view';
import type { ListQuery } from '../../../app/ui/list/list-query';
import { UI_LANGUAGE } from '../../../app/ui/ui-language';
import { sampleAlerts } from '../fleet-samples';
import { initialQuery } from '../sample-list';
import { AlertsPage, sampleAlertKpis } from './alerts-page';

describe('Sample alert counts', () => {
  it('counts matching search and non-status AND conditions across pages, including older resolved alerts', () => {
    const first = sampleAlerts[0];
    const other = sampleAlerts.find((item) => item.vehicleId !== first?.vehicleId);
    if (!first || !other) {
      throw new Error('Missing distinct sample alert vehicles.');
    }
    const alerts = [
      { ...first, id: 'open', detail: 'Matching fixture', status: 'OPEN', severity: 'CRITICAL' },
      {
        ...first,
        id: 'handled',
        detail: 'Matching fixture',
        status: 'ACKNOWLEDGED',
        severity: 'WARNING',
      },
      {
        ...first,
        id: 'historical',
        detail: 'Matching fixture',
        status: 'RESOLVED',
        severity: 'WARNING',
        occurredAt: '2026-09-01T06:00:00.000Z',
      },
      {
        ...other,
        id: 'other-vehicle',
        detail: 'Matching fixture',
        status: 'OPEN',
        severity: 'WARNING',
      },
      {
        ...first,
        id: 'other-search',
        detail: 'Different fixture',
        status: 'OPEN',
        severity: 'WARNING',
      },
    ] satisfies typeof sampleAlerts;
    const query: ListQuery = {
      ...initialQuery({ field: 'occurredAt', direction: 'desc' }, 1),
      search: 'Matching',
      conditions: [
        { id: 'vehicle', field: 'vehicle', operator: 'isAnyOf', values: [first.vehicleId] },
        { id: 'warning', field: 'severity', operator: 'isAnyOf', values: ['WARNING'] },
      ],
    };
    expect(sampleAlertKpis(alerts, query)).toEqual({
      critical: 0,
      open: 0,
      acknowledged: 1,
      resolved: 1,
    });
    expect(
      sampleAlertKpis(alerts, {
        ...query,
        page: 3,
        conditions: [
          ...query.conditions,
          { id: 'open', field: 'status', operator: 'isAnyOf', values: ['OPEN'] },
          { id: 'not-resolved', field: 'status', operator: 'isNoneOf', values: ['RESOLVED'] },
        ],
      }),
    ).toEqual({ critical: 0, open: 0, acknowledged: 1, resolved: 1 });
  });
});

describe('Alerts sample filtered counts', () => {
  let fixture: ComponentFixture<AlertsPage>;
  let view: AlertsView;

  beforeEach(async () => {
    const query = convertToParamMap({});
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        MessageService,
        { provide: UI_LANGUAGE, useValue: signal('en') },
        { provide: ROUTER_OUTLET_DATA, useValue: signal('Example Branch') },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: query }, queryParamMap: of(query) },
        },
      ],
    });
    fixture = TestBed.createComponent(AlertsPage);
    await fixture.whenStable();
    view = fixture.debugElement.query(By.directive(AlertsView)).injector.get(AlertsView);
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('wires the real sample host summary to search and severity while excluding status filters', async () => {
    view.stateChange.emit({
      ...view.state(),
      search: 'fuel',
      pageSize: 1,
      conditions: [
        ...view.state().conditions,
        { id: 'warning', field: 'severity', operator: 'isAnyOf', values: ['WARNING'] },
      ],
    });
    await fixture.whenStable();
    expect(view.total()).toBe(4);
    expect(view.rows()).toHaveLength(1);
    expect(view.kpis()).toEqual({ critical: 0, open: 2, acknowledged: 2, resolved: 2 });

    view.stateChange.emit({
      ...view.state(),
      conditions: [
        ...view.state().conditions,
        { id: 'resolved', field: 'status', operator: 'isAnyOf', values: ['RESOLVED'] },
      ],
    });
    await fixture.whenStable();
    expect(view.total()).toBe(0);
    expect(view.kpis()).toEqual({ critical: 0, open: 2, acknowledged: 2, resolved: 2 });
  });
});
