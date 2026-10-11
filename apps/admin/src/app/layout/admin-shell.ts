import {
  Component,
  computed,
  effect,
  type ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  Router,
  RouterLink,
  type UrlTree,
} from '@angular/router';
import { filter } from 'rxjs';
import { Bars } from '@primeicons/angular/bars';
import { Moon } from '@primeicons/angular/moon';
import { Sun } from '@primeicons/angular/sun';
import { Select } from 'primeng/select';
import { Drawer } from 'primeng/drawer';
import { Message } from 'primeng/message';
import { messages, type Language } from '../i18n/messages';
import { AdminNavigation } from './admin-navigation';
import { Appearance } from './appearance';

@Component({
  selector: 'holita-admin-shell',
  imports: [
    RouterLink,
    NgTemplateOutlet,
    ReactiveFormsModule,
    Select,
    Drawer,
    Message,
    Bars,
    Moon,
    Sun,
    AdminNavigation,
  ],
  templateUrl: './admin-shell.html',
  host: { '(window:resize)': 'onResize()' },
})
export class AdminShell {
  readonly stores = input.required<readonly { id: string; name: string }[]>();
  readonly storeOptions = computed(() => [...this.stores()]);
  readonly storeId = input<string | null>(null);
  readonly storeControl = new FormControl<string | null>(null);
  readonly language = input.required<Language>();
  readonly languageUrl = input.required<UrlTree>();
  readonly loading = input(false);
  readonly referenceEnabled = input(false);
  readonly storeSelected = output<string>();
  readonly text = computed(() => messages[this.language()]);
  readonly appearance = inject(Appearance);
  readonly desktopCollapsed = signal(false);
  readonly mobileOpen = signal(false);
  readonly mobile = signal(window.innerWidth < 992);
  private readonly navigationToggle =
    viewChild.required<ElementRef<HTMLButtonElement>>('navigationToggle');

  constructor() {
    effect(() => {
      this.storeControl.setValue(this.storeId(), { emitEvent: false });
    });
    effect(() => {
      if (this.loading() && this.stores().length === 0)
        this.storeControl.disable({ emitEvent: false });
      else this.storeControl.enable({ emitEvent: false });
    });
    this.storeControl.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      this.chooseStore(value);
    });
    inject(Router)
      .events.pipe(
        filter(
          (event) =>
            event instanceof NavigationEnd ||
            event instanceof NavigationCancel ||
            event instanceof NavigationError,
        ),
        takeUntilDestroyed(),
      )
      .subscribe((event) => {
        // Resync after Select's event handler has finished; canceled navigation leaves the route unchanged.
        this.storeControl.setValue(this.storeId(), { emitEvent: false });
        if (event instanceof NavigationEnd) this.mobileOpen.set(false);
      });
  }

  onResize(): void {
    this.mobile.set(window.innerWidth < 992);
    if (!this.mobile() && this.mobileOpen()) this.drawerVisibilityChanged(false);
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
    document.getElementById('mobile-navigation-close')?.focus();
  }

  drawerVisibilityChanged(visible: boolean): void {
    this.mobileOpen.set(visible);
    if (!visible) this.navigationToggle().nativeElement.focus();
  }
}
