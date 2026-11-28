import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
  type ElementRef,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { OperatorLanguage, operatorStrings } from '@holita/operator';
import {
  FormField,
  RouteDrawer,
  TablePanel,
  fieldErrors,
  injectDrawerHost,
  tableView,
  toneSeverity,
  uiMessages,
  type TableColumn,
} from '@osnova/ui';
import { DemoSession } from '@osnova/ui/app';
import { ButtonDirective } from 'primeng/button';
import { Message } from 'primeng/message';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import type { OperatorImportCatalogueMutation } from '../generated/products-operations';
import { ProductsApi, canImportCatalogue } from './products-api';

type ImportJob = OperatorImportCatalogueMutation['importCatalogue'];
const maxFileBytes = 256 * 1024;

@Component({
  selector: 'holita-catalogue-import',
  imports: [
    ButtonDirective,
    FormField,
    Message,
    ReactiveFormsModule,
    RouteDrawer,
    TableModule,
    TablePanel,
    Tag,
  ],
  templateUrl: './catalogue-import.html',
  styles: `
    .import-wrap {
      min-inline-size: 0;
      white-space: normal;
      overflow-wrap: anywhere;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogueImport {
  private readonly api = inject(ProductsApi);
  private readonly host = injectDrawerHost();
  private readonly session = inject(DemoSession);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly language = inject(OperatorLanguage).value;
  protected readonly drawer = viewChild(RouteDrawer);
  private readonly jobId = viewChild<ElementRef<HTMLElement>>('jobId');
  private readonly picker = viewChild<ElementRef<HTMLButtonElement>>('picker');
  protected readonly text = computed(() => operatorStrings[this.language()]);
  protected readonly shared = computed(() => uiMessages[this.language()]);
  protected readonly form = new FormGroup({
    file: new FormControl<File | null>(null, (control) => Validators.required(control)),
  });
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly job = signal<ImportJob | null>(null);
  protected readonly canWrite = computed(
    () => canImportCatalogue(this.session.user()?.role) && !!this.api.scope(),
  );
  protected readonly tableView = computed(() =>
    tableView({ rows: this.job()?.rows.length ?? 0, loading: false, error: null, filtered: false }),
  );
  protected readonly columns = computed<readonly TableColumn[]>(() => [
    { id: 'row', label: this.text().catalogueImportRow, width: '4rem', kind: 'number' },
    { id: 'status', label: this.text().status, width: '8rem', kind: 'status' },
    { id: 'error', label: this.text().catalogueImportReason, width: 'auto', kind: 'text' },
  ]);
  protected readonly toneSeverity = toneSeverity;

  canLeave(): boolean | Promise<boolean> {
    return !this.saving() && (this.drawer()?.confirmLeave(this.form.dirty) ?? true);
  }

  protected chooseFile(input: HTMLInputElement): void {
    const file = input.files?.item(0);
    input.value = '';
    if (file) {
      this.form.controls.file.setValue(file);
      this.form.controls.file.markAsDirty();
      this.error.set(null);
    }
  }

  protected async submit(): Promise<void> {
    const scope = this.api.scope();
    const file = this.form.controls.file.value;
    if (!this.canWrite() || !scope || !file || this.saving()) {
      return;
    }
    if (file.size > maxFileBytes) {
      this.setError(this.text().catalogueImportFileTooLarge);
      return;
    }

    this.error.set(null);
    this.saving.set(true);
    afterNextRender(() => this.drawer()?.focusTitle(), { injector: this.injector });
    try {
      const bytes = await file.arrayBuffer();
      let csv: string;
      try {
        csv = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      } catch {
        this.setError(this.text().catalogueImportInvalidCsv);
        return;
      }
      const job = await this.api.importCatalogue(scope, file.name, csv);
      if (this.destroyRef.destroyed || this.api.scope() !== scope) {
        return;
      }
      this.job.set(job);
      this.form.reset();
      if (job.rows.some((row) => row.status === 'APPLIED')) {
        this.host.saved({ message: this.text().catalogueImportFinished, recordId: null });
      }
      afterNextRender(() => this.jobId()?.nativeElement.focus(), { injector: this.injector });
    } catch (error: unknown) {
      if (this.destroyRef.destroyed || this.api.scope() !== scope) {
        return;
      }
      const text = this.text();
      const reasons: Readonly<Record<string, string>> = {
        INVALID_CSV: text.catalogueImportInvalidCsv,
        INVALID_HEADER: text.catalogueImportInvalidHeader,
        EMPTY_FILE: text.catalogueImportEmptyFile,
        TOO_MANY_ROWS: text.catalogueImportTooManyRows,
        FILE_TOO_LARGE: text.catalogueImportFileTooLarge,
        INVALID_FILE_NAME: text.catalogueImportInvalidFileName,
      };
      const errors = fieldErrors(
        error,
        ['fileName', 'csv'],
        scope.language,
        (code) => reasons[code],
      );
      this.setError(errors.fileName ?? errors.csv ?? text.catalogueImportUnavailable);
    } finally {
      this.saving.set(false);
    }
  }

  protected rowError(code: string | null): string {
    const text = this.text();
    const reasons: Readonly<Record<string, string>> = {
      COLUMN_COUNT: text.catalogueImportColumnCount,
      INVALID_NAME: text.catalogueImportInvalidName,
      INVALID_SKU: text.catalogueImportInvalidSku,
      INVALID_PRICE: text.catalogueImportInvalidPrice,
      DUPLICATE_SKU: text.variantDuplicateSku,
    };
    return (code && reasons[code]) || text.catalogueImportRejectedDetails;
  }

  private setError(error: string): void {
    if (this.destroyRef.destroyed) {
      return;
    }
    this.error.set(error);
    afterNextRender(() => this.picker()?.nativeElement.focus(), { injector: this.injector });
  }
}
