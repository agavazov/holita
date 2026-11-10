import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Search } from '@primeicons/angular/search';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputText } from 'primeng/inputtext';
import { SelectButton } from 'primeng/selectbutton';
import type { Language } from '../../../i18n/messages';
import { FaultIcon } from '../../../ui/fleet-live/fault-icon';
import { faultsText, severityTone } from '../../../ui/fleet-live/fault-wording';
import { injectFleetFormat } from '../../../ui/format/fleet-format';
import { formatRelative } from '../../../ui/format/format';
import { interpolate } from '../../../ui/i18n/messages';
import {
  isMoving,
  truckFilters,
  truckMatches,
  type LiveTruck,
  type TruckFilter,
} from './live-dashboard-model';
import { liveDashboardText } from './live-dashboard-text';

@Component({
  selector: 'discocan-live-truck-list',
  imports: [FaultIcon, FormsModule, IconField, InputIcon, InputText, SelectButton, Search],
  template: `
    <div class="truck-list__tools">
      <p-iconfield>
        <p-inputicon><svg data-p-icon="search" aria-hidden="true"></svg></p-inputicon>
        <input
          pInputText
          type="search"
          class="truck-list__search"
          [attr.aria-label]="text().search"
          [placeholder]="text().searchPlaceholder"
          [ngModel]="search()"
          (ngModelChange)="search.set($event)"
        />
      </p-iconfield>
      <p-selectbutton
        size="small"
        [options]="filterOptions()"
        optionLabel="label"
        optionValue="value"
        [allowEmpty]="false"
        [ariaLabel]="text().filter"
        [ngModel]="filter()"
        (ngModelChange)="filter.set($event)"
      />
    </div>
    <ul class="truck-list__items" [attr.aria-label]="text().list">
      @for (truck of shown(); track truck.id) {
        <li>
          <button
            type="button"
            class="truck-list__item"
            [class.truck-list__item--selected]="truck.id === selectedId()"
            [attr.aria-pressed]="truck.id === selectedId()"
            [attr.aria-label]="selectLabel(truck)"
            (click)="truckSelect.emit(truck.id)"
          >
            <span
              class="truck-list__dot"
              [class.truck-list__dot--online]="truck.online"
              [class.truck-list__dot--moving]="moving(truck)"
              [title]="truck.online ? text().online : text().offline"
            ></span>
            <span class="truck-list__main">
              <span class="truck-list__line">
                <strong class="app-plate">{{ truck.plate }}</strong>
                @for (fault of truck.faults; track fault.system) {
                  <discocan-fault-icon
                    class="truck-list__fault"
                    [attr.data-tone]="tone(fault.severity)"
                    [system]="fault.system"
                    [title]="faults().systems[fault.system]"
                  />
                }
                @if (truck.alerts) {
                  <span
                    class="truck-list__alert"
                    [class.truck-list__alert--danger]="truck.severity === 'CRITICAL'"
                    [title]="problemLabel(truck)"
                    >! {{ truck.alerts }}</span
                  >
                }
                <span class="truck-list__speed">
                  {{ moving(truck) ? format.speed(truck.speedKph) : '' }}
                </span>
              </span>
              <span class="truck-list__meta" [title]="subtitle(truck)">
                {{ truck.online ? text().activity[truck.activity] : text().offline }} ·
                {{ truck.positionAt ? relative(truck.positionAt) : text().noPosition }}
              </span>
            </span>
          </button>
        </li>
      } @empty {
        <li class="truck-list__empty">
          {{ trucks().length ? text().noMatch : text().noTrucks }}
        </li>
      }
    </ul>
  `,
  styleUrl: './live-truck-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LiveTruckList {
  readonly language = input.required<Language>();
  readonly trucks = input<readonly LiveTruck[]>([]);
  readonly selectedId = input<string | null>(null);
  readonly now = input.required<number>();
  readonly filter = model<TruckFilter>('all');
  readonly search = model('');
  readonly truckSelect = output<string>();

  protected readonly format = injectFleetFormat();
  protected readonly text = computed(() => liveDashboardText(this.language()));
  protected readonly faults = computed(() => faultsText(this.language()));
  protected readonly tone = severityTone;
  protected readonly filterOptions = computed(() =>
    truckFilters.map((value) => ({
      value,
      label: `${this.text().filters[value]} ${String(
        this.trucks().filter((truck) => truckMatches(truck, value, '')).length,
      )}`,
    })),
  );
  protected readonly shown = computed(() =>
    this.trucks().filter((truck) => truckMatches(truck, this.filter(), this.search())),
  );

  protected relative(iso: string): string {
    return formatRelative(iso, this.now(), this.language());
  }

  protected selectLabel(truck: LiveTruck): string {
    return interpolate(this.text().select, { plate: truck.plate });
  }

  protected problemLabel(truck: LiveTruck): string {
    return interpolate(this.text().problemCount, { count: truck.alerts });
  }

  protected moving(truck: LiveTruck): boolean {
    return isMoving(truck);
  }

  protected subtitle(truck: LiveTruck): string {
    return [truck.driver, truck.vehicle].filter(Boolean).join(' · ');
  }
}
