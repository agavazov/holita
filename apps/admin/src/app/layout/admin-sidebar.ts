import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Bell } from '@primeicons/angular/bell';
import { Car } from '@primeicons/angular/car';
import { Clock } from '@primeicons/angular/clock';
import { Directions } from '@primeicons/angular/directions';
import { Folder } from '@primeicons/angular/folder';
import { IdCard } from '@primeicons/angular/id-card';
import { InfoCircle } from '@primeicons/angular/info-circle';
import { Mobile } from '@primeicons/angular/mobile';
import { Shield } from '@primeicons/angular/shield';
import { Tags } from '@primeicons/angular/tags';
import { ThLarge } from '@primeicons/angular/th-large';
import { Truck } from '@primeicons/angular/truck';
import { Users } from '@primeicons/angular/users';
import { Wrench } from '@primeicons/angular/wrench';
import { Tooltip } from 'primeng/tooltip';
import { messages, type Language } from '../i18n/messages';
import type { NavGroup } from './navigation';

/** Logo, grouped navigation (full or rail) and the tenant line. Presentation only. */
@Component({
  selector: 'holita-admin-sidebar',
  imports: [
    RouterLink,
    RouterLinkActive,
    Tooltip,
    Bell,
    Car,
    Clock,
    Directions,
    Folder,
    IdCard,
    InfoCircle,
    Mobile,
    Shield,
    Tags,
    ThLarge,
    Truck,
    Users,
    Wrench,
  ],
  templateUrl: './admin-sidebar.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminSidebar {
  readonly navigation = input.required<readonly NavGroup[]>();
  readonly language = input.required<Language>();
  readonly homeLink = input.required<readonly string[]>();
  readonly tenantName = input<string | null>(null);
  readonly rail = input(false);
  /** The mobile drawer shows the logo in its own header. */
  readonly showLogo = input(true);
  /** Prefix for group heading IDs; the desktop and drawer instances never coexist. */
  readonly idPrefix = input('nav');

  protected readonly text = computed(() => messages[this.language()]);
}
