# 176 Inspect catalogue imports and retry failed work

**Status:** Ready after [175](175-holita-catalogue-file-import.md). **Product:** Holita.

## Background

red.bg Admin has import history, row outcomes and retry. Ticket 175 provides durable local import results to display and retry.

## Goal

Let merchants inspect local imports and retry eligible failed work safely.

## Steps

1. Read the scoped jobs and stored row results from 175 in an Admin list and detail. Show state, counts and validation feedback.
2. Add a retry action for eligible failed work using the existing saved input. Preserve successful row results and writes.

## Done when

A merchant can inspect a failed import and retry eligible failures. Previously successful rows are not written again.

## Limits

Use 175's fixed local CSV format and durable results. No upload wizard or connector.

## References

- [red.bg Admin import routes](../../../red.bg/workspace-ecommerce/services/admin/routes/admin.php#L299)
- [red.bg import controller](../../../red.bg/workspace-ecommerce/services/admin/app/Http/Controllers/Admin/Imports/ImportsController.php)
- [red.bg stored CSV job entry](../../../red.bg/workspace-ecommerce/services/api/app/Http/Controllers/Api/Admin/Imports/MappedImportsController.php#L23)
- [Holita operator query entry](../../holita/apps/commerce/src/commerce.graphql#L894)
