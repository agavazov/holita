import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { UI_LANGUAGE } from '../ui-language';
import { KpiStrip } from './kpi-strip';
import { KpiTile, type KpiDelta } from './kpi-tile';

@Component({
  imports: [KpiStrip, KpiTile],
  template: `
    <holita-kpi-strip
      label="Автопарк"
      [loading]="loading()"
      [error]="error()"
      (retry)="retries = retries + 1"
    >
      <holita-kpi-tile
        label="В движение"
        [value]="value()"
        unit="бр."
        [delta]="delta()"
        tone="success"
      />
      <holita-kpi-tile
        label="Аларми"
        value="4"
        secondary="критични: 1"
        footnote="към 09:30"
        explanation="Отворени аларми за последните 24 часа."
        [link]="['/', 'bg', 'alerts']"
        [queryParams]="{ status: 'open' }"
      />
    </holita-kpi-strip>
  `,
})
class Host {
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly value = signal<string | null>(null);
  readonly delta = signal<KpiDelta | null>({ text: '+2', trend: 'up', sentiment: 'good' });
  retries = 0;
}

function element(fixture: ComponentFixture<Host>): HTMLElement {
  const value: unknown = fixture.nativeElement;
  if (!(value instanceof HTMLElement)) throw new Error('Missing host element.');
  return value;
}

describe('KpiStrip and KpiTile', () => {
  function render() {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: UI_LANGUAGE, useValue: signal('bg') }],
    });
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    return fixture;
  }

  it('labels the group, shows "—" for null values and never 0', () => {
    const fixture = render();
    const root = element(fixture);
    const strip = root.querySelector('holita-kpi-strip');
    expect(strip?.getAttribute('role')).toBe('group');
    expect(strip?.getAttribute('aria-label')).toBe('Автопарк');
    const [first, second] = Array.from(root.querySelectorAll('holita-kpi-tile'));
    expect(first?.querySelector('.kpi-tile__value')?.textContent.trim()).toBe('—');
    expect(first?.querySelector('.kpi-tile__unit')).toBeNull();
    expect(first?.getAttribute('data-tone')).toBe('success');
    expect(first?.querySelector('.kpi-tile__delta')?.getAttribute('data-sentiment')).toBe('good');
    fixture.componentInstance.value.set('0');
    fixture.detectChanges();
    expect(first?.querySelector('.kpi-tile__value')?.textContent).toContain('0');
    expect(first?.querySelector('.kpi-tile__unit')?.textContent).toBe('бр.');
    const link = second?.querySelector('a.kpi-tile__link');
    expect(link?.getAttribute('href')).toBe('/bg/alerts?status=open');
    expect(second?.querySelector('.kpi-tile__info')?.getAttribute('aria-label')).toBe(
      'Как се изчислява: Аларми',
    );
    expect(second?.querySelector('.kpi-tile__footnote')?.textContent).toBe('към 09:30');
  });

  it('shows skeletons while loading and an error with retry', () => {
    const fixture = render();
    const root = element(fixture);
    fixture.componentInstance.loading.set(true);
    fixture.detectChanges();
    expect(root.querySelectorAll('p-skeleton').length).toBe(4);
    expect(root.querySelector('holita-kpi-strip')?.getAttribute('aria-busy')).toBe('true');
    fixture.componentInstance.loading.set(false);
    fixture.componentInstance.error.set('Неуспешно зареждане');
    fixture.detectChanges();
    expect(root.querySelector('.kpi-strip__error')?.textContent).toContain('Неуспешно зареждане');
    root.querySelector<HTMLButtonElement>('.kpi-strip__error button')?.click();
    expect(fixture.componentInstance.retries).toBe(1);
  });
});
