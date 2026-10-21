import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  ActivatedRoute,
  RouterLink,
  RouterLinkActive,
  type IsActiveMatchOptions,
} from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { PageHeader } from '../../../ui/page-header/page-header';
import type { Language } from '../../../i18n/messages';
import { karmaCarNavigationContext, karmaCarReturnQuery } from './karma-car-context';
import bg from './bg.json';
import en from './en.json';

const catalogs: Record<Language, typeof en> = { bg, en };

@Component({
  imports: [PageHeader, RouterLink, RouterLinkActive, ButtonDirective],
  selector: 'holita-karma-car-header',
  styleUrl: './karma-car-header.scss',
  templateUrl: './karma-car-header.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KarmaCarHeader {
  readonly language = input.required<Language>();
  readonly carId = input.required<string>();
  readonly carNumber = input<string | null>();
  readonly title = input.required<string>();
  readonly canNavigate = input(true);
  readonly busy = input(false);
  readonly error = input(false);
  readonly refreshDisabled = input(false);
  readonly refreshRequest = output();
  protected readonly text = computed(() => catalogs[this.language()]);
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  protected readonly returnQuery = computed(() => karmaCarReturnQuery(this.params()));
  protected readonly navigationContext = computed(() => karmaCarNavigationContext(this.params()));
  protected readonly description = computed(
    () => `${this.carNumber() || this.text().truck} · ${this.text().carId} ${this.carId()}`,
  );
  protected readonly tabs = computed(() => [
    { path: '', label: this.text().overview },
    { path: 'edata', label: this.text().edata },
    { path: 'location', label: this.text().location },
    { path: 'trips', label: this.text().trips },
    { path: 'events', label: this.text().events },
    { path: 'driving-profile', label: this.text().drivingProfile },
  ]);
  protected readonly activeMatch: IsActiveMatchOptions = {
    paths: 'exact',
    queryParams: 'ignored',
    matrixParams: 'ignored',
    fragment: 'ignored',
  };
}
