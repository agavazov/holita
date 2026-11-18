import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
  viewChild,
  type OnInit,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { EMPTY, Subject, catchError, startWith, switchMap } from 'rxjs';
import type { AdminUserDetailsFragment } from '../../../generated/graphql/operations';
import { DemoSession } from '../../core/auth/demo-session';
import { injectDrawerHost } from '../../ui/drawer/drawer-host';
import { drawerParam, drawerRouteData } from '../../ui/drawer/drawer-route';
import type { RouteDrawerState } from '../../ui/drawer/route-drawer';
import { fieldErrors } from '../../ui/forms/field-errors';
import { interpolate } from '../../ui/i18n/messages';
import { UI_LANGUAGE } from '../../ui/ui-language';
import { usersText } from './i18n/messages';
import { UserDrawer, type UserField, type UserForm } from './user-drawer';
import { UsersApi } from './users-api';

@Component({
  selector: 'discocan-user-editor-page',
  imports: [UserDrawer],
  providers: [UsersApi],
  template: `
    <discocan-user-drawer
      [user]="user()"
      [creating]="creating"
      [state]="state()"
      [loadError]="loadFailure()"
      [closeLink]="listLink"
      [saving]="saving()"
      [canManage]="canManage()"
      [ownAccount]="ownAccount()"
      [saveError]="saveFailure()"
      [fieldErrors]="fieldFailures()"
      (save)="save($event)"
      (retry)="retry.next()"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserEditorPage implements OnInit {
  private readonly api = inject(UsersApi);
  private readonly session = inject(DemoSession);
  private readonly language = inject(UI_LANGUAGE);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = injectDrawerHost();
  private readonly drawer = viewChild(UserDrawer);
  private readonly routeData = drawerRouteData(this.route);
  private closingAfterSave = false;
  readonly canManage = computed(() => this.session.hasRole('ADMINISTRATOR'));
  readonly ownAccount = computed(() => this.id === this.session.user()?.id);
  readonly creating = this.routeData.mode === 'create';
  readonly id = this.creating ? null : drawerParam(this.route, 'recordId');
  readonly listLink = ['/', this.language(), 'settings', 'users'];
  readonly user = signal<AdminUserDetailsFragment | null>(null);
  readonly state = signal<RouteDrawerState>('loading');
  readonly saving = signal(false);
  readonly loadError = signal<unknown>(null);
  readonly saveError = signal<unknown>(null);
  protected readonly retry = new Subject<void>();
  private readonly text = computed(() => usersText(this.language()));
  protected readonly loadFailure = computed(() => this.text().errorText);
  protected readonly saveFailure = computed(() => {
    const error = this.saveError();
    if (!error) {
      return null;
    }
    return CombinedGraphQLErrors.is(error) &&
      error.errors.some((failure) => failure.extensions?.['code'] === 'FORBIDDEN')
      ? this.text().administratorRequired
      : this.text().drawer.saveError;
  });
  protected readonly fieldFailures = computed(() =>
    fieldErrors<UserField>(
      this.saveError(),
      ['name', 'email', 'role', 'password'],
      this.language(),
      (code) => (code === 'DUPLICATE' ? this.text().drawer.emailInUse : undefined),
    ),
  );

  ngOnInit(): void {
    this.api.initialize(this.language());
    if (this.creating) {
      this.state.set('ready');
      return;
    }
    const id = this.id;
    if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      this.state.set('invalid-id');
      return;
    }
    this.retry
      .pipe(
        startWith(undefined),
        switchMap(() => {
          this.state.set('loading');
          this.loadError.set(null);
          return this.api.watch().valueChanges.pipe(
            catchError((error: unknown) => {
              this.failRead(error);
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        if (result.error) {
          this.failRead(result.error);
        } else if (result.dataState === 'complete' && !result.loading) {
          const user = result.data.users.find((candidate) => candidate.id === id);
          if (!user) {
            this.state.set('not-found');
            return;
          }
          if (this.state() !== 'ready') {
            this.user.set(user);
          }
          this.state.set('ready');
        }
      });
  }

  async save(form: UserForm): Promise<void> {
    if (this.saving() || this.state() !== 'ready' || !this.canManage()) {
      return;
    }
    this.saving.set(true);
    this.saveError.set(null);
    try {
      const user = this.id
        ? await this.api.update({
            id: this.id,
            name: form.name,
            email: form.email,
            role: form.role,
          })
        : await this.api.create({
            name: form.name,
            email: form.email,
            password: form.password,
            role: form.role,
          });
      if (!this.current()) {
        return;
      }
      if (user.id === this.session.user()?.id) {
        this.session.updateUser(user);
      }
      this.drawer()?.markSaved();
      this.saving.set(false);
      this.closingAfterSave = true;
      this.host.saved({
        recordId: user.id,
        message: interpolate(this.creating ? this.text().created : this.text().saved, {
          name: user.name,
        }),
      });
      await this.router.navigate(this.listLink, {
        queryParamsHandling: 'preserve',
        preserveFragment: true,
      });
    } catch (error: unknown) {
      if (this.current()) {
        this.saveError.set(error);
      }
    } finally {
      if (this.current()) {
        this.saving.set(false);
        this.closingAfterSave = false;
      }
    }
  }

  canLeave(): boolean | Promise<boolean> {
    return this.closingAfterSave || (!this.saving() && (this.drawer()?.canLeave() ?? true));
  }

  private failRead(error: unknown): void {
    this.loadError.set(error);
    this.state.set('error');
    this.api.expireUnauthorized(error);
  }

  private current(): boolean {
    return !this.destroyRef.destroyed && this.session.current()?.token === this.api.token;
  }
}
