# 159 Show shop picker loading and failures

**Status:** Ready. **Product:** Holita.

## Background

The merchant shell starts with an empty Branch list and handles complete Apollo data only. A delayed or failed Branch read makes Admin feature pages report no shop. If the last active shop is suspended, a restored selection can keep sending requests to that Branch even after the list comes back empty.

## Goal

Distinguish shop discovery, a merchant with zero shops and failure to load the list.

## Steps

1. Track the loading and error result in the Holita operator shell and provide localized retry for a failed Branch read.
2. On a successful empty result, clear the current and saved Branch selection and show the no-shop state. Keep feature reads gated on a resolved selection. Keep the existing selection and fallback behavior when accessible shops remain.

## Done when

Delayed queries show loading, a failed read offers Retry, and suspending the last selected shop followed by a successful reload clears the old Branch and shows the no-shop state without making feature reads for that Branch.

## Limits

Use existing shell components and Core Branch scope.

## References

- [Shop selection and shell](../../holita/packages/operator/src/application.ts#L178)
