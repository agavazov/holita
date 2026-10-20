import { TestBed, type ComponentFixture } from '@angular/core/testing';
import {
  ActivatedRoute,
  Router,
  convertToParamMap,
  provideRouter,
  type Params,
} from '@angular/router';
import { MessageService } from 'primeng/api';
import { BehaviorSubject } from 'rxjs';
import type { FilterCondition } from '../../../ui/filter-builder/filter-model';
import { VehicleChoices } from './vehicle-choices';
import { vehicleViewQuery } from './vehicle-query';
import { VehiclesApi } from './vehicles-api';
import { VehiclesPage } from './vehicles-page';

const condition: FilterCondition = {
  id: 'active',
  field: 'status',
  operator: 'isAnyOf',
  values: ['ACTIVE'],
};

describe('Vehicles presentation query boundary', () => {
  const fixtures: ComponentFixture<VehiclesPage>[] = [];

  function mount(params: Params) {
    const queryParams = new BehaviorSubject(convertToParamMap(params));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        MessageService,
        { provide: ActivatedRoute, useValue: { queryParamMap: queryParams.asObservable() } },
      ],
    });
    TestBed.overrideComponent(VehiclesPage, {
      set: {
        template: '',
        providers: [
          { provide: VehiclesApi, useValue: {} },
          { provide: VehicleChoices, useValue: {} },
        ],
      },
    });
    const fixture = TestBed.createComponent(VehiclesPage);
    fixtures.push(fixture);
    fixture.componentRef.setInput('branch', {
      id: '10000000-0000-4000-8000-000000000001',
      name: 'Discordia',
    });
    fixture.componentRef.setInput('language', 'en');
    return { page: fixture.componentInstance, router: TestBed.inject(Router) };
  }

  afterEach(() => {
    for (const fixture of fixtures.splice(0)) {
      fixture.destroy();
    }
    vi.restoreAllMocks();
  });

  it('clears search and conditions together rather than treating clear-all as a debounced search', () => {
    const { page } = mount({ search: 'alpha', conditions: JSON.stringify([condition]), page: '3' });
    const apply = vi.spyOn(page.url, 'setState').mockImplementation(() => undefined);
    const editSearch = vi.spyOn(page.url, 'editSearch');
    page.changeState({
      ...vehicleViewQuery(page.url.state()),
      search: '',
      conditions: [],
      page: 1,
    });
    expect(editSearch).not.toHaveBeenCalled();
    expect(apply).toHaveBeenCalledWith(
      expect.objectContaining({ search: '', filter: { conditions: [] }, page: 1 }),
    );
  });

  it('resets the page when the presentation changes its page size', () => {
    const { page } = mount({ search: 'alpha', page: '3' });
    const apply = vi.spyOn(page.url, 'setState').mockImplementation(() => undefined);
    page.changeState({ ...vehicleViewQuery(page.url.state()), pageSize: 50 });
    expect(apply).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'alpha', page: 1, pageSize: 50 }),
    );
  });

  it('retires an unsent search and restores the applied draft before opening an editor', () => {
    const { page, router } = mount({ search: 'applied' });
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    page.url.editSearch('unsent draft');
    const cancel = vi.spyOn(page.url, 'cancelPending');
    page.openEditor(null);
    expect(cancel).toHaveBeenCalledOnce();
    expect(page.url.searchDraft()).toBe('applied');
    expect(navigate).toHaveBeenCalledWith(
      ['new'],
      expect.objectContaining({ queryParamsHandling: 'preserve', preserveFragment: true }),
    );
  });

  it('opens a real profile tab and retires an unsent search while preserving the applied list URL', async () => {
    const { page, router } = mount({ search: 'applied', page: '2' });
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    page.url.editSearch('unsent draft');
    const id = '50000000-0000-4000-8000-000000000001';
    await page.run({ action: 'profile', ids: [id] });
    expect(page.url.searchDraft()).toBe('applied');
    expect(navigate).toHaveBeenCalledWith(
      [id, 'overview'],
      expect.objectContaining({ queryParamsHandling: 'preserve', preserveFragment: true }),
    );
  });
});
