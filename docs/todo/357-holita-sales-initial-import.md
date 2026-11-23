# 357 Import red.bg prospects and contacts into Holita Sales

**Status:** Ready after 133. **Product:** Holita.

## Background

The owner requested the real records for a local review on personal.lab on 2026-11-23, followed by a final reconciliation with a current Sales export. The source promoted on 2026-08-21 is the red.bg Sales `sales-stage-ready-final.dump`, under the snapshot's `phase3/20260821T075453Z/` directory. The verified source has 23 leads and 24 contacts. Companies, company attributes, an offer and booking configuration are available separately for later features. Keep real data outside Git and the demo seed.

## Goal

Let an authenticated platform Sales operator browse the imported leads and their contacts in Holita. Repeating an import must preserve operator edits and keep the same record identities.

## Steps

1. Read the private, local `holita_sales_import.red_bg_20260821` staging schema, or a later explicitly supplied snapshot. Use only the approved lead and contact columns. A local operator invokes the tool against an explicitly verified Holita Sales development database and platform tenant. Require a verified SALES identity and preserve tenant scoping. Keep credentials in supported environment inputs or private files. Keep the raw staging database inaccessible to the application.
2. Retain a repeatable mapping from source IDs to tenant-scoped Holita IDs. Preserve source names, sites, contacts, notes and timestamps where the deployed schema supports them. Resolve the parent before inserting a contact. Report unsupported fields and records by counts and reason. Retain source provenance. If a legacy identity has no verified Core match, identify the import actor as such and leave assignment pending. Do not assign all records to an invented agent.
3. Provide a dry run and an explicit additive import for the initial preview. Handle a later export by reporting new, changed, conflicting or unmatched records before approved changes. Keep source data private and keep it out of browser smoke fixtures, screenshots, logs and version control.
4. Run the authorized initial import and repeat it against the same snapshot. Reconcile source, inserted, already-present and rejected counts and verify all contact-to-lead links. Open the authenticated Leads and Contacts screens against the real local target. Record only aggregate counts and outcome in the private factory status. Use fictional records for screenshots required by the UI skill.

## Done when

The platform Sales account can find imported leads and contacts through the existing operator Router and Sales UI. The report accounts for all 23 source leads and 24 source contacts. A second run adds zero duplicates and preserves edits. The final reconciliation can use a newer export without resetting data.

## Limits

This ticket covers leads and contacts. Companies, offers, booking rules and later CRM fields stay available in the local staging database. Do not transfer old accounts, passwords, browser sessions, telephony, recordings, crawler or external integration state. Do not contact or write to an old production host. Do not push.

## References

- [Sales migration queue](holita-migration.md)
- [Holita Sales](../../holita/apps/sales/src/main.ts)
- [red.bg Sales inventory](../../holita/docs/red-bg/services/sales.md)
