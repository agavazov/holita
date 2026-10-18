import {
  ChangeDetectionStrategy,
  Component,
  computed,
  type ElementRef,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { type FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink, type UrlTree } from '@angular/router';
import { Bars } from '@primeicons/angular/bars';
import { ChevronRight } from '@primeicons/angular/chevron-right';
import { Moon } from '@primeicons/angular/moon';
import { SignOut } from '@primeicons/angular/sign-out';
import { Sun } from '@primeicons/angular/sun';
import { Select } from 'primeng/select';
import { messages, type Language } from '../i18n/messages';
import { Appearance } from '../theme/appearance';
import type { PageContext } from './navigation';

/** Menu/rail toggle, page context, Branch switcher, language, theme and sign-out. */
@Component({
  selector: 'holita-admin-topbar',
  imports: [ReactiveFormsModule, RouterLink, Select, Bars, ChevronRight, Moon, SignOut, Sun],
  templateUrl: './admin-topbar.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminTopbar {
  readonly language = input.required<Language>();
  readonly languageUrl = input.required<UrlTree>();
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
  protected readonly otherLanguage = computed(() => (this.language() === 'bg' ? 'en' : 'bg'));
  private readonly menuButton = viewChild.required<ElementRef<HTMLButtonElement>>('menuButton');

  focusMenu(): void {
    this.menuButton().nativeElement.focus();
  }
}
