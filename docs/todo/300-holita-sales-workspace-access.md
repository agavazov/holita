# 300 Connect Sales workspace access and guarded smoke

**Status:** Ready after [131](131-holita-sales-sales-service.md). **Product:** Holita.

## Background

Ticket 131 provides the Sales subgraph and a protected workspace query backed by Core Sales
identity. The existing Angular Sales shell uses the shared operator sign-in and opens Merchants.

## Goal

Connect the protected query to the Sales shell and exercise the operator transport in the
existing isolated Holita browser smoke.

## Steps

1. Register Sales application TypedDocumentNodes in the operator generation path. Run the workspace
   access query after sign-in and show a BG/EN access state. Keep the Merchants landing route and
   its existing Core permissions.
2. Extend the guarded Holita smoke inputs and helper to start the Sales API on an ephemeral port
   with a disposable schema in the dedicated Sales test database. Serve the Sales Angular build
   through the existing same-origin proxy, point the operator Router at the isolated subgraph
   and pass the Sales origin into the current smoke case.
3. Extend that existing case for the cross-service contract. Sign in as the seeded Core SALES
   account, verify the protected query and shell, and exercise the query without a session and
   with non-Sales platform and merchant sessions. Use the existing teardown for the service,
   application and schema.

## Done when

The Sales shell loads and its protected query returns the signed-in Sales identity through the
operator Router. The other identities receive access denial. The isolated smoke cleans up the
resources it starts.

## Limits

Workspace access only. Reuse the existing smoke case and demo account. CRM screens follow in
feature tickets.

## References

- [red.bg Sales operator routes](../../../red.bg/workspace-sales/services/sales/routes/web.php)
- [Holita Sales route registration](../../holita/apps/sales/src/main.ts#L9)
- [Holita generated operation paths](../../holita/tools/graphql/contracts.mts#L15)
- [Holita existing browser smoke](../../holita/tools/browser/holita.smoke.spec.mts#L1)
