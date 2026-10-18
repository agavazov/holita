import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { UI_LANGUAGE } from '../ui-language';
import { FilterBar, type FilterChip } from './filter-bar';

@Component({
  imports: [FilterBar],
  template: `
    <holita-filter-bar
      searchLabel="Търсене по номер"
      [search]="search()"
      [searchError]="error()"
      [chips]="chips()"
      [activeCount]="chips().length"
      (searchChange)="changes.push($event)"
      (removeChip)="removed.push($event)"
      (clearAll)="cleared = cleared + 1"
    >
      <span filterSegments class="segments">Отворени</span>
      <span filterControls class="controls">Статус</span>
    </holita-filter-bar>
  `,
})
class Host {
  readonly search = signal('CA');
  readonly error = signal<string | null>(null);
  readonly chips = signal<readonly FilterChip[]>([]);
  readonly changes: string[] = [];
  readonly removed: string[] = [];
  cleared = 0;
}

function element(fixture: ComponentFixture<Host>): HTMLElement {
  const value: unknown = fixture.nativeElement;
  if (!(value instanceof HTMLElement)) throw new Error('Missing host element.');
  return value;
}

describe('FilterBar', () => {
  function render() {
    TestBed.configureTestingModule({
      providers: [{ provide: UI_LANGUAGE, useValue: signal('bg') }],
    });
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    return fixture;
  }

  it('labels the search, emits raw values and shows its error', () => {
    const fixture = render();
    const root = element(fixture);
    const input = root.querySelector('input[type="search"]');
    if (!(input instanceof HTMLInputElement)) throw new Error('Missing search.');
    expect(input.value).toBe('CA');
    expect(input.maxLength).toBe(200);
    expect(root.querySelector(`label[for="${input.id}"]`)?.textContent).toBe('Търсене по номер');
    input.value = 'CA 12';
    input.dispatchEvent(new Event('input'));
    expect(fixture.componentInstance.changes).toEqual(['CA 12']);
    fixture.componentInstance.error.set('Търсенето използва най-много пет думи.');
    fixture.detectChanges();
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const describedBy = input.getAttribute('aria-describedby') ?? '';
    expect(root.querySelector(`#${describedBy}`)?.textContent).toContain('пет думи');
    expect(root.querySelector('.segments')).not.toBeNull();
    expect(root.querySelector('.filter-bar__controls .controls')).not.toBeNull();
  });

  it('removes chips, clears all and counts filters on the mobile toggle', () => {
    const fixture = render();
    const root = element(fixture);
    expect(root.querySelector('.filter-bar__chips')).toBeNull();
    fixture.componentInstance.chips.set([
      { key: 'statuses', label: 'В сервиз' },
      { key: 'hasDevice', label: 'Без устройство' },
    ]);
    fixture.detectChanges();
    const chips = root.querySelectorAll<HTMLButtonElement>('.filter-bar__chip');
    expect(chips[1]?.getAttribute('aria-label')).toBe('Премахни филтъра: Без устройство');
    chips[0]?.click();
    expect(fixture.componentInstance.removed).toEqual(['statuses']);
    root.querySelector<HTMLButtonElement>('.filter-bar__chips > button')?.click();
    expect(fixture.componentInstance.cleared).toBe(1);
    const toggle = root.querySelector<HTMLButtonElement>('.filter-bar__toggle');
    expect(toggle?.textContent).toContain('Филтри (2)');
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    toggle?.click();
    fixture.detectChanges();
    expect(toggle?.getAttribute('aria-expanded')).toBe('true');
    expect(root.querySelector('.filter-bar__controls--open')).not.toBeNull();
  });
});
