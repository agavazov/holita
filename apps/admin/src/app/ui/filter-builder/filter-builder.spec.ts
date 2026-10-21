import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { UI_LANGUAGE } from '../ui-language';
import { FilterBuilder } from './filter-builder';
import type { FilterCondition, FilterField } from './filter-model';

@Component({
  imports: [FilterBuilder],
  template: `<holita-filter-builder
    searchLabel="Search records"
    [fields]="fields()"
    [conditions]="conditions()"
    [maxConditions]="maxConditions()"
    (conditionsChange)="conditions.set($event)"
  />`,
})
class Host {
  readonly fields = signal<readonly FilterField[]>([
    {
      key: 'status',
      label: 'Status',
      type: 'enum',
      operators: ['isAnyOf'],
      options: [{ value: 'ACTIVE', label: 'Active' }],
    },
    { key: 'odometer', label: 'Odometer', type: 'number', operators: ['between'] },
    { key: 'hasDevice', label: 'Has device', type: 'boolean', operators: ['isTrue'] },
    { key: 'createdAt', label: 'Added', type: 'date', operators: ['after'] },
    {
      key: 'year',
      label: 'Year',
      type: 'number',
      operators: ['equals'],
      min: 1950,
      max: 2100,
      integer: true,
    },
    { key: 'make', label: 'Make', type: 'text', operators: ['contains'], maxLength: 64 },
  ]);
  readonly maxConditions = signal<number | null>(null);
  readonly conditions = signal<readonly FilterCondition[]>([
    { id: 'a', field: 'status', operator: 'isAnyOf', values: ['ACTIVE'] },
    { id: 'b', field: 'odometer', operator: 'between', values: ['10', '20'] },
    { id: 'c', field: 'hasDevice', operator: 'isTrue', values: [] },
  ]);
}

function button(name: string): HTMLButtonElement {
  const match = Array.from(document.querySelectorAll('button')).find((element) =>
    (element.getAttribute('aria-label') ?? element.textContent.trim()).startsWith(name),
  );
  if (!match) {
    throw new Error(`Missing button ${name}.`);
  }
  return match;
}

function click(element: HTMLElement): void {
  element.focus();
  element.click();
}

function firstControl(): HTMLElement {
  const match = document.querySelector<HTMLElement>('.p-popover [id$="-field"]');
  if (!match) {
    throw new Error('Missing Column control.');
  }
  return match;
}

describe('FilterBuilder focus', () => {
  async function render() {
    TestBed.configureTestingModule({
      providers: [{ provide: UI_LANGUAGE, useValue: signal('en') }],
    });
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    return fixture;
  }

  afterEach(() => {
    document.querySelectorAll('.p-popover').forEach((element) => {
      element.remove();
    });
  });

  it('adds a distinct condition after restoring filters from a previous browser session', async () => {
    const fixture = await render();
    const host = fixture.componentInstance;
    host.fields.set([
      { key: 'hasDevice', label: 'Has device', type: 'boolean', operators: ['isTrue'] },
    ]);
    host.maxConditions.set(50);
    const restored: readonly FilterCondition[] = Array.from({ length: 49 }, (_, index) => ({
      id: `condition-${String(index)}`,
      field: 'hasDevice',
      operator: 'isTrue',
      values: [],
    }));
    host.conditions.set(restored);
    await fixture.whenStable();
    click(button('Add filter'));
    await fixture.whenStable();
    click(button('Apply'));
    await fixture.whenStable();
    const conditions = host.conditions();
    expect(conditions).toHaveLength(50);
    expect(conditions.slice(0, 49)).toEqual(restored);
    expect(new Set(conditions.map((condition) => condition.id)).size).toBe(50);
    expect(button('Add filter').disabled).toBe(true);
    const chips = Array.from(
      document.querySelectorAll<HTMLButtonElement>('.filter-builder__chip-label'),
    );
    expect(document.activeElement).toBe(chips.at(-1));
  });

  it('blocks invalid bounded values even on direct form submission, and applies a corrected value', async () => {
    const fixture = await render();
    fixture.componentInstance.conditions.set([
      { id: 'year', field: 'year', operator: 'equals', values: ['1900'] },
    ]);
    await fixture.whenStable();
    click(button('Edit filter: Year'));
    await fixture.whenStable();
    const component: unknown = fixture.debugElement.query(
      By.directive(FilterBuilder),
    ).componentInstance;
    if (!(component instanceof FilterBuilder)) {
      throw new Error('Missing filter builder.');
    }
    const emit = vi.spyOn(component.conditionsChange, 'emit');
    expect(button('Update').disabled).toBe(true);
    expect(document.querySelector('.filter-builder__editor p-message')?.textContent).toContain(
      '1,950',
    );
    document
      .querySelector('form.filter-builder__editor')
      ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(emit).not.toHaveBeenCalled();
    const input = document.querySelector<HTMLInputElement>(
      '.filter-builder__editor input[id$="-value"]',
    );
    if (!input) {
      throw new Error('Missing year value.');
    }
    // InputNumber commits raw input through its blur handler; a native input event alone
    // does not update its ControlValueAccessor.
    for (const value of ['1900', '2101', '2024.5']) {
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new FocusEvent('blur'));
      await fixture.whenStable();
      expect(button('Update').disabled).toBe(true);
    }
    input.value = '2024';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new FocusEvent('blur'));
    await fixture.whenStable();
    expect(button('Update').disabled).toBe(false);
    click(button('Update'));
    await fixture.whenStable();
    expect(fixture.componentInstance.conditions()).toEqual([
      { id: 'year', field: 'year', operator: 'equals', values: ['2024'] },
    ]);
  });

  it('caps new conditions while keeping existing conditions editable and clear-all reachable', async () => {
    const fixture = await render();
    const host = fixture.componentInstance;
    const fields: readonly FilterField[] = [
      { key: 'hasDevice', label: 'Has device', type: 'boolean', operators: ['isTrue'] },
    ];
    host.fields.set(fields);
    host.maxConditions.set(50);
    const conditions: FilterCondition[] = Array.from({ length: 50 }, (_, index) => ({
      id: `condition-${String(index)}`,
      field: 'hasDevice',
      operator: 'isTrue',
      values: [],
    }));
    host.conditions.set(conditions.slice(0, 49));
    await fixture.whenStable();
    click(button('Add filter'));
    await fixture.whenStable();
    expect(button('Apply').disabled).toBe(false);
    host.conditions.set(conditions);
    await fixture.whenStable();
    expect(button('Apply').disabled).toBe(true);
    document
      .querySelector('form.filter-builder__editor')
      ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(host.conditions()).toHaveLength(50);
    click(button('Cancel'));
    await fixture.whenStable();
    expect(button('Add filter').disabled).toBe(true);
    expect(document.activeElement).toBe(
      Array.from(document.querySelectorAll('.filter-builder__chip-label')).at(-1),
    );
    click(button('Edit filter: Has device'));
    await fixture.whenStable();
    expect(button('Update').disabled).toBe(false);
    click(button('Update'));
    await fixture.whenStable();
    expect(host.conditions()).toHaveLength(50);
    click(button('Clear all'));
    await fixture.whenStable();
    expect(host.conditions()).toEqual([]);
    expect(button('Add filter').disabled).toBe(false);
    expect(document.activeElement).toBe(button('Add filter'));
  });

  it('blocks a selected value set larger than its backend limit', async () => {
    const fixture = await render();
    const host = fixture.componentInstance;
    const values = Array.from({ length: 101 }, (_, index) => String(index));
    host.fields.set([
      {
        key: 'group',
        label: 'Group',
        type: 'enum',
        operators: ['isAnyOf'],
        maxValues: 100,
        options: values.map((value) => ({ value, label: value })),
      },
    ]);
    host.conditions.set([{ id: 'group', field: 'group', operator: 'isAnyOf', values }]);
    await fixture.whenStable();
    click(button('Edit filter: Group'));
    await fixture.whenStable();
    expect(button('Update').disabled).toBe(true);
    expect(document.querySelector('.filter-builder__editor p-message')?.textContent).toContain(
      '100',
    );
  });

  it('opens on Column and restores Add filter on Escape', async () => {
    const fixture = await render();
    const add = button('Add filter');
    click(add);
    await fixture.whenStable();
    expect(document.activeElement).toBe(firstControl());
    firstControl().dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }),
    );
    await fixture.whenStable();
    expect(document.activeElement).toBe(add);
  });

  it('returns to the edited chip after Update without replacing its id', async () => {
    const fixture = await render();
    const chip = button('Edit filter: Odometer');
    click(chip);
    await fixture.whenStable();
    document
      .querySelector('.filter-builder__editor')
      ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    expect(document.activeElement).toBe(chip);
    expect(fixture.componentInstance.conditions().map((condition) => condition.id)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('restores the opener on Cancel even after focus was lost', async () => {
    const fixture = await render();
    const add = button('Add filter');
    click(add);
    await fixture.whenStable();
    firstControl().blur();
    button('Cancel').click();
    await fixture.whenStable();
    expect(document.activeElement).toBe(add);
  });

  it('keeps focus on a search input clicked outside the editor', async () => {
    const fixture = await render();
    click(button('Add filter'));
    await fixture.whenStable();
    const search = document.querySelector<HTMLInputElement>('input[type="search"]');
    if (!search) {
      throw new Error('Missing search.');
    }
    click(search);
    await fixture.whenStable();
    expect(document.activeElement).toBe(search);
  });

  it('retargets an open editor to a chip and refocuses Column', async () => {
    const fixture = await render();
    click(button('Add filter'));
    await fixture.whenStable();
    const chip = button('Edit filter: Odometer');
    click(chip);
    await fixture.whenStable();
    expect(document.activeElement).toBe(firstControl());
    expect(button('Update').disabled).toBe(false);
    click(button('Cancel'));
    await fixture.whenStable();
    expect(document.activeElement).toBe(chip);
  });

  it('moves focus to next, previous, then Add filter when chips are removed', async () => {
    const fixture = await render();
    const next = button('Edit filter: Has device');
    click(button('Remove filter: Odometer'));
    expect(document.activeElement).toBe(next);
    await fixture.whenStable();
    expect(document.activeElement).toBe(next);
    const previous = button('Edit filter: Status');
    click(button('Remove filter: Has device'));
    await fixture.whenStable();
    expect(document.activeElement).toBe(previous);
    click(button('Remove filter: Status'));
    await fixture.whenStable();
    expect(document.activeElement).toBe(button('Add filter'));
  });

  it('moves focus to Add filter before clearing all chips', async () => {
    const fixture = await render();
    click(button('Clear all'));
    expect(document.activeElement).toBe(button('Add filter'));
    await fixture.whenStable();
    expect(fixture.componentInstance.conditions()).toEqual([]);
    expect(document.activeElement).toBe(button('Add filter'));
  });

  it.each(['input', 'cell'] as const)(
    'closes only the nested calendar on the first Escape from its %s',
    async (target) => {
      const fixture = await render();
      fixture.componentInstance.conditions.set([
        { id: 'date', field: 'createdAt', operator: 'after', values: ['2026-01-01'] },
      ]);
      await fixture.whenStable();
      const chip = button('Edit filter: Added');
      click(chip);
      await fixture.whenStable();
      const input = document.querySelector<HTMLInputElement>(
        '.filter-builder__editor input[id$="-value"]',
      );
      if (!input) {
        throw new Error('Missing filter date input.');
      }
      click(input);
      await fixture.whenStable();
      const cell = document.querySelector<HTMLElement>(
        '.p-datepicker-panel [data-date][tabindex="0"]',
      );
      const source = target === 'input' ? input : cell;
      if (!source) {
        throw new Error('Missing focusable calendar cell.');
      }
      source.focus();
      source.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Escape',
          code: 'Escape',
          keyCode: 27,
          which: 27,
          bubbles: true,
          cancelable: true,
        }),
      );
      await fixture.whenStable();
      expect(document.querySelector('.p-datepicker-panel')).toBeNull();
      expect(document.querySelector('.p-popover')).not.toBeNull();
      expect(document.activeElement).toBe(input);
      input.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Escape',
          code: 'Escape',
          keyCode: 27,
          which: 27,
          bubbles: true,
          cancelable: true,
        }),
      );
      await fixture.whenStable();
      expect(document.querySelector('.p-popover')).toBeNull();
      expect(document.activeElement).toBe(chip);
    },
  );
});
