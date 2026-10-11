import {
  Component,
  computed,
  DestroyRef,
  type ElementRef,
  inject,
  input,
  signal,
  viewChild,
  type OnInit,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { InputText } from 'primeng/inputtext';
import { RelationPicker, type RelationLoader } from '../relation-picker';
import { Message } from 'primeng/message';
import type {
  AdminStoresQuery,
  AdminDeviceFragment,
  CreateReferenceDeviceInput,
} from '../../../../generated/graphql/operations';
import { requestError } from '../../../core/graphql/request-error';
import { messages, type Language } from '../../../i18n/messages';
import { DevicesApi } from './devices-api';
import {
  deviceFieldErrors,
  deviceFields,
  deviceImei,
  deviceVehicle,
  type DeviceField,
} from './device-validation';

@Component({
  selector: 'holita-device-editor',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ButtonDirective,
    ConfirmDialog,
    InputText,
    RelationPicker,
    Message,
  ],
  providers: [DevicesApi, ConfirmationService],
  templateUrl: './device-editor.html',
  styleUrl: '../reference-editor.scss',
  host: { '(window:beforeunload)': 'beforeUnload($event)' },
})
export class DeviceEditor implements OnInit {
  readonly store = input.required<AdminStoresQuery['stores'][number]>();
  readonly language = input.required<Language>();
  readonly deviceId = input<string | null>(null);
  readonly text = computed(() => messages[this.language()]);
  private readonly api = inject(DevicesApi);
  private readonly router = inject(Router);
  private readonly confirmation = inject(ConfirmationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly editorForm = viewChild<ElementRef<HTMLFormElement>>('editorForm');
  private query: ReturnType<DevicesApi['watchDevice']> | undefined;
  private leaveDecision: Promise<boolean> | undefined;
  readonly form = new FormGroup({
    imei: new FormControl('', { nonNullable: true, validators: deviceImei }),
    vehicleId: new FormControl('', { nonNullable: true, validators: deviceVehicle }),
  });
  private readonly formEvents = toSignal(this.form.events);
  readonly loadVehicles: RelationLoader = (request) => this.api.vehicles(request);
  private readonly vehicleIdValue = toSignal(this.form.controls.vehicleId.valueChanges, {
    initialValue: '',
  });
  readonly selectedVehicleIds = computed(() => {
    const id = this.vehicleIdValue();
    return id ? [id] : [];
  });
  selectVehicle(ids: string[]): void {
    if (this.pending()) return;
    this.form.controls.vehicleId.setValue(ids[0] ?? '');
    this.form.controls.vehicleId.markAsDirty();
    this.form.controls.vehicleId.markAsTouched();
  }
  readonly ready = signal(false);
  readonly loading = signal(false);
  readonly pending = signal(false);
  private readonly readError = signal<unknown>(null);
  private readonly writeError = signal<unknown>(null);
  readonly error = computed(() => this.writeError() ?? this.readError());
  readonly retryAvailable = computed(() => this.readError() !== null && this.writeError() === null);
  readonly invalidId = computed(() => {
    const id = this.deviceId();
    return (
      id !== null && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    );
  });
  readonly failure = computed(() => requestError(this.error(), this.text().networkError));
  readonly serverErrors = computed(() => deviceFieldErrors(this.writeError()));
  readonly listLink = computed(() => [
    '/',
    this.language(),
    'stores',
    this.store().id,
    'reference',
    'devices',
  ]);

  ngOnInit(): void {
    this.api.initialize(this.store().id, this.language());
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (!this.pending()) this.writeError.set(null);
    });
    const id = this.deviceId();
    if (id === null) this.ready.set(true);
    else if (!this.invalidId()) {
      this.loading.set(true);
      this.query = this.api.watchDevice(id);
      this.query.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (result) => {
          this.loading.set(result.loading);
          this.readError.set(result.error ?? null);
          if (result.dataState === 'complete' && !result.error && !this.ready()) {
            this.hydrate(result.data.referenceDevice);
            this.ready.set(true);
          }
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.readError.set(error);
        },
      });
    }
  }

  private hydrate(device: AdminDeviceFragment): void {
    this.form.reset({
      imei: device.imei,
      vehicleId: device.vehicleId,
    });
  }

  fieldError(field: DeviceField): string {
    this.formEvents();
    const server = this.serverErrors()[field];
    if (server) return server;
    const control = this.form.controls[field];
    if (!control.touched || !control.invalid) return '';
    if (control.hasError('required'))
      return field === 'imei' ? this.text().imeiRequired : this.text().deviceVehicleRequired;
    if (control.hasError('imei')) return this.text().imeiHint;
    return '';
  }

  private focusField(field: DeviceField): void {
    this.editorForm()?.nativeElement.querySelector<HTMLElement>(`#device-${field}`)?.focus();
  }

  retry(): void {
    void this.query?.refetch().catch((error: unknown) => {
      if (!this.destroyRef.destroyed) this.readError.set(error);
    });
  }

  async save(): Promise<void> {
    if (!this.ready() || this.pending()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      const first = deviceFields.find((field) => this.form.controls[field].invalid);
      if (first) this.focusField(first);
      return;
    }
    const values = this.form.getRawValue();
    const input: CreateReferenceDeviceInput = {
      imei: values.imei.trim(),
      vehicleId: values.vehicleId,
    };
    this.pending.set(true);
    this.writeError.set(null);
    this.form.disable();
    let invalidField: DeviceField | undefined;
    try {
      const id = this.deviceId();
      const device =
        id === null ? await this.api.create({ input }) : await this.api.update({ id, input });
      if (this.destroyRef.destroyed) return;
      this.hydrate(device);
      await this.router.navigate(this.listLink(), {
        queryParamsHandling: 'preserve',
        preserveFragment: true,
        state: { deviceSaved: true },
      });
    } catch (error: unknown) {
      if (!this.destroyRef.destroyed) {
        this.writeError.set(error);
        const fields = deviceFieldErrors(error);
        invalidField = deviceFields.find((field) => fields[field]);
      }
    } finally {
      if (!this.destroyRef.destroyed) {
        this.pending.set(false);
        this.form.enable({ emitEvent: false });
        if (invalidField) this.focusField(invalidField);
      }
    }
  }

  routerBack(): void {
    void this.router.navigate(this.listLink(), {
      queryParamsHandling: 'preserve',
      preserveFragment: true,
    });
  }

  canLeave(): boolean | Promise<boolean> {
    if (!this.form.dirty || this.pending()) return true;
    if (!this.leaveDecision)
      this.leaveDecision = new Promise<boolean>((resolve) => {
        const settle = (leave: boolean) => {
          this.leaveDecision = undefined;
          resolve(leave);
        };
        this.confirmation.confirm({
          header: this.text().unsavedTitle,
          message: this.text().unsavedDescription,
          rejectButtonProps: {
            label: this.text().keepEditing,
            severity: 'secondary',
            outlined: true,
          },
          acceptButtonProps: { label: this.text().discardChanges, severity: 'danger' },
          accept: () => {
            settle(true);
          },
          reject: () => {
            settle(false);
          },
        });
      });
    return this.leaveDecision;
  }

  beforeUnload(event: BeforeUnloadEvent): void {
    if (this.form.dirty && !this.pending()) event.preventDefault();
  }
}
