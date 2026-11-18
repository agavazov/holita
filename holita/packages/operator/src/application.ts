import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  InjectionToken,
  Injectable,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, Router, RouterOutlet, type Routes } from '@angular/router';
import { provideApollo } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { AdminShell, SignIn, UI_LANGUAGE, type NavGroup } from '@osnova/ui';
import {
  AuthApi,
  BranchesApi,
  DemoSession,
  OPERATOR_RUNTIME_CONFIG,
  OperatorConfig,
  SESSION_OPTIONS,
  graphqlOptions,
  loadRuntimeConfig,
  readGraphqlUrl,
  requestError,
  sessionExpiryInterceptor,
  type Language,
} from '@osnova/ui/app';
import { appTheme, provideOsnovaTheme, THEME_STORAGE_KEY } from '@osnova/ui/theme';
import { SHELL_STORAGE_KEY } from '@osnova/ui/layout';
import { CustomersPage, MerchantDetailPage, MerchantsPage, ProductsPage } from './pages';

export type OperatorMode = 'admin' | 'backoffice' | 'sales';
export const OPERATOR_MODE = new InjectionToken<OperatorMode>('operator application');

@Injectable({ providedIn: 'root' })
export class OperatorLanguage {
  readonly value = signal<Language>('bg');
  set(language: Language): void {
    this.value.set(language);
  }
}

@Component({
  selector: 'holita-operator',
  imports: [AdminShell, SignIn, RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!session.current()) {
      <osnova-sign-in
        productName="Holita"
        productMark="H"
        [language]="language.value()"
        [busy]="busy()"
        [error]="error()"
        (languageChange)="changeLanguage($event)"
        (submitCredentials)="signIn($event)"
      />
    } @else {
      <osnova-admin-shell
        productName="Holita"
        productMark="H"
        [language]="language.value()"
        [languages]="languages"
        [homeLink]="homeLink()"
        [profileLink]="homeLink()"
        [navigation]="navigation()"
        [branches]="branches()"
        [branchId]="session.branchId()"
        [tenantName]="session.current()?.tenant?.name ?? null"
        [account]="account()"
        (branchSelected)="session.selectBranch($event)"
        (languageChange)="changeLanguageValue($event)"
        (signOut)="signOut()"
      >
        <router-outlet />
      </osnova-admin-shell>
    }
  `,
})
export class OperatorApplication {
  readonly session = inject(DemoSession);
  readonly language = inject(OperatorLanguage);
  readonly mode = inject(OPERATOR_MODE);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly branches = signal<readonly { id: string; name: string }[]>([]);
  readonly languages = [
    { code: 'bg', label: 'Български' },
    { code: 'en', label: 'English' },
  ];
  readonly account = computed(() => {
    const user = this.session.user();
    return user ? { name: user.name, detail: user.email } : null;
  });
  readonly homeLink = computed(() => [
    '/',
    this.language.value(),
    this.mode === 'admin' ? 'products' : 'merchants',
  ]);
  readonly navigation = computed<readonly NavGroup[]>(() => [
    {
      id: 'workspace',
      label: '',
      headingHidden: true,
      items:
        this.mode === 'admin'
          ? [
              {
                id: 'products',
                label: this.language.value() === 'bg' ? 'Продукти' : 'Products',
                icon: 'tags',
                link: ['/', this.language.value(), 'products'],
              },
              {
                id: 'customers',
                label: this.language.value() === 'bg' ? 'Клиенти' : 'Customers',
                icon: 'users',
                link: ['/', this.language.value(), 'customers'],
              },
            ]
          : [
              {
                id: 'merchants',
                label: this.language.value() === 'bg' ? 'Търговци' : 'Merchants',
                icon: 'users',
                link: ['/', this.language.value(), 'merchants'],
              },
            ],
    },
  ]);
  private readonly auth = inject(AuthApi);
  private readonly branchApi = inject(BranchesApi);
  private readonly router = inject(Router);

  constructor() {
    effect((cleanup) => {
      const current = this.session.current();
      const language = this.language.value();
      if (!current || this.mode !== 'admin') {
        this.branches.set([]);
        return;
      }
      const { query, close } = this.branchApi.watch(language, {
        tenantId: current.tenant.id,
        token: current.token,
      });
      const subscription = query.valueChanges.subscribe((result) => {
        if (result.dataState === 'complete') {
          this.branches.set(result.data.branches);
          const selected = untracked(() => this.session.branchId());
          if (!result.data.branches.some((branch) => branch.id === selected)) {
            const first = result.data.branches[0];
            if (first) {
              this.session.selectBranch(first.id);
            }
          }
        }
      });
      cleanup(() => {
        subscription.unsubscribe();
        close();
      });
    });
  }
  async signIn(credentials: { email: string; password: string }): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      const session = await this.auth.signIn(
        credentials.email,
        credentials.password,
        this.language.value(),
      );
      this.session.start(session);
      await this.router.navigate(this.homeLink());
    } catch (error: unknown) {
      this.error.set(
        requestError(
          error,
          this.language.value() === 'bg' ? 'Входът е неуспешен.' : 'Sign in failed.',
        ),
      );
    } finally {
      this.busy.set(false);
    }
  }
  changeLanguage(language: Language): void {
    this.language.set(language);
    if (this.session.current()) {
      void this.router.navigate(this.homeLink());
    }
  }
  changeLanguageValue(value: string): void {
    if (value === 'bg' || value === 'en') {
      this.changeLanguage(value);
    }
  }
  signOut(): void {
    this.session.logout();
    void this.router.navigate(['/', this.language.value(), 'sign-in']);
  }
}

export async function startOperator(mode: OperatorMode): Promise<void> {
  const config = await loadRuntimeConfig((value) => ({ graphqlUrl: readGraphqlUrl(value) }));
  const defaultPage = mode === 'admin' ? 'products' : 'merchants';
  const children: Routes =
    mode === 'admin'
      ? [
          { path: 'products', component: ProductsPage },
          { path: 'customers', component: CustomersPage },
        ]
      : [
          { path: 'merchants', component: MerchantsPage },
          { path: 'merchants/:id', component: MerchantDetailPage },
        ];
  const routes: Routes = [
    { path: '', pathMatch: 'full', redirectTo: `bg/${defaultPage}` },
    {
      path: ':language',
      children: [
        { path: 'sign-in', component: ProductsPage },
        ...children,
        { path: '', pathMatch: 'full', redirectTo: defaultPage },
      ],
    },
  ];
  await bootstrapApplication(OperatorApplication, {
    providers: [
      { provide: OPERATOR_MODE, useValue: mode },
      { provide: OPERATOR_RUNTIME_CONFIG, useValue: config },
      {
        provide: SESSION_OPTIONS,
        useValue: {
          storageKey: `holita.${mode}.session`,
          legacyStorageKey: `holita.${mode}.demo-session`,
          tokenPrefix: 'holita',
        },
      },
      { provide: THEME_STORAGE_KEY, useValue: `holita.${mode}.theme` },
      { provide: SHELL_STORAGE_KEY, useValue: `holita.${mode}.sidebar` },
      { provide: UI_LANGUAGE, useFactory: () => inject(OperatorLanguage).value.asReadonly() },
      provideHttpClient(withInterceptors([sessionExpiryInterceptor])),
      provideOsnovaTheme(appTheme),
      provideApollo(() => graphqlOptions(inject(HttpLink), inject(OperatorConfig).graphqlUrl)),
      provideRouter(routes),
    ],
  });
}
