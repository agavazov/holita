import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import { AlertDrawer } from './alert-drawer';
import type { AlertRow } from './alerts-view';

const alert: AlertRow = {
  id: '60000000-0000-4000-8000-000000000001',
  vehicleId: '20000000-0000-4000-8000-000000000001',
  plate: 'CB 1001 AX',
  driverId: null,
  driverName: null,
  kind: 'Low fuel',
  detail: 'Fuel at 8%.',
  severity: 'WARNING',
  status: 'OPEN',
  occurredAt: '2026-10-18T06:00:00.000Z',
  remark: 'Existing remark.',
};

function remark(): HTMLTextAreaElement {
  const input = document.querySelector<HTMLTextAreaElement>('#alert-remark');
  if (!input) {
    throw new Error('Missing alert remark.');
  }
  return input;
}

function type(value: string): void {
  const input = remark();
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('Alert remark refresh lifecycle', () => {
  let fixture: ComponentFixture<AlertDrawer>;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: UI_LANGUAGE, useValue: signal('en') }],
    });
    fixture = TestBed.createComponent(AlertDrawer);
    fixture.componentRef.setInput('alert', alert);
    fixture.componentRef.setInput('dataAsOf', '2026-10-18T07:00:00.000Z');
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.destroy();
    document.querySelectorAll('.p-drawer, .p-overlay-mask').forEach((element) => {
      element.remove();
    });
  });

  it('preserves a dirty same-record remark and submits it only after a user action', async () => {
    const action = vi.fn();
    fixture.componentInstance.action.subscribe(action);
    type('Unsaved investigation.');
    fixture.componentRef.setInput('alert', {
      ...alert,
      status: 'ACKNOWLEDGED',
      remark: 'Remote saved remark.',
    });
    await fixture.whenStable();
    expect(remark().value).toBe('Unsaved investigation.');
    expect(action).not.toHaveBeenCalled();
    const resolve = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.textContent.trim() === 'Resolve',
    );
    if (!resolve) {
      throw new Error('Missing resolve action.');
    }
    resolve.click();
    expect(action).toHaveBeenCalledExactlyOnceWith({
      action: 'resolve',
      remark: 'Unsaved investigation.',
    });
  });

  it('adopts a refreshed server remark when the control is pristine', async () => {
    fixture.componentRef.setInput('alert', {
      ...alert,
      status: 'ACKNOWLEDGED',
      remark: 'Remote saved remark.',
    });
    await fixture.whenStable();
    expect(remark().value).toBe('Remote saved remark.');
    expect(fixture.componentInstance.canLeave()).toBe(true);
  });

  it('resets a dirty remark when the record identity changes', async () => {
    type('Only for the first alert.');
    fixture.componentRef.setInput('alert', {
      ...alert,
      id: '60000000-0000-4000-8000-000000000002',
      remark: 'Another alert remark.',
    });
    await fixture.whenStable();
    expect(remark().value).toBe('Another alert remark.');
    expect(fixture.componentInstance.canLeave()).toBe(true);
  });
});
