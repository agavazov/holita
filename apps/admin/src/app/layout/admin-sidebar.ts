import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { Bell } from '@primeicons/angular/bell';
import { Car } from '@primeicons/angular/car';
import { Clock } from '@primeicons/angular/clock';
import { Directions } from '@primeicons/angular/directions';
import { Envelope } from '@primeicons/angular/envelope';
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
import { filter, map } from 'rxjs';
import { messages, type Language } from '../i18n/messages';
import { navigationContext, type NavGroup } from './navigation';

/** Logo, grouped navigation (full or rail) and the tenant line. Presentation only. */
@Component({
  selector: 'holita-admin-sidebar',
  imports: [
    RouterLink,
    Tooltip,
    Bell,
    Car,
    Clock,
    Directions,
    Envelope,
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
  private readonly router = inject(Router);
  private readonly path = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );
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
  protected readonly activeLink = computed(
    () => navigationContext(this.navigation(), this.path())?.pageLink,
  );
}
