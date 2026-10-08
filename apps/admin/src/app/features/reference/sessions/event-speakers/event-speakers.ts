import { Component, DestroyRef, computed, inject, input, signal, type OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonDirective } from 'primeng/button';
import { Message } from 'primeng/message';
import { SessionsApi } from '../sessions-api';
import { messages, type Language } from '../../../../i18n/messages';
import { requestError } from '../../../../core/graphql/request-error';
import type { AdminSessionDetailsFragment } from '../../../../../generated/graphql/operations';
@Component({
  selector: 'holita-event-speakers',
  imports: [ButtonDirective, Message],
  templateUrl: './event-speakers.html',
  styleUrl: './event-speakers.scss',
})
export class EventSpeakers implements OnInit {
  readonly language = input.required<Language>();
  readonly text = computed(() => messages[this.language()]);
  readonly sessions = signal<AdminSessionDetailsFragment[]>([]);
  readonly loading = signal(true);
  readonly error = signal<unknown>(null);
  readonly failure = computed(() => requestError(this.error(), this.text().networkError));
  readonly speakers = computed(() =>
    [
      ...new Map(
        this.sessions()
          .flatMap((row) => row.speakers)
          .map((speaker) => [speaker.id, speaker]),
      ).values(),
    ].sort((a, b) => a.name.localeCompare(b.name, this.language())),
  );
  private readonly api = inject(SessionsApi);
  private readonly destroyRef = inject(DestroyRef);
  private query: ReturnType<SessionsApi['watchList']> | undefined;
  ngOnInit(): void {
    this.query = this.api.watchList();
    this.query.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.loading.set(result.loading);
        this.error.set(result.error ?? null);
        if (result.dataState === 'complete' && !result.error)
          this.sessions.set(result.data.referenceSessions);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.error.set(error);
      },
    });
  }
  retry(): void {
    void this.query?.refetch().catch((error: unknown) => {
      if (!this.destroyRef.destroyed) this.error.set(error);
    });
  }
}
