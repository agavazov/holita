import { Component, computed, inject, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { Message } from 'primeng/message';
import { AdminConfig } from '../../core/config/admin-config';
import { StoreWorkspace } from '../stores/store-workspace';
import { VenuesPage } from './venues/venues-page';
import { VenueEditor } from './venues/venue-editor';
import { SpeakersPage } from './speakers/speakers-page';
import { SpeakerEditor } from './speakers/speaker-editor';
import { DevicesPage } from './devices/devices-page';
import { DeviceEditor } from './devices/device-editor';
import { VehiclesPage } from './vehicles/vehicles-page';
import { VehicleEditor } from './vehicles/vehicle-editor';
import { TagsPage } from './tags/tags-page';
import { TagEditor } from './tags/tag-editor';
import { EventsPage } from './events/events-page';
import { EventEditor } from './events/event-editor';
import { SessionEditor } from './sessions/session-editor/session-editor';
import { EventOverview } from './events/event-overview';

@Component({
  imports: [
    Message,
    VenuesPage,
    VenueEditor,
    SpeakersPage,
    SpeakerEditor,
    DevicesPage,
    DeviceEditor,
    VehiclesPage,
    VehicleEditor,
    TagsPage,
    TagEditor,
    EventsPage,
    EventEditor,
    EventOverview,
    SessionEditor,
  ],
  selector: 'holita-reference-workspace',
  templateUrl: './reference-workspace.html',
})
export class ReferenceWorkspace {
  readonly workspace = inject(StoreWorkspace);
  readonly enabled = inject(AdminConfig).referenceEnabled;
  private readonly venueEditor = viewChild(VenueEditor);
  private readonly speakerEditor = viewChild(SpeakerEditor);
  private readonly deviceEditor = viewChild(DeviceEditor);
  private readonly vehicleEditor = viewChild(VehicleEditor);
  private readonly tagEditor = viewChild(TagEditor);
  private readonly eventEditor = viewChild(EventEditor);
  private readonly sessionEditor = viewChild(SessionEditor);
  private readonly eventOverview = viewChild(EventOverview);
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  readonly activeWorkspaces = computed(() => {
    const language = this.workspace.language();
    const id = this.params().get('storeId')?.toLowerCase();
    const store = this.workspace.stores()?.find((store) => store.id === id);
    const editor = this.route.snapshot.data['editor'] === true;
    const resource: unknown = this.route.snapshot.data['resource'];
    const recordId = this.params().get('recordId') ?? this.params().get('venueId');
    return store &&
      this.enabled &&
      (resource === 'venues' ||
        resource === 'speakers' ||
        resource === 'tags' ||
        resource === 'vehicles' ||
        resource === 'devices' ||
        resource === 'events')
      ? [
          {
            store,
            language,
            editor,
            overview: this.route.snapshot.data['overview'] === true,
            sessionEditor: this.route.snapshot.data['sessionEditor'] === true,
            sessionId: this.params().get('sessionId'),
            resource,
            recordId,
          },
        ]
      : [];
  });

  canLeave(): boolean | Promise<boolean> {
    return (
      (
        this.venueEditor() ??
        this.speakerEditor() ??
        this.tagEditor() ??
        this.vehicleEditor() ??
        this.deviceEditor() ??
        this.eventEditor() ??
        this.sessionEditor() ??
        this.eventOverview()
      )?.canLeave() ?? true
    );
  }
}
