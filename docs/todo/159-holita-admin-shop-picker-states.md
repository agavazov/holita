# 159 Show shop picker loading and failures

**Status:** Ready. **Product:** Holita.

## Background

The merchant shell starts with an empty Branch list and handles complete Apollo data only. A delayed or failed Branch read makes Admin feature pages report no shop.

## Goal

Distinguish shop discovery, a merchant with zero shops and failure to load the list.

## Steps

1. Track the loading and error result in the Holita operator shell and provide localized retry for a failed Branch read.
2. Show the no-shop state only after a successful empty result. Keep feature reads gated on a resolved selection.

## Done when

Delayed queries show loading, a failed read offers Retry, and a real zero-shop merchant gets the empty state.

## Limits

Use existing shell components and Core Branch scope.

## References

- [Shop selection and shell](../../holita/packages/operator/src/application.ts)
