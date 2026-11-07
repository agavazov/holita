import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Subject, catchError, startWith, switchMap } from 'rxjs';
import type { AdminFleetSettingsFragment } from '../../../../generated/graphql/operations';
import type { Language } from '../../../i18n/messages';
import { DemoSession } from '../../../core/auth/demo-session';
import { BranchContext } from '../../branches/branch-context';
import { GeneralSettingsApi } from './general-settings-api';

/** Retain only the current Branch's loaded preferences within the signed-in workspace. */
@Injectable()
export class FleetPreferencesSession {
  private readonly session = inject(DemoSession);
  private readonly branches = inject(BranchContext);
  private readonly scope = computed(
    () => `${this.session.current()?.token ?? ''}/${this.branches.selectedId() ?? ''}`,
  );
  private cached: { scope: string; settings: AdminFleetSettingsFragment } | null = null;

  constructor() {
    effect(() => {
      this.scope();
      this.cached = null;
    });
  }

  read(scope: string): AdminFleetSettingsFragment | null {
    return this.cached?.scope === scope ? this.cached.settings : null;
  }

  apply(scope: string, settings: AdminFleetSettingsFragment): void {
    this.cached = { scope, settings };
  }
}

/** Each mounted reader retains its captured client; loaded values survive menu navigation. */
@Injectable()
export class FleetPreferences {
  private readonly api = inject(GeneralSettingsApi);
  private readonly session = inject(DemoSession);
  private readonly retained = inject(FleetPreferencesSession);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reload = new Subject<void>();
  private scope: string | null = null;
  readonly settings = signal<AdminFleetSettingsFragment | null>(null);
  readonly loading = signal(true);
  readonly error = signal<unknown>(null);

  initialize(branchId: string, language: Language): void {
    const scope = `${this.session.capture().token}/${branchId}/${language}`;
    if (this.scope === scope) {
      return;
    }
    if (this.scope) {
      throw new Error('FleetPreferences belongs to one Branch and language workspace.');
    }
    this.scope = scope;
    const retained = this.retained.read(scope);
    if (retained) {
      this.apply(retained);
      return;
    }
    this.api.initialize(branchId, language);
    this.reload
      .pipe(
        startWith(undefined),
        switchMap(() => {
          this.loading.set(true);
          this.error.set(null);
          return this.api.watchPreferences().valueChanges.pipe(
            catchError((error: unknown) => {
              this.loading.set(false);
              this.error.set(error);
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        this.loading.set(result.loading);
        if (result.error) {
          this.error.set(result.error);
        } else if (result.dataState === 'complete') {
          this.apply(result.data.fleetSettings);
        }
      });
  }

  retry(): void {
    this.reload.next();
  }

  apply(settings: AdminFleetSettingsFragment): void {
    if (this.scope) {
      this.retained.apply(this.scope, settings);
    }
    this.settings.set(settings);
    this.loading.set(false);
    this.error.set(null);
  }
}
