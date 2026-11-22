# 248 Manage private demo attachments

**Status:** Ready after [247](247-holita-backoffice-demo-register.md). **Product:** Holita.

## Background

red.bg Backoffice demos support attached files and ordering. The demo register has no public audience.

## Goal

Let authorized staff add, order and remove local attachments on a demo record.

## Steps

1. Reuse established validation and storage for supported image attachments, with platform-staff verification on reads and writes.
2. Add an attachment section with preview, reorder, delete and failure feedback.

## Done when

An authorized staff user can attach and reorder files on the chosen demo, and unauthenticated requests cannot read them.

## Limits

Demo attachments only. No external media provider.

## References

- [red.bg Backoffice uploader routes](../../../red.bg/workspace-ecommerce/services/backoffice/routes/web.php)
- [red.bg demos controller](../../../red.bg/workspace-ecommerce/services/backoffice/app/Http/Controllers/Backoffice/System/DemosController.php)
