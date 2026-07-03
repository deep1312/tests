# API Migrations

This directory contains SQL migration scripts for the `api` schema — the tables owned and managed by the FastAPI service.

## Migration Order

Migrations must be applied in numeric order. Each file is idempotent where possible (uses `IF NOT EXISTS` / `ON CONFLICT DO NOTHING`).

| File | Description |
|------|-------------|
| `001_create_api_schema.sql` | Creates the `api` PostgreSQL schema |
| `002_create_users_table.sql` | Creates `api.users` (authentication accounts) |
| `003_create_audit_log_table.sql` | Creates `api.audit_log` (append-only audit trail) + indexes |
| `004_seed_admin_user.sql` | Inserts a default `admin` user for development bootstrap |

## How to Apply

### Using psql

Run each migration in order against your target database:

```bash
psql "$DATABASE_URL" -f api/migrations/001_create_api_schema.sql
psql "$DATABASE_URL" -f api/migrations/002_create_users_table.sql
psql "$DATABASE_URL" -f api/migrations/003_create_audit_log_table.sql
psql "$DATABASE_URL" -f api/migrations/004_seed_admin_user.sql
```

Or apply all at once in a single session (preserves transaction context):

```bash
psql "$DATABASE_URL" \
  -f api/migrations/001_create_api_schema.sql \
  -f api/migrations/002_create_users_table.sql \
  -f api/migrations/003_create_audit_log_table.sql \
  -f api/migrations/004_seed_admin_user.sql
```

### Using a migration tool

If the project adopts a migration tool (e.g. [Flyway](https://flywaydb.org/), [Alembic](https://alembic.sqlalchemy.org/), [golang-migrate](https://github.com/golang-migrate/migrate)), place these files in the tool's migration directory and follow its conventions. The numeric prefix (`001_`, `002_`, …) is compatible with most tools' default ordering strategies.

## Notes

### Schema ownership
The `api` schema is exclusively owned by the API service. The `pg_health_collector` service does not read from or write to this schema.

### Audit log immutability
The API database user must **not** be granted `UPDATE` or `DELETE` privileges on `api.audit_log`. Entries are append-only by design. Enforce this at the database level:

```sql
-- Grant only INSERT and SELECT to the API application user
GRANT INSERT, SELECT ON api.audit_log TO <api_db_user>;
-- Do NOT grant UPDATE or DELETE
```

### Development seed (migration 004)
Migration `004_seed_admin_user.sql` inserts a default `admin` account with a placeholder bcrypt-hashed password. This is **for development bootstrap only**.

> **⚠️ Change the admin password before using the system in any non-development environment.**

To update the password after first login, use the API's user management endpoint or update the hash directly:

```sql
UPDATE api.users
SET password_hash = '<new-bcrypt-hash>',
    updated_at    = now()
WHERE username = 'admin';
```

To generate a new bcrypt hash (Python):

```python
import bcrypt
bcrypt.hashpw(b"your-new-password", bcrypt.gensalt(rounds=12)).decode()
```

### Adding new migrations
- Name new files with the next sequential prefix: `005_`, `006_`, etc.
- Keep each migration focused on a single logical change.
- Test migrations against a clean database before committing.
