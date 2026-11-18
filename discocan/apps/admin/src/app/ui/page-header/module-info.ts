import { Injectable, signal } from '@angular/core';

export interface ModuleInfoContent {
  readonly title: string;
  readonly body: string;
}

/** The active module's information, shown by the breadcrumb (i) popover. */
@Injectable({ providedIn: 'root' })
export class ModuleInfo {
  private readonly current = signal<ModuleInfoContent | null>(null);
  readonly info = this.current.asReadonly();

  set(info: ModuleInfoContent | null): void {
    this.current.set(info);
  }
}
