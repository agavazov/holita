import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { UI_LANGUAGE } from '../ui-language';
import { PageHeader } from './page-header';

@Component({
  imports: [PageHeader],
  template: `
    <holita-page-header
      [eyebrow]="eyebrow()"
      title="Превозни средства"
      [count]="count()"
      description="Всички превозни средства на клона"
      [backLink]="back()"
      backLabel="Назад"
    >
      <span headerMeta class="meta">Данни към 09:30</span>
      <button headerActions type="button">Нов</button>
    </holita-page-header>
  `,
})
class Host {
  readonly eyebrow = signal<string | null>('Автопарк');
  readonly count = signal<number | null>(12345);
  readonly back = signal<readonly string[] | null>(null);
  readonly header = viewChild.required(PageHeader);
}

describe('PageHeader', () => {
  function render() {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: UI_LANGUAGE, useValue: signal('bg') }],
    });
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const element: unknown = fixture.nativeElement;
    if (!(element instanceof HTMLElement)) {
      throw new Error('Missing host element.');
    }
    return { fixture, element };
  }

  it('renders the single h1 focus target with eyebrow, grouped count, meta and actions', () => {
    const { fixture, element } = render();
    const title = element.querySelector('h1');
    expect(title?.id).toBe('page-title');
    expect(title?.getAttribute('tabindex')).toBe('-1');
    expect(title?.textContent.trim()).toBe('Превозни средства');
    expect(element.querySelector('.page-header__eyebrow')?.textContent).toBe('Автопарк');
    expect(element.querySelector('.page-header__count')?.textContent).toBe('12 345');
    expect(element.querySelector('.page-header__description')?.getAttribute('title')).toBe(
      'Всички превозни средства на клона',
    );
    expect(element.querySelector('.page-header__title-row .meta')).not.toBeNull();
    expect(element.querySelector('.page-header__actions button')?.textContent).toBe('Нов');
    fixture.componentInstance.header().focusTitle();
    expect(document.activeElement).toBe(title);
  });

  it('shows a back link only on detail pages and hides an absent count', () => {
    const { fixture, element } = render();
    expect(element.querySelector('.page-header__back')).toBeNull();
    fixture.componentInstance.back.set(['/', 'bg', 'vehicles']);
    fixture.componentInstance.count.set(null);
    fixture.componentInstance.eyebrow.set(null);
    fixture.detectChanges();
    expect(element.querySelector('.page-header__back')?.getAttribute('href')).toBe('/bg/vehicles');
    expect(element.querySelector('.page-header__count')).toBeNull();
    expect(element.querySelector('.page-header__eyebrow')).toBeNull();
  });
});
