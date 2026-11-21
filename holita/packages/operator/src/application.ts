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
import { AdminShell, OperationToast, SignIn, UI_LANGUAGE, type NavGroup } from '@osnova/ui';
import { MessageService } from 'primeng/api';
import {
  AuthApi,
  BranchesApi,
  DemoSession,
  OPERATOR_RUNTIME_CONFIG,
  OperatorConfig,
  SESSION_OPTIONS,
  graphqlOptions,
  loadLocalConfig,
  loadRuntimeConfig,
  readPrimeUiLicense,
  readGraphqlUrl,
  requestError,
  sessionExpiryInterceptor,
  type Language,
} from '@osnova/ui/app';
import { appTheme, provideOsnovaTheme, THEME_STORAGE_KEY } from '@osnova/ui/theme';
import { SHELL_STORAGE_KEY } from '@osnova/ui/layout';
import { operatorStrings as strings } from './strings';

interface OperatorOptions {
  name: string;
  defaultPage: string;
  routes: Routes;
  navigation: readonly {
    id: string;
    label: keyof typeof strings.bg;
    icon: NavGroup['items'][number]['icon'];
    path: string;
  }[];
  selectBranch: boolean;
}
const OPERATOR_OPTIONS = new InjectionToken<OperatorOptions>('operator application');

@Injectable({ providedIn: 'root' })
export class OperatorLanguage {
  readonly value = signal<Language>('bg');
  set(language: Language): void {
    this.value.set(language);
  }
}

@Component({
  selector: 'holita-operator',
  imports: [AdminShell, OperationToast, SignIn, RouterOutlet],
  providers: [MessageService],
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
        (branchSelected)="selectBranch($event)"
        (languageChange)="changeLanguageValue($event)"
        (signOut)="signOut()"
      >
        <router-outlet />
        <osnova-operation-toast />
      </osnova-admin-shell>
    }
  `,
})
export class OperatorApplication {
  readonly session = inject(DemoSession);
  readonly language = inject(OperatorLanguage);
  private readonly options = inject(OPERATOR_OPTIONS);
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
  readonly homeLink = computed(() => ['/', this.language.value(), this.options.defaultPage]);
  readonly navigation = computed<readonly NavGroup[]>(() => [
    {
      id: 'workspace',
      label: '',
      headingHidden: true,
      items: this.options.navigation.map((item) => ({
        id: item.id,
        label: strings[this.language.value()][item.label],
        icon: item.icon,
        link: ['/', this.language.value(), item.path],
      })),
    },
  ]);
  private readonly auth = inject(AuthApi);
  private readonly branchApi = inject(BranchesApi);
  private readonly router = inject(Router);
  private readonly messages = inject(MessageService);

  constructor() {
    effect(() => {
      this.session.branchId();
      this.language.value();
      this.messages.clear();
    });
    effect((cleanup) => {
      const current = this.session.current();
      const language = this.language.value();
      if (!current || !this.options.selectBranch) {
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
  async selectBranch(branchId: string): Promise<void> {
    if (branchId === this.session.branchId()) {
      return;
    }
    let active = this.router.routerState.root;
    while (active.firstChild) {
      active = active.firstChild;
    }
    if (active.snapshot.data['drawer'] === true) {
      const left = await this.router.navigate(['..'], { relativeTo: active });
      if (!left) {
        return;
      }
    }
    this.session.selectBranch(branchId);
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
    void this.router.navigate(
      this.session.current() ? this.homeLink() : ['/', language, 'sign-in'],
    );
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

export async function startOperator(options: OperatorOptions): Promise<void> {
  const config = await loadRuntimeConfig((value) => ({ graphqlUrl: readGraphqlUrl(value) }));
  const license = await loadLocalConfig(readPrimeUiLicense, undefined);
  const { defaultPage } = options;
  const routes: Routes = [
    { path: '', pathMatch: 'full', redirectTo: `bg/${defaultPage}` },
    {
      path: ':language',
      canActivate: [
        (route) => {
          const language = route.paramMap.get('language');
          if (language !== 'bg' && language !== 'en') {
            return inject(Router).createUrlTree(['/bg']);
          }
          inject(OperatorLanguage).set(language);
          return true;
        },
      ],
      children: [
        { path: 'sign-in', redirectTo: defaultPage },
        ...options.routes,
        { path: '', pathMatch: 'full', redirectTo: defaultPage },
        { path: '**', redirectTo: '' },
      ],
    },
  ];
  await bootstrapApplication(OperatorApplication, {
    providers: [
      { provide: OPERATOR_OPTIONS, useValue: options },
      { provide: OPERATOR_RUNTIME_CONFIG, useValue: config },
      {
        provide: SESSION_OPTIONS,
        useValue: {
          storageKey: `holita.${options.name}.session`,
          legacyStorageKey: `holita.${options.name}.demo-session`,
          tokenPrefix: 'holita',
        },
      },
      { provide: THEME_STORAGE_KEY, useValue: `holita.${options.name}.theme` },
      { provide: SHELL_STORAGE_KEY, useValue: `holita.${options.name}.sidebar` },
      { provide: UI_LANGUAGE, useFactory: () => inject(OperatorLanguage).value.asReadonly() },
      provideHttpClient(withInterceptors([sessionExpiryInterceptor])),
      provideOsnovaTheme(appTheme, license),
      provideApollo(() => graphqlOptions(inject(HttpLink), inject(OperatorConfig).graphqlUrl)),
      provideRouter(routes),
    ],
  });
}
