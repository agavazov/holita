import { Injectable, signal } from '@angular/core';

export interface ModuleInfoContent {
  readonly title: string;
  readonly body: string;
}

/** The active module's information, shared by its page menu and the breadcrumb. */
@Injectable({ providedIn: 'root' })
export class ModuleInfo {
  private readonly current = signal<ModuleInfoContent | null>(null);
  readonly info = this.current.asReadonly();
  readonly visible = signal(false);

  set(info: ModuleInfoContent | null): void {
    this.visible.set(false);
    this.current.set(info);
  }

  open(): void {
    if (this.info()) {
      this.visible.set(true);
    }
  }
}
