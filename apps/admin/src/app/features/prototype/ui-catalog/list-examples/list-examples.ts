import {
  Component,
  computed,
  type ElementRef,
  input,
  signal,
  viewChild,
  type OnInit,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { type MenuItem, type SortEvent } from 'primeng/api';
import { TableModule } from 'primeng/table';
import { Paginator, type PaginatorState } from 'primeng/paginator';
import { Select } from 'primeng/select';
import { Menu } from 'primeng/menu';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { ButtonDirective } from 'primeng/button';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import { messages, type Language } from '../../../../i18n/messages';

type ExampleRow = { id: string; code: string; name: string; active: boolean };
type ExampleDialog = 'create' | 'edit' | 'view' | 'delete';

@Component({
  selector: 'holita-list-examples',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    TableModule,
    Paginator,
    Select,
    Menu,
    Dialog,
    InputText,
    ButtonDirective,
    ToggleSwitch,
    Message,
    Tag,
  ],
  templateUrl: './list-examples.html',
  styleUrl: '../catalog-examples.scss',
})
export class ListExamples implements OnInit {
  readonly language = input.required<Language>();
  readonly text = computed(() => messages[this.language()]);
  readonly rows = signal<ExampleRow[]>([]);
  readonly search = signal('');
  readonly status = signal<'all' | 'active' | 'draft'>('all');
  readonly first = signal(0);
  readonly pageSize = signal(5);
  readonly sort = signal<{ field: 'name' | 'code' | 'active'; order: number } | null>(null);
  readonly selected = signal<ExampleRow[]>([]);
  readonly notice = signal('');
  readonly dialog = signal<ExampleDialog | null>(null);
  readonly current = signal<ExampleRow | null>(null);
  readonly targets = signal<ExampleRow[]>([]);
  readonly menuItems = signal<MenuItem[]>([]);
  readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [
        (control) => Validators.required(control),
        Validators.pattern(/\S/),
        Validators.maxLength(200),
      ],
    }),
    active: new FormControl(true, { nonNullable: true }),
  });
  readonly statusOptions = computed(() => [
    { label: this.text().allStatuses, value: 'all' },
    { label: this.text().active, value: 'active' },
    { label: this.text().draft, value: 'draft' },
  ]);
  readonly filtered = computed(() => {
    const search = this.search().trim().toLocaleLowerCase(this.language());
    const status = this.status();
    const sort = this.sort();
    const rows = this.rows().filter(
      (row) =>
        row.name.toLocaleLowerCase(this.language()).includes(search) &&
        (status === 'all' || row.active === (status === 'active')),
    );
    return sort
      ? rows.sort((a, b) => {
          const difference =
            sort.field === 'active'
              ? Number(a.active) - Number(b.active)
              : a[sort.field].localeCompare(b[sort.field], this.language());
          return difference * sort.order || a.id.localeCompare(b.id);
        })
      : rows;
  });
  readonly page = computed(() =>
    this.filtered().slice(this.first(), this.first() + this.pageSize()),
  );
  readonly dialogTitle = computed(() => {
    const mode = this.dialog();
    return mode === 'create'
      ? this.text().catalogAdd
      : mode === 'edit'
        ? this.text().catalogEdit
        : mode === 'delete'
          ? this.text().catalogDeleteTitle
          : this.text().catalogView;
  });
  private readonly menu = viewChild.required(Menu);
  private readonly nameInput = viewChild<ElementRef<HTMLInputElement>>('nameInput');
  private readonly searchInput = viewChild.required<ElementRef<HTMLInputElement>>('searchInput');
  private readonly cancelButton = viewChild<ElementRef<HTMLButtonElement>>('cancelButton');
  private opener: HTMLElement | null = null;
  private nextId = 13;

  ngOnInit(): void {
    const t = this.text();
    const names = [
      t.catalogLinen,
      t.catalogMug,
      t.catalogNotebook,
      t.catalogScarf,
      t.catalogBottle,
      t.catalogPouch,
      t.catalogBlanket,
      t.catalogJournal,
      t.catalogTray,
      t.catalogCandle,
      t.catalogWallet,
      t.catalogPen,
    ];
    this.rows.set(
      names.map((name, index) => ({
        id: String(index + 1).padStart(3, '0'),
        code: 'EX-' + String(index + 1).padStart(3, '0'),
        name,
        active: index % 3 !== 0,
      })),
    );
  }

  changeSearch(value: string): void {
    this.search.set(value);
    this.resetPage();
  }
  changeStatus(value: unknown): void {
    if (value === 'all' || value === 'active' || value === 'draft') {
      this.status.set(value);
      this.resetPage();
    }
  }
  clearFilters(): void {
    this.search.set('');
    this.status.set('all');
    this.resetPage();
  }
  private resetPage(): void {
    this.first.set(0);
    this.selected.set([]);
    this.menu().hide();
  }
  changePage(event: PaginatorState): void {
    this.first.set(event.first ?? 0);
    this.pageSize.set(event.rows ?? 5);
    this.selected.set([]);
    this.menu().hide();
  }
  sortChanged(event: SortEvent): void {
    if (event.field === 'name' || event.field === 'code' || event.field === 'active') {
      this.sort.set({ field: event.field, order: event.order === -1 ? -1 : 1 });
      this.resetPage();
    }
  }
  selectRows(value: unknown): void {
    if (!Array.isArray(value)) return;
    const candidates: readonly unknown[] = value;
    this.selected.set(
      this.page().filter((row) =>
        candidates.some(
          (candidate) =>
            typeof candidate === 'object' &&
            candidate !== null &&
            'id' in candidate &&
            candidate.id === row.id,
        ),
      ),
    );
  }
  openMenu(row: ExampleRow, event: Event): void {
    this.opener = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    this.menuItems.set([
      {
        label: this.text().catalogViewAction,
        command: () => {
          this.openDialog('view', row);
        },
      },
      {
        label: this.text().catalogEditAction,
        command: () => {
          this.openDialog('edit', row);
        },
      },
      {
        label: this.text().deleteProduct,
        command: () => {
          this.openDelete([row]);
        },
      },
    ]);
    this.menu().toggle(event);
  }
  openDialog(mode: 'create' | 'edit' | 'view', row: ExampleRow | null, event?: Event): void {
    if (event)
      this.opener = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    this.current.set(row);
    this.form.reset({ name: row?.name ?? '', active: row?.active ?? true });
    this.dialog.set(mode);
  }
  openDelete(rows: ExampleRow[], event?: Event): void {
    if (!rows.length) return;
    if (event)
      this.opener = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    this.targets.set([...rows]);
    this.dialog.set('delete');
  }
  focusDialog(): void {
    if (this.dialog() === 'create' || this.dialog() === 'edit')
      this.nameInput()?.nativeElement.focus();
    else this.cancelButton()?.nativeElement.focus();
  }
  restoreFocus(): void {
    (this.opener?.isConnected ? this.opener : this.searchInput().nativeElement).focus();
  }
  save(): void {
    if (this.dialog() !== 'create' && this.dialog() !== 'edit') return;
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.nameInput()?.nativeElement.focus();
      return;
    }
    const value = this.form.getRawValue();
    const row = this.current();
    if (row)
      this.rows.update((rows) =>
        rows.map((item) =>
          item.id === row.id ? { ...item, name: value.name.trim(), active: value.active } : item,
        ),
      );
    else {
      const id = String(this.nextId++).padStart(3, '0');
      this.rows.update((rows) => [
        ...rows,
        { id, code: 'EX-' + id, name: value.name.trim(), active: value.active },
      ]);
    }
    this.clearFilters();
    this.notice.set(this.text().catalogSaved);
    this.dialog.set(null);
  }
  deleteExamples(): void {
    if (this.dialog() !== 'delete') return;
    const ids = new Set(this.targets().map((row) => row.id));
    this.rows.update((rows) => rows.filter((row) => !ids.has(row.id)));
    this.selected.set([]);
    this.first.set(
      Math.max(
        0,
        Math.min(
          this.first(),
          (Math.ceil(this.filtered().length / this.pageSize()) - 1) * this.pageSize(),
        ),
      ),
    );
    this.notice.set(this.text().catalogDeleted);
    this.dialog.set(null);
  }
}
