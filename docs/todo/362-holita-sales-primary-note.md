# 362 Preserve primary contact selection when editing a note

**Status:** Ready. **Product:** Holita.

## Background

Independent review HLR-04 identified this behavior at `1b44cc90`. A contact editor opened before another operator changed the primary contact resubmits the old primary flag on an unrelated note edit.

## Goal

Preserve primary contact selection when editing a note.

## Steps

Distinguish an explicit primary change from editing other contact fields, or detect a stale primary selection before writing.

## Done when

After B becomes primary, editing only the notes on A preserves B as primary or reports the conflict before saving.

## Limits

Sales contact editor and its update semantics.

## References

- [contact-editor.ts](../../holita/apps/sales/src/contacts/contact-editor.ts#L163)
- [contact-editor.ts](../../holita/apps/sales/src/contacts/contact-editor.ts#L240)
- [contacts.repository.ts](../../holita/apps/sales-api/src/contacts/contacts.repository.ts#L82)
