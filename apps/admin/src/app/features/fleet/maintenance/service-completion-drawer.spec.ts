import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormGroupDirective } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { fromDateOnly } from '../../../ui/format/zoned-time';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import { ServiceCompletionDrawer, type ServiceCompletionForm } from './service-completion-drawer';

describe('ServiceCompletionDrawer', () => {
  async function render() {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: UI_LANGUAGE, useValue: signal('en') }],
    });
    const fixture = TestBed.createComponent(ServiceCompletionDrawer);
    fixture.componentRef.setInput('task', {
      kind: 'Oil change',
      plate: 'CB 1001 AX',
      workshop: '',
      notes: 'Keep this note',
    });
    fixture.componentRef.setInput('businessDate', '2026-10-19');
    fixture.detectChanges();
    await fixture.whenStable();
    const form = fixture.debugElement
      .query(By.directive(FormGroupDirective))
      .injector.get(FormGroupDirective).form;
    const saved: ServiceCompletionForm[] = [];
    fixture.componentInstance.save.subscribe((value) => saved.push(value));
    async function submit() {
      const element = document.getElementById('completion-form');
      if (!(element instanceof HTMLFormElement)) {
        throw new Error('Missing completion form.');
      }
      element.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      fixture.detectChanges();
      await fixture.whenStable();
    }
    return { fixture, form, saved, submit };
  }

  it('defaults to the business date and keeps zero distinct from an unknown odometer or cost', async () => {
    const { form, saved, submit } = await render();
    form.get('completedOdometerKm')?.setValue(0);
    form.get('cost')?.setValue(0);
    form.get('workshop')?.setValue('  Warranty  ');
    await submit();
    expect(saved).toEqual([
      {
        completedOn: '2026-10-19',
        completedOdometerKm: 0,
        costCents: 0,
        workshop: 'Warranty',
        replacedParts: '',
        notes: 'Keep this note',
        nextDueOn: null,
        nextDueOdometerKm: null,
        nextTitle: null,
      },
    ]);
  });

  it('keeps exact cents for a decimal amount that is not exactly representable as a binary float', async () => {
    const { form, saved, submit } = await render();
    form.get('cost')?.setValue(0.29);
    await submit();
    expect(saved[0]?.costCents).toBe(29);
  });

  it('clears next planning when the vehicle becomes inactive but still records historical service', async () => {
    const { fixture, form, saved, submit } = await render();
    form.get('nextDueOn')?.setValue(fromDateOnly('2026-11-19'));
    form.get('nextDueOdometerKm')?.setValue(150000);
    form.get('nextTitle')?.setValue('Next oil change');
    fixture.componentRef.setInput('allowNext', false);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.getElementById('completion-nextDueOn')).toBeNull();
    await submit();
    expect(saved[0]).toMatchObject({ nextDueOn: null, nextDueOdometerKm: null, nextTitle: null });
  });

  it('accepts cents near the cost maximum while rejecting fractional cents', async () => {
    const { form, saved, submit } = await render();
    form.get('cost')?.setValue(999_999.191);
    await submit();
    expect(saved).toHaveLength(0);
    expect(form.get('cost')?.hasError('step')).toBe(true);
    expect(document.activeElement?.id).toBe('completion-costCents');
    form.get('cost')?.setValue(999_999.19);
    await submit();
    expect(saved[0]?.costCents).toBe(99_999_919);
    form.get('cost')?.setValue(1_000_000);
    await submit();
    expect(saved[1]?.costCents).toBe(100_000_000);
  });

  it('rejects a missing or future completion date and focuses that field', async () => {
    const { form, saved, submit } = await render();
    form.get('completedOn')?.setValue(null);
    await submit();
    expect(form.get('completedOn')?.hasError('required')).toBe(true);
    expect(document.activeElement?.id).toBe('completion-completedOn');
    form.get('completedOn')?.setValue(fromDateOnly('2026-10-20'));
    await submit();
    expect(form.get('completedOn')?.hasError('dateMax')).toBe(true);
    expect(saved).toHaveLength(0);
  });

  it('requires the next date to be later and revalidates when the completion date changes', async () => {
    const { form, saved, submit } = await render();
    form.get('nextDueOn')?.setValue(fromDateOnly('2026-10-19'));
    await submit();
    expect(form.hasError('nextDate')).toBe(true);
    expect(document.activeElement?.id).toBe('completion-nextDueOn');
    form.get('completedOn')?.setValue(fromDateOnly('2026-10-18'));
    await submit();
    expect(saved[0]?.nextDueOn).toBe('2026-10-19');
    expect(saved[0]?.nextDueOdometerKm).toBeNull();
  });

  it('rejects equal next odometer including zero, then emits the next task in the same save', async () => {
    const { form, saved, submit } = await render();
    form.get('completedOdometerKm')?.setValue(0);
    form.get('nextDueOdometerKm')?.setValue(0);
    await submit();
    expect(saved).toHaveLength(0);
    expect(document.activeElement?.id).toBe('completion-nextDueOdometerKm');
    form.get('nextDueOdometerKm')?.setValue(15000);
    form.get('nextTitle')?.setValue('  Next oil change  ');
    form.get('cost')?.setValue(123.45);
    await submit();
    expect(saved[0]).toMatchObject({
      completedOdometerKm: 0,
      nextDueOdometerKm: 15000,
      nextTitle: 'Next oil change',
      costCents: 12345,
    });
  });

  it('locks a submitted draft, prevents duplicate emits and restores it after a failure', async () => {
    const { fixture, form, saved, submit } = await render();
    form.get('workshop')?.setValue('Draft workshop');
    form.get('workshop')?.markAsDirty();
    form.get('workshop')?.markAsTouched();
    await submit();
    fixture.componentRef.setInput('saving', true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(form.disabled).toBe(true);
    expect(fixture.componentInstance.canLeave()).toBe(false);
    expect(document.querySelector<HTMLButtonElement>('.app-drawer-actions button')?.disabled).toBe(
      true,
    );
    await submit();
    expect(saved).toHaveLength(1);
    fixture.componentRef.setInput('saveError', 'Try again');
    fixture.componentRef.setInput('saving', false);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(form.enabled).toBe(true);
    expect(document.querySelector<HTMLButtonElement>('.app-drawer-actions button')?.disabled).toBe(
      false,
    );
    expect(form.get('workshop')?.value).toBe('Draft workshop');
    expect(form.get('workshop')?.dirty).toBe(true);
    expect(form.get('workshop')?.touched).toBe(true);
    expect(document.activeElement?.closest('[role="dialog"]')).not.toBeNull();
  });

  it('drops an invalid next title when the next schedule is cleared and completes only this task', async () => {
    const { form, saved, submit } = await render();
    form.get('nextDueOdometerKm')?.setValue(140000);
    form.get('nextTitle')?.setValue('x'.repeat(121));
    await submit();
    expect(saved).toHaveLength(0);
    expect(document.activeElement?.id).toBe('completion-nextTitle');
    form.get('nextDueOdometerKm')?.setValue(null);
    await submit();
    expect(form.valid).toBe(true);
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      nextDueOn: null,
      nextDueOdometerKm: null,
      nextTitle: null,
    });
  });

  it('renders and focuses an earlier-service odometer error from the host', async () => {
    const { fixture, form } = await render();
    form.get('completedOdometerKm')?.setValue(120000);
    fixture.componentRef.setInput('fieldErrors', {
      completedOdometerKm: 'The odometer cannot be below an earlier completed service.',
    });
    fixture.detectChanges();
    await fixture.whenStable();
    const input = document.getElementById('completion-completedOdometerKm');
    expect(input?.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(input);
    expect(form.get('completedOdometerKm')?.value).toBe(120000);
  });

  it('shows completed details as history with only Close and never emits another save', async () => {
    const { fixture, saved } = await render();
    fixture.componentRef.setInput('completed', {
      completedOn: '2026-10-18',
      completedOdometerKm: 120000,
      costCents: 0,
      workshop: 'Plovdiv workshop',
      replacedParts: 'Oil and filter',
      notes: 'Warranty service',
      nextDueOn: null,
      nextDueOdometerKm: null,
      nextTitle: null,
    });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.getElementById('completion-form')).toBeNull();
    const record = document.querySelector('[role="dialog"]');
    expect(record?.textContent).toContain('Completed Oil change');
    expect(record?.textContent).toContain('Plovdiv workshop');
    expect(record?.textContent).toContain('Oil and filter');
    expect(record?.textContent).toContain('120,000');
    let closed = 0;
    fixture.componentInstance.closed.subscribe(() => closed++);
    const close = Array.from(document.querySelectorAll('button')).find(
      (button) => button.textContent.trim() === 'Close',
    );
    if (!close) {
      throw new Error('Missing Close button.');
    }
    close.click();
    await fixture.whenStable();
    expect(closed).toBe(1);
    expect(saved).toHaveLength(0);
  });
});
