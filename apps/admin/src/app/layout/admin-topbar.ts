import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  type ElementRef,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Bars } from '@primeicons/angular/bars';
import { ChevronRight } from '@primeicons/angular/chevron-right';
import { Moon } from '@primeicons/angular/moon';
import { SignOut } from '@primeicons/angular/sign-out';
import { Sun } from '@primeicons/angular/sun';
import { Select } from 'primeng/select';
import { messages, type Language } from '../i18n/messages';
import { Appearance } from '../theme/appearance';
import type { PageContext } from './navigation';

/** One entry of the interface-language menu, labelled in its own language. */
export interface LanguageOption {
  readonly code: string;
  readonly label: string;
}

/** Menu/rail toggle, page context, Branch switcher, language, theme and sign-out. */
@Component({
  selector: 'holita-admin-topbar',
  imports: [ReactiveFormsModule, RouterLink, Select, Bars, ChevronRight, Moon, SignOut, Sun],
  templateUrl: './admin-topbar.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminTopbar {
  readonly language = input.required<Language>();
  /** The menu is shown only when there is more than one language to choose from. */
  readonly languages = input<readonly LanguageOption[]>([]);
  readonly languageChange = output<string>();
  readonly context = input<PageContext | null>(null);
  readonly branches = input.required<readonly { id: string; name: string }[]>();
  readonly branchControl = input.required<FormControl<string | null>>();
  readonly loading = input(false);
  readonly tenantName = input<string | null>(null);
  readonly homeLink = input.required<readonly string[]>();
  readonly showLogo = input(false);
  readonly menuExpanded = input(false);
  readonly menuControls = input.required<string>();
  readonly menuToggle = output();
  readonly signOut = output();

  protected readonly appearance = inject(Appearance);
  protected readonly text = computed(() => messages[this.language()]);
  protected readonly branchOptions = computed(() => [...this.branches()]);
  protected readonly languageOptions = computed(() => [...this.languages()]);
  protected readonly languageControl = new FormControl<string | null>(null);
  private readonly menuButton = viewChild.required<ElementRef<HTMLButtonElement>>('menuButton');

  constructor() {
    effect(() => {
      this.languageControl.setValue(this.language(), { emitEvent: false });
    });
    this.languageControl.valueChanges.pipe(takeUntilDestroyed()).subscribe((code) => {
      if (code && code !== this.language()) this.languageChange.emit(code);
    });
  }

  focusMenu(): void {
    this.menuButton().nativeElement.focus();
  }
}
