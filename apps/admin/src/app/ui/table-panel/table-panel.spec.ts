import { Component, signal, viewChild } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ConfirmationService } from 'primeng/api';
import type { ListActionBase, ListActionRequest, ListRecord } from '../list/list-actions';
import { UI_LANGUAGE } from '../ui-language';
import { TablePanel, type TablePage } from './table-panel';
import type { TableView } from './table-view';

type ActionId = 'archive' | 'delete' | 'pin';

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
      [actionContext]="actionContext()"
      emptyTitle="Все още няма превозни средства"
      [actions]="actions"
      [selection]="selection()"
      selectionProgress="Изтриване 1 от 3"
      [page]="page()"
      (retry)="events.push('retry')"
      (clearFilters)="events.push('clear')"
      (clearSelection)="events.push('unselect')"
      (pageChange)="pages.push($event)"
      (action)="request($event)"
    >
      <button panelActions type="button" class="refresh">Обнови</button>
      <button emptyActions type="button" class="create">Ново</button>
      <table class="rows">
        <tbody>
          @if (!archived()) {
            <tr>
              <td>CB 1001 AX</td>
              <td><button type="button" class="row-trigger">⋮</button></td>
            </tr>
          }
          @for (id of order(); track id) {
            <tr>
              <td><button type="button" [class]="'moving-trigger moving-' + id">⋮</button></td>
            </tr>
          }
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
  readonly actionContext = signal('initial-query');
  readonly actions: readonly ListActionBase<ActionId>[] = [
    { id: 'archive', label: 'Архивирай', bulk: true },
    { id: 'pin', label: 'Закачи най-горе' },
    {
      id: 'delete',
      label: 'Изтрий',
      bulk: true,
      danger: true,
      confirm: {
        title: 'Изтриване на превозни средства?',
        accept: 'Изтрий',
      },
    },
  ];
  readonly selection = signal<readonly ListRecord<ActionId>[]>([]);
  readonly requests: ListActionRequest<ActionId>[] = [];
  /** The list shows active vehicles only: archiving takes the row out of it. */
  readonly archived = signal(false);
  /** Pinning sorts a row to the top: it stays in the list but moves. */
  readonly order = signal<readonly string[]>(['x', 'y']);
  readonly page = signal<TablePage | null>({ page: 2, pageSize: 20, total: 45 });
  readonly events: string[] = [];
  readonly pages: { page: number; pageSize: number }[] = [];
  readonly panel = viewChild.required<TablePanel<ActionId>>(TablePanel);

  request(request: ListActionRequest<ActionId>): void {
    this.requests.push(request);
    if (request.action === 'archive') {
      this.archived.set(true);
    }
    if (request.action === 'pin') {
      this.order.update((order) => [
        ...request.ids,
        ...order.filter((id) => !request.ids.includes(id)),
      ]);
    }
  }
}

function element(fixture: ComponentFixture<Host>): HTMLElement {
  const value: unknown = fixture.nativeElement;
  if (!(value instanceof HTMLElement)) {
    throw new Error('Missing host element.');
  }
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

  it('renders the heading, the loading skeleton without a count, then the grouped count', () => {
    const fixture = render();
    const root = element(fixture);
    const heading = root.querySelector('h2.table-panel__heading');
    expect(heading?.textContent).toContain('Превозни средства');
    expect(root.querySelector('.table-panel__count')).toBeNull();
    expect(root.querySelectorAll('.table-panel__skeleton-row').length).toBe(8);
    expect(root.querySelector('.table-panel__table')?.hasAttribute('hidden')).toBe(true);
    expect(root.querySelector('.table-panel__actions .refresh')).not.toBeNull();
    fixture.componentInstance.level.set(3);
    fixture.detectChanges();
    expect(root.querySelector('h3.table-panel__heading')).not.toBeNull();
    fixture.componentInstance.panel().focusHeading();
    expect(document.activeElement).toBe(root.querySelector('h3.table-panel__heading'));
    fixture.componentInstance.view.set({ kind: 'rows' });
    fixture.detectChanges();
    expect(root.querySelector('.table-panel__count')?.textContent).toMatch(/^1\s250$/);
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

  it('shows the refresh bar, the bulk bar and paginator events with rows', () => {
    const fixture = render();
    const root = element(fixture);
    const host = fixture.componentInstance;
    host.view.set({ kind: 'rows' });
    host.busy.set(true);
    host.selection.set([
      { id: 'a', label: 'CB 1001 AX', unavailable: [] },
      { id: 'b', label: 'CB 1002 AX', unavailable: [] },
      { id: 'c', label: 'CB 1003 AX', unavailable: ['archive'] },
    ]);
    fixture.detectChanges();
    expect(root.querySelector('.table-panel__progress')?.getAttribute('aria-hidden')).toBe('true');
    expect(root.querySelector('section')?.getAttribute('aria-busy')).toBe('true');
    const bulk = root.querySelector('.table-panel__bulk');
    expect(bulk?.getAttribute('role')).toBe('region');
    expect(bulk?.textContent).toContain('3 избрани');
    expect(bulk?.textContent).toContain('Изтриване 1 от 3');
    const buttons = [...(bulk?.querySelectorAll('.table-panel__bulk-actions button') ?? [])];
    expect(buttons.map((button) => button.textContent.trim())).toEqual(['Архивирай', 'Изтрий']);
    buttons[0]?.dispatchEvent(new MouseEvent('click'));
    expect(host.requests).toEqual([]);
    host.busy.set(false);
    fixture.detectChanges();
    buttons[0]?.dispatchEvent(new MouseEvent('click'));
    expect(host.requests).toEqual([{ action: 'archive', ids: ['a', 'b'] }]);
    root.querySelector<HTMLButtonElement>('.table-panel__bulk-clear')?.click();
    expect(root.querySelector('.p-paginator-current')?.textContent).toContain('21–40 от 45');
    root.querySelector<HTMLButtonElement>('.p-paginator-next')?.click();
    expect(host.pages).toEqual([{ page: 3, pageSize: 20 }]);
    expect(host.events).toEqual(['unselect']);
  });

  it('keeps the page size reachable on one page and lists the size in use', async () => {
    const fixture = render();
    const root = element(fixture);
    const host = fixture.componentInstance;
    host.view.set({ kind: 'rows' });
    host.page.set({ page: 1, pageSize: 100, total: 45 });
    fixture.detectChanges();
    expect(root.querySelector('.p-paginator-rpp-dropdown')).not.toBeNull();
    expect(root.querySelector('.p-paginator-pages')).toBeNull();
    expect(root.querySelector('.p-paginator-first')).toBeNull();
    // A short list keeps the paginator (range and size) without page links.
    host.page.set({ page: 1, pageSize: 20, total: 8 });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(root.querySelector('.p-paginator-current')?.textContent).toContain('1–8 от 8');
    expect(root.querySelector('.p-paginator-pages')).toBeNull();
    expect(root.querySelector('.p-paginator-rpp-dropdown')).not.toBeNull();
  });

  it('confirms an action for the records it applies to and emits only their IDs', async () => {
    const fixture = render();
    const host = fixture.componentInstance;
    host.view.set({ kind: 'rows' });
    fixture.detectChanges();
    const confirmation = fixture.debugElement
      .query(By.directive(TablePanel))
      .injector.get(ConfirmationService);
    const asked: string[] = [];
    vi.spyOn(confirmation, 'confirm').mockImplementation((options) => {
      asked.push(options.header ?? '');
      options.accept?.();
      return confirmation;
    });
    const records: readonly ListRecord<ActionId>[] = [
      { id: 'a', label: 'CB 1001 AX', unavailable: [] },
      { id: 'c', label: 'CB 1003 AX', unavailable: ['delete'] },
    ];
    await host.panel().run('delete', records, null);
    expect(asked).toEqual(['Изтриване на превозни средства?']);
    expect(host.requests).toEqual([{ action: 'delete', ids: ['a'] }]);
    // Nothing to do when the action applies to none of the records: no question, no request.
    await host.panel().run(
      'delete',
      records.filter((record) => record.id === 'c'),
      null,
    );
    expect(asked).toHaveLength(1);
    expect(host.requests).toHaveLength(1);
  });

  it('retires a confirmation when its query changes, ignores a late accept and restores heading focus', async () => {
    const fixture = render();
    const host = fixture.componentInstance;
    const confirmation = fixture.debugElement
      .query(By.directive(TablePanel))
      .injector.get(ConfirmationService);
    const lateAccepts: (() => void)[] = [];
    vi.spyOn(confirmation, 'confirm').mockImplementation((options) => {
      lateAccepts.push(() => {
        options.accept?.();
      });
      return confirmation;
    });
    const close = vi.spyOn(confirmation, 'close');
    const pending = host
      .panel()
      .run('delete', [{ id: 'a', label: 'Previous query row', unavailable: [] }], null);
    host.actionContext.set('restored-query');
    fixture.detectChanges();
    await pending;
    lateAccepts[0]?.();
    await Promise.resolve();
    expect(close).toHaveBeenCalledOnce();
    expect(host.requests).toEqual([]);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.activeElement).toBe(element(fixture).querySelector('.table-panel__heading'));
  });

  it('keeps a confirmation through an unrelated refresh and submits once after it settles', async () => {
    const fixture = render();
    const host = fixture.componentInstance;
    const confirmation = fixture.debugElement
      .query(By.directive(TablePanel))
      .injector.get(ConfirmationService);
    const accepts: (() => void)[] = [];
    vi.spyOn(confirmation, 'confirm').mockImplementation((options) => {
      accepts.push(() => options.accept?.());
      return confirmation;
    });
    const close = vi.spyOn(confirmation, 'close');
    const records: readonly ListRecord<ActionId>[] = [
      { id: 'a', label: 'CB 1001 AX', unavailable: [] },
    ];
    const pending = host.panel().run('delete', records, null);
    host.busy.set(true);
    fixture.detectChanges();
    await Promise.resolve();
    expect(close).not.toHaveBeenCalled();
    // A repeated trigger cannot open another confirmation or submit another action.
    await host.panel().run('delete', records, null);
    expect(accepts).toHaveLength(1);
    expect(host.requests).toEqual([]);
    host.busy.set(false);
    fixture.detectChanges();
    accepts[0]?.();
    await pending;
    accepts[0]?.();
    expect(host.requests).toEqual([{ action: 'delete', ids: ['a'] }]);
  });

  it('does not submit a confirmation accepted while the list is busy', async () => {
    const fixture = render();
    const host = fixture.componentInstance;
    const confirmation = fixture.debugElement
      .query(By.directive(TablePanel))
      .injector.get(ConfirmationService);
    const accepts: (() => void)[] = [];
    vi.spyOn(confirmation, 'confirm').mockImplementation((options) => {
      accepts.push(() => options.accept?.());
      return confirmation;
    });
    const records: readonly ListRecord<ActionId>[] = [
      { id: 'a', label: 'CB 1001 AX', unavailable: [] },
    ];
    const pending = host.panel().run('delete', records, null);
    host.busy.set(true);
    fixture.detectChanges();
    accepts[0]?.();
    await pending;
    await host.panel().run('delete', records, null);
    expect(accepts).toHaveLength(1);
    expect(host.requests).toEqual([]);
  });

  it.each(['disabled', 'removed'] as const)(
    'restores heading focus after cancellation when its origin is %s',
    async (state) => {
      const fixture = render();
      const host = fixture.componentInstance;
      host.view.set({ kind: 'rows' });
      fixture.detectChanges();
      const trigger = element(fixture).querySelector<HTMLButtonElement>('.row-trigger');
      if (!trigger) throw new Error('Missing row trigger.');
      trigger.focus();
      const confirmation = fixture.debugElement
        .query(By.directive(TablePanel))
        .injector.get(ConfirmationService);
      const rejects: (() => void)[] = [];
      vi.spyOn(confirmation, 'confirm').mockImplementation((options) => {
        rejects.push(() => options.reject?.());
        return confirmation;
      });
      const pending = host
        .panel()
        .run('delete', [{ id: 'a', label: 'CB 1001 AX', unavailable: [] }], trigger);
      if (state === 'disabled') trigger.disabled = true;
      else trigger.remove();
      rejects[0]?.();
      await pending;
      fixture.detectChanges();
      await fixture.whenStable();
      expect(host.requests).toEqual([]);
      expect(document.activeElement).toBe(element(fixture).querySelector('.table-panel__heading'));
    },
  );

  it('settles and retires an unsubmitted confirmation when the panel is destroyed', async () => {
    const fixture = render();
    const host = fixture.componentInstance;
    const confirmation = fixture.debugElement
      .query(By.directive(TablePanel))
      .injector.get(ConfirmationService);
    const lateAccepts: (() => void)[] = [];
    vi.spyOn(confirmation, 'confirm').mockImplementation((options) => {
      lateAccepts.push(() => {
        options.accept?.();
      });
      return confirmation;
    });
    const pending = host
      .panel()
      .run('delete', [{ id: 'a', label: 'Retired workspace row', unavailable: [] }], null);
    fixture.destroy();
    await pending;
    lateAccepts[0]?.();
    await Promise.resolve();
    expect(host.requests).toEqual([]);
  });

  it.each([1, 10])(
    'lists all %i records in the same confirmation and emits their IDs',
    async (count) => {
      const fixture = render();
      const host = fixture.componentInstance;
      host.view.set({ kind: 'rows' });
      fixture.detectChanges();
      const records: readonly ListRecord<ActionId>[] = Array.from(
        { length: count },
        (_, index) => ({
          id: String(index),
          label: `CB ${String(1001 + index)} AX`,
          unavailable: [],
        }),
      );
      const answer = host.panel().run('delete', records, null, count === 1 ? 'row' : 'bulk');
      await fixture.whenStable();
      const dialog = document.querySelector('.p-confirmdialog');
      expect(dialog?.querySelector('.p-dialog-title')?.textContent.trim()).toBe(
        'Изтриване на превозни средства?',
      );
      const items = [...(dialog?.querySelectorAll('.table-panel__confirm-records li') ?? [])];
      expect(items.map((item) => item.textContent.trim())).toEqual(
        records.map((record) => record.label),
      );
      expect(items.map((item) => item.getAttribute('title'))).toEqual(
        records.map((record) => record.label),
      );
      expect(dialog?.querySelector('.table-panel__confirm-count')?.textContent.trim()).toBe(
        `Записи: ${String(count)}`,
      );
      // The records below the question are the dialog's description.
      const description = document.getElementById(dialog?.getAttribute('aria-describedby') ?? '');
      expect(description?.textContent).toContain(records.at(-1)?.label);
      dialog?.querySelector<HTMLButtonElement>('.p-confirmdialog-accept-button')?.click();
      await answer;
      expect(host.requests).toEqual([
        { action: 'delete', ids: records.map((record) => record.id) },
      ]);
      await vi.waitFor(() => {
        expect(document.querySelector('.p-confirmdialog')).toBeNull();
      });
    },
  );

  it('moves focus to the heading when a row action takes its own row out of the list', async () => {
    const fixture = render();
    const root = element(fixture);
    const host = fixture.componentInstance;
    host.view.set({ kind: 'rows' });
    fixture.detectChanges();
    const trigger = root.querySelector<HTMLButtonElement>('.row-trigger');
    if (!trigger) {
      throw new Error('Missing row trigger.');
    }
    trigger.focus();
    // Archive needs no confirmation, and the host's change removes the row with its trigger.
    await host.panel().run('archive', [{ id: 'a', label: 'CB 1001 AX', unavailable: [] }], trigger);
    await fixture.whenStable();
    expect(host.requests).toEqual([{ action: 'archive', ids: ['a'] }]);
    expect(trigger.isConnected).toBe(false);
    expect(document.activeElement).toBe(root.querySelector('h2.table-panel__heading'));
  });

  it('keeps the focus on the trigger of a row the action moved', async () => {
    const fixture = render();
    const root = element(fixture);
    const host = fixture.componentInstance;
    host.view.set({ kind: 'rows' });
    fixture.detectChanges();
    const trigger = root.querySelector<HTMLButtonElement>('.moving-y');
    if (!trigger) {
      throw new Error('Missing row trigger.');
    }
    trigger.focus();
    await host.panel().run('pin', [{ id: 'y', label: 'CB 1002 AX', unavailable: [] }], trigger);
    await fixture.whenStable();
    expect(host.order()).toEqual(['y', 'x']);
    expect(root.querySelector('.moving-trigger')).toBe(trigger);
    expect(document.activeElement).toBe(trigger);
  });
});
