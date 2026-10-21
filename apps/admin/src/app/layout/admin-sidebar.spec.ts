import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { adminNavigation } from '../workspace/admin-navigation';
import { AdminSidebar } from './admin-sidebar';
import { navigationContext } from './navigation';

const branch = '10000000-0000-4000-8000-000000000001';

@Component({ selector: 'holita-test-blank', template: '' })
class Blank {}

@Component({
  imports: [AdminSidebar],
  template: `
    <holita-admin-sidebar
      [navigation]="navigation()"
      language="bg"
      [homeLink]="['/', 'bg', branch, 'fleet']"
      tenantName="RentalSofia"
      [rail]="rail()"
    />
  `,
})
class SidebarHost {
  readonly branch = branch;
  readonly rail = signal(false);
  readonly navigation = signal(adminNavigation('bg', branch, true));
}

describe('AdminSidebar and navigation', () => {
  async function mount(url: string) {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: '**', component: Blank }])],
    });
    const harness = await RouterTestingHarness.create(url);
    const fixture = TestBed.createComponent(SidebarHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const element: unknown = fixture.nativeElement;
    if (!(element instanceof HTMLElement)) {
      throw new Error('Missing host element.');
    }
    return { harness, fixture, element };
  }

  it('groups Fleet and Karma Client with headings, a temporary tag and the tenant line', async () => {
    const { element } = await mount(`/bg/${branch}/fleet/vehicles/123/edit`);
    expect(
      Array.from(element.querySelectorAll('h2 > span:first-child')).map(
        (heading) => heading.textContent,
      ),
    ).toEqual(['Наблюдение', 'Автопарк', 'Karma Client', 'Настройки']);
    expect(element.querySelector('h2 .app-nav__note')?.textContent).toBe('временно');
    const links = Array.from(element.querySelectorAll('a.app-nav__item'));
    expect(links.map((link) => link.textContent.trim())).toEqual([
      'Преглед',
      'Сигнали',
      'Дневник на пътуванията',
      'Автомобили',
      'Шофьори',
      'Устройства',
      'Сервизно обслужване',
      'Камиони',
      'Потребители',
      'Роли',
      'Проекти',
      'Часови зони',
      'Информация за API',
      'Групи автомобили',
      'Общи',
    ]);
    expect(
      element
        .querySelector(`a.app-nav__item[href="/bg/${branch}/fleet/vehicles"]`)
        ?.getAttribute('aria-current'),
    ).toBe('page');
    expect(
      element
        .querySelector(`a.app-nav__item[href="/bg/${branch}/fleet/devices"]`)
        ?.hasAttribute('aria-current'),
    ).toBe(false);
    // The visible word names the logo link; the mark is decorative.
    expect(element.querySelector('a.app-logo')?.textContent.trim()).toBe('hholita');
    expect(element.querySelector('a.app-logo .app-logo__mark')?.getAttribute('aria-hidden')).toBe(
      'true',
    );
    expect(element.querySelector('.app-sidebar__footer')?.textContent).toBe('holita · RentalSofia');
  });

  it('keeps accessible names in the rail', async () => {
    const { fixture, element } = await mount('/bg');
    fixture.componentInstance.rail.set(true);
    fixture.detectChanges();
    const link = element.querySelector(`a.app-nav__item[href="/bg/${branch}/fleet/vehicles"]`);
    expect(link?.querySelector('.app-nav__text')?.classList.contains('app-visually-hidden')).toBe(
      true,
    );
    expect(link?.textContent.trim()).toBe('Автомобили');
    const word = element.querySelector('.app-logo__word');
    expect(word?.classList.contains('app-visually-hidden')).toBe(true);
    expect(word?.textContent).toBe('holita');
    expect(element.querySelector('#nav-fleet .app-visually-hidden')?.textContent).toBe('Автопарк');
  });

  it('omits Fleet without a Branch or when Fleet is disabled', () => {
    expect(adminNavigation('en', null, true).map((group) => group.id)).toEqual(['karma-client']);
    expect(adminNavigation('en', branch, false).map((group) => group.id)).toEqual(['karma-client']);
  });

  it('derives the page context from the longest matching link', () => {
    const navigation = adminNavigation('en', branch, true);
    expect(navigationContext(navigation, `/en/${branch}/fleet/devices/42/edit`)).toEqual({
      group: 'Fleet',
      page: 'Devices',
      pageLink: ['/', 'en', branch, 'fleet', 'devices'],
    });
    expect(navigationContext(navigation, '/en/karma-client/cars/41/edata')).toEqual({
      group: 'Karma Client',
      page: 'Trucks',
      pageLink: ['/', 'en', 'karma-client', 'cars'],
    });
    expect(navigationContext(navigation, `/en/${branch}/fleet/vehicles-archive`)).toBeNull();
    expect(navigationContext(navigation, '/en')).toBeNull();
  });
});
