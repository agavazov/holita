import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';
import { lockWhileSaving } from './saving';
import { textValidator } from './validators';

@Component({ template: '' })
class Host {
  readonly saving = signal(false);
  readonly form = new FormGroup({
    text: new FormControl('', {
      nonNullable: true,
      validators: textValidator(10, { required: true }),
    }),
  });
  settled = 0;

  constructor() {
    lockWhileSaving(
      this.form,
      () => this.saving(),
      () => this.settled++,
    );
  }
}

describe('lockWhileSaving', () => {
  it('does nothing on the first render', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    expect(fixture.componentInstance.form.enabled).toBe(true);
    expect(fixture.componentInstance.settled).toBe(0);
  });

  it('keeps a failed draft, dirty and touched state, then restores validation', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const host = fixture.componentInstance;
    host.form.controls.text.setValue('Draft');
    host.form.markAsDirty();
    host.form.markAllAsTouched();
    host.saving.set(true);
    await fixture.whenStable();
    expect(host.form.disabled).toBe(true);
    expect(host.form.invalid).toBe(false);
    expect(host.form.getRawValue()).toEqual({ text: 'Draft' });
    expect(host.form.dirty).toBe(true);
    expect(host.form.touched).toBe(true);
    host.saving.set(false);
    await fixture.whenStable();
    expect(host.form.enabled).toBe(true);
    expect(host.form.getRawValue()).toEqual({ text: 'Draft' });
    expect(host.form.dirty).toBe(true);
    expect(host.form.touched).toBe(true);
    expect(host.settled).toBe(1);
    host.form.controls.text.setValue('');
    expect(host.form.controls.text.errors).toEqual({ required: true });
  });

  it('retires the effect when the editor is removed during saving', async () => {
    const fixture = TestBed.createComponent(Host);
    const host = fixture.componentInstance;
    host.saving.set(true);
    await fixture.whenStable();
    fixture.destroy();
    host.saving.set(false);
    TestBed.tick();
    expect(host.settled).toBe(0);
  });
});
