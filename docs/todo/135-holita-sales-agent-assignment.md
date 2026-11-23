# 135 Assign leads to Core sales agents

**Status:** Ready. **Product:** Holita.

## Background

red.bg stores a creating user and a separate responsible sales user. Holita already seeds
platform accounts with the Core SALES role. Core deliberately disallows generic `users` listing
for platform sales accounts.

## Goal

Let agents assign, reassign and unassign leads using eligible Core accounts.

## Steps

1. Add nullable `assignedAgentUserId` to Lead. Default new manual leads to the creating agent
   and preserve the original creator on reassignment. Keep Core UUIDs as references.
2. Add a narrow Core internal Sales assignee lookup by search or ID. Reuse internal transport
   authentication and verify the caller's actual platform Sales session. Derive platform tenant
   from that session; allow new assignment only to active SALES accounts in that tenant.
   Return user ID and display name. Search returns eligible accounts; lookup by ID also
   resolves existing inactive assignments and historical author names within the same tenant.
   Validate selection server-side at write time. Preserve existing assignments for inactive
   agents until changed and show their name with an inactive state.
3. Add a searchable assignee picker on Lead Detail and a column in Leads. Expose
   URL-backed Mine, All, Unassigned and specific-agent filters, combinable with stage.
   Keep Core's account administration and general user directory permissions intact.
4. Add a second fictional platform SALES account to the insert-only Core seed. Document
   `HOLITA_SALES_SECOND_EMAIL` and `HOLITA_SALES_SECOND_PASSWORD` in the root `.env.example`
   with a safe example for the email and a sensitive annotation for the password. Have the
   fresh Holita runtime initializer set a distinct local demo email and generate a fresh
   password in ignored `holita/config/seed-accounts.env`. Because the initializer refuses
   to overwrite existing config, document adding the two missing keys in that file with
   a private editor, a distinct demo email and a locally generated password, without
   replacing or printing any existing values. Keep an already configured key if present.
   Run the existing Holita seed after adding the keys. Insert self-assigned, other-agent
   and unassigned demo prospects with stable IDs.

## Done when

A Sales agent can change responsibility without changing the creator, and the list filters
follow that change. Inactive, merchant and out-of-tenant accounts cannot receive new assignments.
Core continues to own identity, names and activation. A fresh setup generates both agents,
and an existing checkout can add the second agent without rotating any credentials.

## Limits

No separate Sales user table, account editor or assignment notifications. A lead's assignment
drives work queues within the verified team scope.

## References

- [Core user permissions](../../osnova/apps/core/src/modules/users/users.service.ts)
- [Holita Core demo accounts](../../holita/config/core-seed.json)
- [Holita runtime initializer](../../holita/tools/runtime-config.mts)
- [Environment reference](../../.env.example)
- [red.bg responsible user and assignee validation](../../../red.bg/workspace-sales/services/sales/app/Services/Crm/SalesCrmService.php)
- [red.bg lead agent editor](../../../red.bg/workspace-sales/services/sales/resources/views/sales/crm/leads/partials/form.blade.php)
- [Holita existing Sales app entry](../../holita/apps/sales/src/main.ts#L9)
