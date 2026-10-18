import { Component, signal, viewChild } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { UI_LANGUAGE } from '../ui-language';
import { TablePanel, type TableNotice, type TablePage } from './table-panel';
import type { TableView } from './table-view';

@Component({
  imports: [TablePanel],
  template: `
    <holita-table-panel
      heading="Превозни средства"
      [headingLevel]="level()"
      [total]="total()"
      [view]="view()"
      errorText="Няма връзка (fixture-AdminVehicles)"
      [busy]="busy()"
      emptyTitle="Все още няма превозни средства"
      [notice]="notice()"
      [selectedCount]="selected()"
      selectionProgress="Изтриване 1 от 3"
      [page]="page()"
      (retry)="events.push('retry')"
      (clearFilters)="events.push('clear')"
      (dismissNotice)="events.push('dismiss')"
      (clearSelection)="events.push('unselect')"
      (pageChange)="pages.push($event)"
    >
      <button panelActions type="button" class="refresh">Обнови</button>
      <button emptyActions type="button" class="create">Ново</button>
      <button bulkActions type="button" class="delete">Изтрий</button>
      <table class="rows">
        <tbody>
          <tr>
            <td>CB 1001 AX</td>
          </tr>
        </tbody>
      </table>
    </holita-table-panel>
  `,
})
class Host {
  readonly level = signal<2 | 3>(2);
  readonly total = signal<number | null>(1250);
  readonly view = signal<TableView>({ kind: 'loading' });
  readonly busy = signal(false);
  readonly notice = signal<TableNotice | null>(null);
  readonly selected = signal(0);
  readonly page = signal<TablePage | null>({ page: 2, pageSize: 20, total: 45 });
  readonly events: string[] = [];
  readonly pages: { page: number; pageSize: number }[] = [];
  readonly panel = viewChild.required(TablePanel);
}

function element(fixture: ComponentFixture<Host>): HTMLElement {
  const value: unknown = fixture.nativeElement;
  if (!(value instanceof HTMLElement)) throw new Error('Missing host element.');
  return value;
}

describe('TablePanel', () => {
  function render() {
    TestBed.configureTestingModule({
      providers: [{ provide: UI_LANGUAGE, useValue: signal('bg') }],
    });
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    return fixture;
  }

  it('renders the heading with a grouped count and the loading skeleton', () => {
    const fixture = render();
    const root = element(fixture);
    const heading = root.querySelector('h2.table-panel__heading');
    expect(heading?.textContent).toContain('Превозни средства');
    expect(root.querySelector('.table-panel__count')?.textContent).toBe('1 250');
    expect(root.querySelectorAll('.table-panel__skeleton-row').length).toBe(8);
    expect(root.querySelector('.table-panel__table')?.hasAttribute('hidden')).toBe(true);
    expect(root.querySelector('.table-panel__actions .refresh')).not.toBeNull();
    fixture.componentInstance.level.set(3);
    fixture.detectChanges();
    expect(root.querySelector('h3.table-panel__heading')).not.toBeNull();
    fixture.componentInstance.panel().focusHeading();
    expect(document.activeElement).toBe(root.querySelector('h3.table-panel__heading'));
  });

  it('shows every empty and error state with its action', () => {
    const fixture = render();
    const root = element(fixture);
    const host = fixture.componentInstance;
    host.view.set({ kind: 'empty' });
    fixture.detectChanges();
    expect(root.querySelector('holita-empty-state')?.textContent).toContain(
      'Все още няма превозни средства',
    );
    expect(root.querySelector('holita-empty-state .create')).not.toBeNull();
    host.view.set({ kind: 'no-results' });
    fixture.detectChanges();
    root.querySelector<HTMLButtonElement>('holita-empty-state button')?.click();
    host.view.set({ kind: 'error' });
    fixture.detectChanges();
    expect(root.querySelector('holita-empty-state')?.getAttribute('role')).toBe('alert');
    expect(root.querySelector('holita-empty-state')?.textContent).toContain(
      'fixture-AdminVehicles',
    );
    root.querySelector<HTMLButtonElement>('holita-empty-state button')?.click();
    host.view.set({ kind: 'rows-error' });
    fixture.detectChanges();
    expect(root.querySelector('.table-panel__inline-error')?.getAttribute('role')).toBe('alert');
    expect(root.querySelector('.table-panel__table')?.hasAttribute('hidden')).toBe(false);
    root.querySelector<HTMLButtonElement>('.table-panel__inline-error button')?.click();
    expect(host.events).toEqual(['clear', 'retry', 'retry']);
  });

  it('shows the refresh bar, notices, the bulk bar and paginator events with rows', () => {
    const fixture = render();
    const root = element(fixture);
    const host = fixture.componentInstance;
    host.view.set({ kind: 'rows' });
    host.busy.set(true);
    host.notice.set({ severity: 'success', text: 'Превозното средство е запазено.' });
    host.selected.set(3);
    fixture.detectChanges();
    expect(root.querySelector('.table-panel__progress')?.getAttribute('aria-hidden')).toBe('true');
    expect(root.querySelector('section')?.getAttribute('aria-busy')).toBe('true');
    expect(root.querySelector('.table-panel__notice')?.getAttribute('role')).toBe('status');
    expect(root.querySelector('.table-panel__notice')?.textContent).toContain('запазено');
    const bulk = root.querySelector('.table-panel__bulk');
    expect(bulk?.getAttribute('role')).toBe('region');
    expect(bulk?.textContent).toContain('3 избрани');
    expect(bulk?.textContent).toContain('Изтриване 1 от 3');
    expect(bulk?.querySelector('.delete')).not.toBeNull();
    root.querySelector<HTMLButtonElement>('.table-panel__bulk-clear')?.click();
    expect(root.querySelector('.p-paginator-current')?.textContent).toContain('21–40 от 45');
    root.querySelector<HTMLButtonElement>('.p-paginator-next')?.click();
    expect(host.pages).toEqual([{ page: 3, pageSize: 20 }]);
    expect(host.events).toEqual(['unselect']);
  });
});
