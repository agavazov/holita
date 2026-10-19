import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { UI_LANGUAGE } from '../ui-language';
import { FilterBuilder } from './filter-builder';
import type { FilterCondition, FilterField } from './filter-model';

@Component({
  imports: [FilterBuilder],
  template: `<holita-filter-builder
    searchLabel="Search records"
    [fields]="fields"
    [conditions]="conditions()"
    (conditionsChange)="conditions.set($event)"
  />`,
})
class Host {
  readonly fields: readonly FilterField[] = [
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
  ];
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
