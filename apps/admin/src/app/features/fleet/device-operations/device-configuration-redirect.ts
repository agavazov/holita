import { ChangeDetectionStrategy, Component, inject, type OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AdminWorkspace } from '../../../workspace/admin-workspace';
import { deviceConfigurationText } from './i18n/messages';

/** Legacy Fleet bookmarks return to Karma inventory, where the target is explicit. */
@Component({
  selector: 'holita-device-configuration-redirect',
  template: '<p role="status">{{ text.loading }}</p>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeviceConfigurationRedirect implements OnInit {
  private readonly workspace = inject(AdminWorkspace);
  private readonly router = inject(Router);
  protected readonly text = deviceConfigurationText(this.workspace.language());

  ngOnInit(): void {
    void this.router.navigate(['/', this.workspace.language(), 'karma-client', 'cars'], {
      replaceUrl: true,
    });
  }
}
