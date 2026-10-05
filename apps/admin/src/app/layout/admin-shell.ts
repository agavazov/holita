import {
  Component,
  computed,
  type ElementRef,
  HostListener,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink, type UrlTree } from '@angular/router';
import { filter } from 'rxjs';
import { Bars } from '@primeicons/angular/bars';
import { Moon } from '@primeicons/angular/moon';
import { Sun } from '@primeicons/angular/sun';
import { Select } from 'primeng/select';
import { Drawer } from 'primeng/drawer';
import { messages, type Language } from '../i18n/messages';
import { AdminNavigation } from './admin-navigation';
import { Appearance } from './appearance';

@Component({
  selector: 'holita-admin-shell',
  imports: [RouterLink, FormsModule, Select, Drawer, Bars, Moon, Sun, AdminNavigation],
  templateUrl: './admin-shell.html',
})
export class AdminShell {
  readonly stores = input.required<readonly { id: string; name: string }[]>();
  readonly storeOptions = computed(() => [...this.stores()]);
  readonly storeId = input<string | null>(null);
  readonly language = input.required<Language>();
  readonly languageUrl = input.required<UrlTree>();
  readonly loading = input(false);
  readonly storeSelected = output<string>();
  readonly text = computed(() => messages[this.language()]);
  readonly appearance = inject(Appearance);
  readonly desktopCollapsed = signal(false);
  readonly mobileOpen = signal(false);
  readonly mobile = signal(window.innerWidth < 992);
  private readonly navigationToggle =
    viewChild.required<ElementRef<HTMLButtonElement>>('navigationToggle');
  private readonly drawer = viewChild.required(Drawer);

  constructor() {
    inject(Router)
      .events.pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        this.mobileOpen.set(false);
      });
  }

  @HostListener('window:resize')
  onResize(): void {
    this.mobile.set(window.innerWidth < 992);
    if (!this.mobile()) this.mobileOpen.set(false);
  }

  toggleNavigation(): void {
    if (this.mobile()) this.mobileOpen.update((open) => !open);
    else this.desktopCollapsed.update((collapsed) => !collapsed);
  }

  chooseStore(value: unknown): void {
    if (typeof value === 'string' && this.stores().some((store) => store.id === value))
      this.storeSelected.emit(value);
  }

  focusNavigation(): void {
    this.drawer().container?.querySelector<HTMLButtonElement>('button')?.focus();
  }

  drawerVisibilityChanged(visible: boolean): void {
    this.mobileOpen.set(visible);
    if (!visible) this.navigationToggle().nativeElement.focus();
  }
}
