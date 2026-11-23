import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { OperatorLanguage, operatorStrings } from '@holita/operator';
import { FormField, textValidator, validationMessage } from '@osnova/ui';
import { InputText } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';
import type { OperatorInvoiceIssuerFieldsFragment } from '../generated/orders-operations';

export function invoiceTextControl(max: number, required = false) {
  return new FormControl('', { nonNullable: true, validators: [textValidator(max, { required })] });
}

export function invoiceIssuerForm(required = false) {
  return new FormGroup({
    issuerName: invoiceTextControl(200, required),
    issuerCompanyId: invoiceTextControl(100, required),
    issuerVatNumber: invoiceTextControl(100),
    issuerAddress: invoiceTextControl(1000, required),
    issuerRepresentative: invoiceTextControl(128),
    issuerBankName: invoiceTextControl(128),
    issuerIban: invoiceTextControl(64),
    issuerBic: invoiceTextControl(32),
  });
}

export function issuerFormValues(settings: OperatorInvoiceIssuerFieldsFragment) {
  return {
    issuerName: settings.issuerName ?? '',
    issuerCompanyId: settings.issuerCompanyId ?? '',
    issuerVatNumber: settings.issuerVatNumber ?? '',
    issuerAddress: settings.issuerAddress ?? '',
    issuerRepresentative: settings.issuerRepresentative ?? '',
    issuerBankName: settings.issuerBankName ?? '',
    issuerIban: settings.issuerIban ?? '',
    issuerBic: settings.issuerBic ?? '',
  };
}

type IssuerForm = ReturnType<typeof invoiceIssuerForm>;
export type IssuerField = keyof IssuerForm['controls'];

const fields: readonly {
  key: IssuerField;
  label: keyof typeof operatorStrings.en;
  requiredAtIssue?: boolean;
  multiline?: boolean;
}[] = [
  { key: 'issuerName', label: 'name', requiredAtIssue: true },
  { key: 'issuerCompanyId', label: 'companyId', requiredAtIssue: true },
  { key: 'issuerVatNumber', label: 'vatNumber' },
  { key: 'issuerAddress', label: 'address', requiredAtIssue: true, multiline: true },
  { key: 'issuerRepresentative', label: 'invoiceIssuerRepresentative' },
  { key: 'issuerBankName', label: 'invoiceIssuerBank' },
  { key: 'issuerIban', label: 'invoiceIssuerIban' },
  { key: 'issuerBic', label: 'invoiceIssuerBic' },
];

export const issuerFieldKeys = fields.map((field) => field.key);

@Component({
  selector: 'holita-invoice-issuer-fields',
  imports: [FormField, InputText, ReactiveFormsModule, Textarea],
  templateUrl: './invoice-issuer-fields.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoiceIssuerFields {
  readonly form = input.required<IssuerForm>();
  readonly errors = input<Partial<Record<IssuerField, string>>>({});
  readonly issuing = input(false);
  readonly readOnly = input(false);
  readonly edited = output<IssuerField>();
  private readonly language = inject(OperatorLanguage).value;
  protected readonly text = computed(() => operatorStrings[this.language()]);
  protected readonly fields = fields;

  protected error(field: IssuerField): string | null {
    const control = this.form().controls[field];
    return (
      this.errors()[field] ??
      (control.touched ? validationMessage(control.errors, this.language()) : null)
    );
  }
}
