import { DOCUMENT } from '@angular/common';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  InjectionToken,
  Injectable,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import {
  PRIMARY_OUTLET,
  provideRouter,
  Router,
  RouterOutlet,
  UrlSegment,
  type Routes,
} from '@angular/router';
import { provideApollo } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import {
  AdminShell,
  EmptyState,
  ModuleInfo,
  OperationToast,
  PageHeader,
  PageRecord,
  SignIn,
  UI_LANGUAGE,
  navigationContext,
  uiMessages,
  type NavGroup,
} from '@osnova/ui';
import { MessageService } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
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
  canSwitchBranch?: (page: unknown) => boolean | Promise<boolean>;
  retainRouteContext?: boolean;
}
const OPERATOR_OPTIONS = new InjectionToken<OperatorOptions>('operator application');

type ShopDiscovery =
  | { kind: 'loading' | 'error' | 'empty' }
  | { kind: 'ready'; branches: readonly { id: string; name: string }[] };

interface ShopScope {
  readonly tenantId: string;
  readonly token: string;
  readonly language: Language;
  readonly attempt: number;
}

@Injectable({ providedIn: 'root' })
export class OperatorLanguage {
  private readonly document = inject(DOCUMENT);
  readonly value = signal<Language>('bg');
  set(language: Language): void {
    this.value.set(language);
    this.document.documentElement.lang = language;
  }
}

@Component({
  selector: 'holita-operator',
  imports: [
    AdminShell,
    ButtonDirective,
    EmptyState,
    OperationToast,
    PageHeader,
    SignIn,
    RouterOutlet,
  ],
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
      @let discovery = shopDiscovery();
      <osnova-admin-shell
        productName="Holita"
        productMark="H"
        [class.shop-discovery-error]="discovery.kind === 'error'"
        [language]="language.value()"
        [languages]="languages"
        [homeLink]="homeLink()"
        [profileLink]="homeLink()"
        [navigation]="navigation()"
        [context]="context()"
        [branches]="branches()"
        [branchId]="activeBranch()"
        [loading]="selectsShop && discovery.kind === 'loading'"
        [tenantName]="session.current()?.tenant?.name ?? null"
        [account]="account()"
        (branchSelected)="selectBranch($event)"
        (languageChange)="changeLanguageValue($event)"
        (signOut)="signOut()"
      >
        @if (!selectsShop || activeBranch()) {
          <router-outlet />
        } @else {
          <div class="app-view">
            <osnova-page-header [title]="text().shops" [moduleInfo]="text().shopsInfo" />
            <div class="app-card">
              @switch (discovery.kind) {
                @case ('error') {
                  <osnova-empty-state kind="error" [title]="text().shopsUnavailable">
                    <button #retryButton emptyActions pButton type="button" (click)="retryShops()">
                      {{ shared().retry }}
                    </button>
                  </osnova-empty-state>
                }
                @case ('empty') {
                  <osnova-empty-state [title]="text().shopsEmpty" />
                }
                @default {
                  <div role="status">{{ text().shopsLoading }}</div>
                }
              }
            </div>
          </div>
        }
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
  protected readonly selectsShop = this.options.selectBranch;
  protected readonly text = computed(() => strings[this.language.value()]);
  protected readonly shared = computed(() => uiMessages[this.language.value()]);
  private readonly tenantId = computed(() => this.session.current()?.tenant.id);
  private readonly token = computed(() => this.session.current()?.token);
  private readonly injector = inject(Injector);
  private readonly retryButton = viewChild<ElementRef<HTMLButtonElement>>('retryButton');
  private retryFocusScope: ShopScope | null = null;
  private readonly shopAttempt = signal(0);
  private readonly shopScope = computed<ShopScope | null>(() => {
    const tenantId = this.tenantId();
    const token = this.token();
    if (!this.selectsShop || !tenantId || !token) {
      return null;
    }
    return { tenantId, token, language: this.language.value(), attempt: this.shopAttempt() };
  });
  private readonly shopResult = signal<{ scope: ShopScope; state: ShopDiscovery } | null>(null);
  protected readonly shopDiscovery = computed<ShopDiscovery>(() => {
    const result = this.shopResult();
    return result && result.scope === this.shopScope() ? result.state : { kind: 'loading' };
  });
  protected readonly branches = computed(() => {
    const discovery = this.shopDiscovery();
    return discovery.kind === 'ready' ? discovery.branches : [];
  });
  protected readonly activeBranch = computed(() => {
    const selected = this.session.branchId();
    return !this.selectsShop || this.branches().some((branch) => branch.id === selected)
      ? selected
      : null;
  });
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
  private readonly outlet = viewChild(RouterOutlet);
  private readonly moduleInfo = inject(ModuleInfo);
  private readonly pageRecord = inject(PageRecord);
  readonly context = computed(() => {
    if (!this.moduleInfo.info()) {
      return null;
    }
    if (this.selectsShop && !this.activeBranch()) {
      return { group: '', page: this.text().shops };
    }
    const context = navigationContext(
      this.navigation(),
      this.router.lastSuccessfulNavigation()?.finalUrl?.toString() ?? this.router.url,
    );
    const record = this.pageRecord.label();
    const pageLink = this.pageRecord.pageLink();
    return context && record ? { ...context, record, ...(pageLink ? { pageLink } : {}) } : context;
  });
  private readonly messages = inject(MessageService);

  constructor() {
    effect(() => {
      this.session.branchId();
      this.language.value();
      this.messages.clear();
    });
    effect((cleanup) => {
      const scope = this.shopScope();
      if (!scope) {
        return;
      }
      const { query, close } = this.branchApi.watch(scope.language, {
        tenantId: scope.tenantId,
        token: scope.token,
      });
      const publish = (state: ShopDiscovery) => {
        this.shopResult.set({ scope, state });
        if (this.retryFocusScope === scope && state.kind !== 'loading') {
          this.retryFocusScope = null;
          if (state.kind === 'error') {
            afterNextRender(
              () => {
                const button = this.retryButton()?.nativeElement;
                if (button && button.ownerDocument.activeElement === button.ownerDocument.body) {
                  button.focus();
                }
              },
              { injector: this.injector },
            );
          }
        }
      };
      const subscription = query.valueChanges.subscribe({
        next: (result) => {
          if (result.error) {
            publish({ kind: 'error' });
          } else if (result.loading) {
            publish({ kind: 'loading' });
          } else if (result.dataState === 'complete') {
            untracked(() => {
              if (this.shopScope() === scope) {
                publish(this.reconcileShops(result.data.branches));
              }
            });
          } else {
            publish({ kind: 'error' });
          }
        },
        error: () => {
          publish({ kind: 'error' });
        },
      });
      cleanup(() => {
        subscription.unsubscribe();
        close();
      });
    });
  }

  private reconcileShops(branches: readonly { id: string; name: string }[]): ShopDiscovery {
    const selected = this.session.branchId();
    const first = branches[0];
    if (!first) {
      const current = this.session.current();
      if (current && selected !== null) {
        // Keep the signed-in account and persist it with no Branch selected.
        this.session.start(current);
      }
      return { kind: 'empty' };
    }
    if (!branches.some((branch) => branch.id === selected)) {
      this.session.selectBranch(first.id);
    }
    return { kind: 'ready', branches };
  }

  protected retryShops(): void {
    const button = this.retryButton()?.nativeElement;
    this.shopAttempt.update((attempt) => attempt + 1);
    this.retryFocusScope =
      button && button.ownerDocument.activeElement === button ? this.shopScope() : null;
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
    const outlet = this.outlet();
    if (
      outlet?.isActivated &&
      this.options.canSwitchBranch &&
      !(await this.options.canSwitchBranch(outlet.component))
    ) {
      return;
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
      if (!this.options.retainRouteContext) {
        await this.router.navigate(this.homeLink());
      }
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
    if (this.options.retainRouteContext) {
      const url = this.router.parseUrl(this.router.url);
      const primary = url.root.children[PRIMARY_OUTLET];
      const current = primary?.segments[0];
      if (primary && current) {
        primary.segments[0] = new UrlSegment(language, current.parameters);
        void this.router.navigateByUrl(url);
        return;
      }
    }
    void this.router.navigate([
      '/',
      language,
      this.session.current() ? this.options.defaultPage : 'sign-in',
    ]);
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
