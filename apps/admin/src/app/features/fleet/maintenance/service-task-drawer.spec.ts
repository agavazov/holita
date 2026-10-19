import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormGroupDirective } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { fromDateOnly } from '../../../ui/format/zoned-time';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import { ServiceTaskDrawer, type ServiceTaskForm } from './service-task-drawer';

describe('ServiceTaskDrawer', () => {
  async function render(task: ServiceTaskForm | null = null) {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: UI_LANGUAGE, useValue: signal('en') }],
    });
    const fixture = TestBed.createComponent(ServiceTaskDrawer);
    fixture.componentRef.setInput('task', task);
    fixture.componentRef.setInput('vehicles', [
      { id: 'v1', name: 'CB 1001 AX' },
      { id: 'v2', name: 'CB 1002 AX' },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();
    const form = fixture.debugElement
      .query(By.directive(FormGroupDirective))
      .injector.get(FormGroupDirective).form;
    const saved: ServiceTaskForm[] = [];
    fixture.componentInstance.save.subscribe((value) => saved.push(value));
    async function submit() {
      const element = document.getElementById('task-form');
      if (!element) {
        throw new Error('Missing task form.');
      }
      element.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      fixture.detectChanges();
      await fixture.whenStable();
    }
    return { fixture, form, saved, submit };
  }

  it('plans an enum service with an optional title, workshop and maximum due odometer', async () => {
    const { form, saved, submit } = await render();
    form.patchValue({
      serviceType: 'OIL_CHANGE',
      vehicleId: 'v1',
      dueKm: 9999999,
      workshop: '  Plovdiv  ',
    });
    await submit();
    expect(saved).toEqual([
      {
        serviceType: 'OIL_CHANGE',
        title: null,
        vehicleId: 'v1',
        dueOn: null,
        dueKm: 9999999,
        workshop: 'Plovdiv',
        notes: '',
      },
    ]);
    expect(form.get('cost')).toBeNull();
  });

  it('keeps the vehicle immutable on edit and accepts a 120-character title', async () => {
    const { form, saved, submit } = await render({
      serviceType: 'REPAIR',
      title: 'Repair',
      vehicleId: 'v1',
      dueOn: '2026-10-19',
      dueKm: null,
      workshop: '',
      notes: '',
    });
    expect(document.getElementById('task-vehicleId')).toBeNull();
    form.patchValue({ vehicleId: 'v2', title: 'x'.repeat(120) });
    await submit();
    expect(saved[0]?.vehicleId).toBe('v1');
    expect(saved[0]?.title).toHaveLength(120);
  });

  it('rejects missing schedules and dates outside the service calendar range', async () => {
    const { form, saved, submit } = await render();
    form.get('vehicleId')?.setValue('v1');
    await submit();
    expect(form.get('dueOn')?.hasError('requireOneOf')).toBe(true);
    form.get('dueOn')?.setValue(fromDateOnly('1999-12-31'));
    await submit();
    expect(form.get('dueOn')?.hasError('dateMin')).toBe(true);
    expect(saved).toHaveLength(0);
    form.get('dueOn')?.setValue(fromDateOnly('2100-12-31'));
    await submit();
    expect(saved[0]?.dueOn).toBe('2100-12-31');
  });

  it('locks saving drafts and rejects navigation and duplicate submits until the save settles', async () => {
    const { fixture, form, saved, submit } = await render();
    form.patchValue({ vehicleId: 'v1', dueKm: 0, title: 'Draft' });
    form.get('title')?.markAsDirty();
    form.get('title')?.markAsTouched();
    await submit();
    fixture.componentRef.setInput('saving', true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(form.disabled).toBe(true);
    expect(fixture.componentInstance.canLeave()).toBe(false);
    await submit();
    expect(saved).toHaveLength(1);
    fixture.componentRef.setInput('saving', false);
    fixture.componentRef.setInput('saveError', 'Try again');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(form.enabled).toBe(true);
    expect(form.get('title')?.value).toBe('Draft');
    expect(form.get('title')?.dirty).toBe(true);
    expect(form.get('title')?.touched).toBe(true);
  });

  it('shows cancelled plans read-only and permits leaving them', async () => {
    const { fixture, saved } = await render({
      serviceType: 'REPAIR',
      title: 'Cancelled repair',
      vehicleId: 'v1',
      dueOn: null,
      dueKm: 100000,
      workshop: 'Plovdiv',
      notes: 'Parts unavailable',
    });
    fixture.componentRef.setInput('readOnly', true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.getElementById('task-form')).toBeNull();
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Parts unavailable');
    expect(fixture.componentInstance.canLeave()).toBe(true);
    expect(saved).toHaveLength(0);
  });
});
