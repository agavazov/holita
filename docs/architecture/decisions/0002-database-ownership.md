# Separate database ownership and isolated test schemas

Core and products require independent persistence without sharing application models or
coupling every product operation to core. One PostgreSQL instance keeps local setup small;
separate databases, login roles, Prisma schemas, clients and migrations enforce ownership.
Product.storeId is a UUID reference without a cross-database foreign key. Fixture seeds
share only documented stable IDs, not source imports or database access.

Development and test databases use different credentials. Tests require the exact local
test database and role, reject URL options, and deploy the checked-in migrations into a
random schema for each test run. A run drops only its own schema. This supports overlapping
runs without reset, truncation or deletion of development data. Live DB targets are never
cached. Abruptly killed runs can leave a test schema behind; automatic broad cleanup is
deliberately absent.

Provisioning is explicit and repeatable, checks existing ownership/privileges, and leaves
data and passwords intact. Migrate deploy applies reviewed SQL; seeds skip existing
primary/unique keys. Compose down preserves the volume. This is a local workflow, with no
application containers or production infrastructure.
