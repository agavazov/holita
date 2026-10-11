# Separate database ownership and isolated test schemas

Core and Reference own independent persistence without sharing application models.
One local PostgreSQL instance contains separate databases, login roles, Prisma schemas,
clients and SQL migrations. Vehicle/Device storeId is a UUID reference without a cross-database
foreign key. Device → Vehicle uses a same-tenant/same-store composite foreign key inside Reference.

Development and test databases use different credentials. Tests require the dedicated local
identity, reject URL options and deploy checked-in migrations into a random per-run schema.
Cleanup drops only that schema; live DB results are not cached. Abruptly killed runs can leave
schemas behind; broad automatic cleanup is absent.

Provisioning verifies ownership/privileges and preserves data/passwords. Seeds insert missing
RentalSofia, Stores and sample Vehicles/Devices without replacing user edits. Core owns Tenant; Reference carries mandatory tenantId without a cross-database foreign key. Tenant migrations preserve legacy rows and put tenantId second after id. Compose down preserves its volume. Applications and
migration/test processes run on the host, with no application containers.
