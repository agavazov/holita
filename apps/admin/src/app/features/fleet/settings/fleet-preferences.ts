import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Subject, catchError, startWith, switchMap } from 'rxjs';
import type { AdminFleetSettingsFragment } from '../../../../generated/graphql/operations';
import type { Language } from '../../../i18n/messages';
import { GeneralSettingsApi } from './general-settings-api';

/** One mounted Fleet workspace owns its preferences read and captured client. */
@Injectable()
export class FleetPreferences {
  private readonly api = inject(GeneralSettingsApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reload = new Subject<void>();
  private scope: string | null = null;
  readonly settings = signal<AdminFleetSettingsFragment | null>(null);
  readonly loading = signal(true);
  readonly error = signal<unknown>(null);

  initialize(branchId: string, language: Language): void {
    const scope = `${branchId}/${language}`;
    if (this.scope === scope) {
      return;
    }
    if (this.scope) {
      throw new Error('FleetPreferences belongs to one Branch and language workspace.');
    }
    this.scope = scope;
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
    this.settings.set(settings);
    this.loading.set(false);
    this.error.set(null);
  }
}
