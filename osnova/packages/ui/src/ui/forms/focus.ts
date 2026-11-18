/**
 * Focuses the first invalid field of a form in visual order. `order` lists control names; each
 * field's focusable element has the ID `<prefix><name>` (FormField's `controlId`) and sets
 * `aria-invalid`. Call it after change detection rendered the errors.
 */
export function focusFirstInvalid(
  form: HTMLElement,
  order: readonly string[],
  prefix: string,
): boolean {
  for (const name of order) {
    const element = form.ownerDocument.getElementById(`${prefix}${name}`);
    if (element && form.contains(element) && element.getAttribute('aria-invalid') === 'true') {
      element.focus();
      return true;
    }
  }
  return false;
}
