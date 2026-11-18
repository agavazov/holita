import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { FleetFaultSystem } from '../../../generated/graphql/operations';

/** Telltale-style symbol of a vehicle system, drawn in the current text colour. */
@Component({
  selector: 'discocan-fault-icon',
  template: `
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      @switch (system()) {
        @case ('ENGINE') {
          <path d="M10 5h4M12 5v3M3.5 10v5M3.5 12.5H6" />
          <path d="M6 9.5h2L9 8h6.5l2 2H19V8.5h2v7h-2V14h-1.5L15 17H9.5l-2-2H6z" />
        }
        @case ('BRAKES') {
          <circle cx="12" cy="12" r="6" />
          <path d="M12 9v3.6M12 15.2v.01M5 7.2a8.5 8.5 0 0 0 0 9.6M19 7.2a8.5 8.5 0 0 1 0 9.6" />
        }
        @case ('ABS_EBS') {
          <circle cx="12" cy="12" r="6" />
          <path d="M5 7.2a8.5 8.5 0 0 0 0 9.6M19 7.2a8.5 8.5 0 0 1 0 9.6" />
          <text
            x="12"
            y="13.9"
            text-anchor="middle"
            font-size="5.2"
            font-weight="700"
            font-family="inherit"
            fill="currentColor"
            stroke="none"
          >
            ABS
          </text>
        }
        @case ('AFTERTREATMENT') {
          <rect x="6" y="8" width="12" height="8" rx="2" />
          <path d="M2.5 12H6M18 12h3.5" />
          <path d="M9.5 11v.01M12 13v.01M14.5 11v.01M9.5 14v.01M14.5 14v.01" stroke-width="2.2" />
        }
        @case ('CAN_BUS') {
          <path d="M2.5 13h19M6.5 9v4M17.5 9v4M12 13v3.5" />
          <rect x="4.5" y="5" width="4" height="4" rx="1" />
          <rect x="15.5" y="5" width="4" height="4" rx="1" />
          <rect x="10" y="16.5" width="4" height="3.5" rx="1" />
        }
        @case ('POWER') {
          <rect x="3" y="7.5" width="18" height="11" rx="1.5" />
          <path d="M6.5 7.5v-2H9v2M15 7.5v-2h2.5v2M6.5 13H10M14 13h3.5M15.75 11.25v3.5" />
        }
        @default {
          <path d="M12 4 3 19.5h18z" />
          <path d="M12 10v4.2M12 16.8v.01" />
        }
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      inline-size: 1.5rem;
      block-size: 1.5rem;
    }

    svg {
      inline-size: 100%;
      block-size: 100%;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FaultIcon {
  readonly system = input.required<FleetFaultSystem>();
}
