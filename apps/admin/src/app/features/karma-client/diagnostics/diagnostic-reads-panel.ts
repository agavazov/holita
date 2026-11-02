import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  signal,
  type OnInit,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonDirective } from 'primeng/button';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import { EMPTY, Subject, catchError, startWith, switchMap } from 'rxjs';
import type {
  AdminBranchesQuery,
  AdminDiagnosticReadsQuery,
  AdminKarmaCarQuery,
  AdminRequestDiagnosticReadMutationVariables,
} from '../../../../generated/graphql/operations';
import type { Language } from '../../../i18n/messages';
import { DiagnosticReadsApi } from './diagnostic-reads-api';
import bg from './bg.json';
import en from './en.json';

type DiagnosticOperation = AdminDiagnosticReadsQuery['fleetDeviceDiagnosticOperations'][number];
type ReadKind = AdminRequestDiagnosticReadMutationVariables['input']['kind'];

@Component({
  selector: 'holita-diagnostic-reads-panel',
  imports: [ButtonDirective, Message, Tag],
  providers: [DiagnosticReadsApi],
  templateUrl: './diagnostic-reads-panel.html',
  styleUrl: './karma-diagnostics-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-card app-stack' },
})
export class DiagnosticReadsPanel implements OnInit {
  readonly branch = input.required<AdminBranchesQuery['branches'][number]>();
  readonly car = input.required<NonNullable<AdminKarmaCarQuery['karmaCar']>>();
  readonly language = input.required<Language>();
  private readonly api = inject(DiagnosticReadsApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reload = new Subject<void>();
  private pollTimer: ReturnType<typeof setTimeout> | undefined;
  protected readonly text = computed(() => (this.language() === 'bg' ? bg : en));
  protected readonly operations = signal<readonly DiagnosticOperation[]>([]);
  protected readonly latestOperation = computed(() => this.operations()[0] ?? null);
  protected readonly loading = signal(true);
  protected readonly loaded = signal(false);
  protected readonly error = signal(false);
  protected readonly enabled = signal(false);
  protected readonly requesting = signal(false);
  protected readonly uncertain = signal(false);
  protected readonly pending = computed(() =>
    this.operations().some((operation) =>
      ['QUEUED', 'SUBMITTING', 'WAITING', 'UNKNOWN'].includes(operation.status),
    ),
  );
  protected readonly canRequest = computed(
    () =>
      this.loaded() &&
      this.enabled() &&
      !this.loading() &&
      !this.error() &&
      !this.requesting() &&
      !this.uncertain() &&
      !this.pending(),
  );

  ngOnInit(): void {
    this.api.initialize(this.branch().id, this.language());
    this.destroyRef.onDestroy(() => {
      this.clearPoll();
    });
    this.reload
      .pipe(
        startWith(undefined),
        switchMap(() => {
          this.clearPoll();
          this.loading.set(true);
          this.error.set(false);
          return this.api
            .watch({ karmaCarId: this.car().id, expectedKarmaDeviceId: this.car().deviceId })
            .valueChanges.pipe(
              catchError(() => {
                this.error.set(true);
                this.loading.set(false);
                return EMPTY;
              }),
            );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        this.loading.set(result.loading);
        this.error.set(!!result.error);
        if (!result.error && !result.loading && result.dataState === 'complete') {
          this.operations.set(result.data.fleetDeviceDiagnosticOperations);
          this.enabled.set(result.data.fleetDeviceOperationsEnabled);
          this.loaded.set(true);
          if (
            this.operations().some((operation) =>
              ['QUEUED', 'SUBMITTING', 'WAITING'].includes(operation.status),
            )
          ) {
            this.pollTimer = setTimeout(() => {
              this.refresh();
            }, 5000);
          }
        }
      });
  }

  refresh(): void {
    this.reload.next();
  }

  async request(kind: ReadKind): Promise<void> {
    if (!this.canRequest()) {
      return;
    }
    this.requesting.set(true);
    try {
      const operation = await this.api.request({
        karmaCarId: this.car().id,
        expectedKarmaDeviceId: this.car().deviceId,
        kind,
      });
      if (!this.destroyRef.destroyed) {
        this.operations.update((operations) => [
          operation,
          ...operations.filter((existing) => existing.id !== operation.id),
        ]);
        this.refresh();
      }
    } catch {
      if (!this.destroyRef.destroyed) {
        this.uncertain.set(true);
        this.refresh();
      }
    } finally {
      if (!this.destroyRef.destroyed) {
        this.requesting.set(false);
      }
    }
  }

  kind(operation: DiagnosticOperation): string {
    return operation.kind === 'READ_FAULT_LOGGER' ||
      operation.kind === 'READ_COMMUNICATION_DIAGNOSTICS'
      ? this.text().kinds[operation.kind]
      : operation.kind;
  }

  hasNack(operation: DiagnosticOperation): boolean {
    return operation.diagnosticObservations.some((row) => row.acknowledgement === 'NACK');
  }

  hasPositiveAck(operation: DiagnosticOperation): boolean {
    return operation.diagnosticObservations.some((row) => row.acknowledgement === 'POSITIVE_ACK');
  }

  operationSeverity(operation: DiagnosticOperation): 'info' | 'warn' | 'secondary' {
    switch (operation.status) {
      case 'COMPLETE':
        return 'info';
      case 'FAILED':
      case 'TIMED_OUT':
      case 'UNKNOWN':
        return 'warn';
      default:
        return 'secondary';
    }
  }

  operationHint(operation: DiagnosticOperation): string | null {
    switch (operation.status) {
      case 'COMPLETE':
        return operation.kind === 'READ_COMMUNICATION_DIAGNOSTICS'
          ? this.text().communicationReportHint
          : this.text().reportHint;
      case 'FAILED':
        return this.text().readFailedHint;
      case 'TIMED_OUT':
        return this.text().noReportHint;
      case 'UNKNOWN':
        return this.text().unknownHint;
      default:
        return null;
    }
  }

  private clearPoll(): void {
    clearTimeout(this.pollTimer);
    this.pollTimer = undefined;
  }
}
