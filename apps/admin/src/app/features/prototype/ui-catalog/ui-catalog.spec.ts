import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideApollo } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { routes } from '../../../app.routes';
import { ADMIN_RUNTIME_CONFIG } from '../../../core/config/admin-config';
import { graphqlOptions } from '../../../core/graphql/graphql-options';
import { AdminShell } from '../../../layout/admin-shell';
import { vi } from 'vitest';
import { FormExamples } from './form-examples/form-examples';

const storeA = '10000000-0000-4000-8000-000000000001';
const storeB = '10000000-0000-4000-8000-000000000002';
const path = `/en/stores/${storeA}/ui-catalog`;

for (const mode of ['mock', 'graphql'] as const) {
  describe(`UI catalog ${mode} routing`, () => {
    let http: HttpTestingController;
    beforeEach(() => {
      vi.stubGlobal(
        'ResizeObserver',
        class {
          observe(): void {}
          unobserve(): void {}
          disconnect(): void {}
        },
      );
      TestBed.configureTestingModule({
        providers: [
          provideRouter(routes),
          provideHttpClient(),
          provideHttpClientTesting(),
          { provide: ADMIN_RUNTIME_CONFIG, useValue: { graphqlUrl: '/graphql', dataSource: mode } },
          provideApollo(() => graphqlOptions(inject(HttpLink), '/graphql')),
        ],
      });
      http = TestBed.inject(HttpTestingController);
    });
    afterEach(() => {
      http.verify({ ignoreCancelled: true });
      vi.unstubAllGlobals();
    });

    it('gates direct access before mounting examples or issuing a business read', async () => {
      const harness = await RouterTestingHarness.create(path + '?tab=forms');
      http.expectOne('/graphql').flush({ data: { stores: [{ id: storeA, name: 'Sofia' }] } });
      await harness.fixture.whenStable();
      expect(harness.routeNativeElement?.querySelector('holita-form-examples') !== null).toBe(
        mode === 'mock',
      );
      expect(TestBed.inject(Router).url).toBe(
        mode === 'mock' ? path + '?tab=forms' : '/en?tab=forms',
      );
      expect(harness.routeNativeElement?.textContent.includes('UI catalog')).toBe(mode === 'mock');
      http.expectNone('/graphql');
    });

    if (mode === 'mock') {
      it('does not mount examples for an unknown store', async () => {
        const harness = await RouterTestingHarness.create('/en/stores/unknown/ui-catalog');
        http.expectOne('/graphql').flush({ data: { stores: [{ id: storeA, name: 'Sofia' }] } });
        await harness.fixture.whenStable();
        expect(harness.routeNativeElement?.textContent).toContain('Store not found');
        expect(harness.routeNativeElement?.querySelector('holita-body-examples')).toBeNull();
        http.expectNone('/graphql');
      });
      it('resets section state and preserves the catalog on A → B → A and language navigation', async () => {
        const harness = await RouterTestingHarness.create(path + '?tab=forms');
        const stores = [
          { id: storeA, name: 'Sofia' },
          { id: storeB, name: 'Plovdiv' },
        ];
        http.expectOne('/graphql').flush({ data: { stores } });
        await harness.fixture.whenStable();
        const form: unknown = harness.fixture.debugElement.query(
          By.directive(FormExamples),
        ).componentInstance;
        if (!(form instanceof FormExamples)) throw new Error('Missing form preview.');
        form.form.controls.name.setValue('Private draft');
        await harness.navigateByUrl(path + '?tab=body');
        await harness.navigateByUrl(path + '?tab=forms');
        const fresh: unknown = harness.fixture.debugElement.query(
          By.directive(FormExamples),
        ).componentInstance;
        if (!(fresh instanceof FormExamples)) throw new Error('Missing form preview.');
        expect(fresh.form.controls.name.value).toBe('');
        const shell: unknown = harness.fixture.debugElement.query(
          By.directive(AdminShell),
        ).componentInstance;
        if (!(shell instanceof AdminShell)) throw new Error('Missing shell.');
        shell.storeSelected.emit(storeB);
        await harness.fixture.whenStable();
        expect(TestBed.inject(Router).url).toBe(path.replace(storeA, storeB));
        shell.storeSelected.emit(storeA);
        await harness.fixture.whenStable();
        expect(TestBed.inject(Router).url).toBe(path);
        await harness.navigateByUrl(path + '?tab=forms');
        const current: unknown = harness.fixture.debugElement.query(
          By.directive(FormExamples),
        ).componentInstance;
        if (!(current instanceof FormExamples)) throw new Error('Missing current form.');
        current.form.controls.name.setValue('Retired draft');
        await harness.navigateByUrl(path.replace('/en/', '/bg/') + '?tab=forms');
        http.expectOne('/graphql').flush({ data: { stores } });
        await harness.fixture.whenStable();
        const translated: unknown = harness.fixture.debugElement.query(
          By.directive(FormExamples),
        ).componentInstance;
        if (!(translated instanceof FormExamples)) throw new Error('Missing translated form.');
        expect(translated.form.controls.name.value).toBe('');
        expect(harness.routeNativeElement?.textContent).toContain('Примерни детайли');
        http.expectNone('/graphql');
      });
    }
  });
}
