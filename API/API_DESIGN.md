# PG Health Monitoring API — High-Level Design

## Purpose

The PG Health Monitoring API is a FastAPI-based REST backend that provides centralized management and observability for PostgreSQL server health. It acts as the control plane between the collector agent and the frontend UI, managing server configuration, check definitions, alert thresholds, incident tracking, and audit logging.

---

## System Context

```
┌──────────────┐     HTTP/JSON      ┌──────────────────┐
│   Frontend   │ ──────────────────►│                  │
│   (React)    │◄──────────────────│   FastAPI App     │
└──────────────┘     JWT Auth       │   (this API)     │
                                    │                  │
┌──────────────┐                    │  ┌────────────┐  │
│   Collector  │─────reads config──►│  │ config.*   │  │
│   (Agent)    │◄───writes results──│  │ monitoring.*│  │
└──────────────┘                    │  │ alerts.*   │  │
                                    │  └─────┬──────┘  │
                                    └────────┼─────────┘
                                             │
                                    ┌────────▼─────────┐
                                    │  PostgreSQL       │
                                    │  Metadata DB      │
                                    └──────────────────┘
```

---

## Architecture Overview

### Layered Architecture

```
┌───────────────────────────────────────────────────┐
│                   Routers                          │
│  auth  servers  checks  thresholds  monitoring     │
│  alerts  incidents  dashboard  admin  audit        │
├───────────────────────────────────────────────────┤
│                 Middleware Stack                    │
│  CORS → RequestID → Auth (JWT) → Rate Limit        │
├───────────────────────────────────────────────────┤
│                  Services                          │
│  auth  server  check  threshold  monitoring        │
│  alert  incident  dashboard  audit  credential      │
├───────────────────────────────────────────────────┤
│                Repositories                        │
│  server  check  threshold  monitoring  alert       │
│  incident  dashboard  audit  user                   │
├───────────────────────────────────────────────────┤
│                 DB Layer                           │
│  asyncpg Pool  │  Migrations  │  Schema            │
└───────────────────────────────────────────────────┘
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **FastAPI + asyncpg** | Async-native request handling maximizes throughput for database-backed endpoints |
| **Repository Pattern** | Data access isolated in repositories; services orchestrate business logic |
| **Pydantic Models** | Request/response validation at the boundary; no raw dicts in handlers |
| **JWT Bearer Auth** | Stateless auth with HS256; no session storage needed |
| **Response Envelope** | All responses follow `{data, meta}` / `{error}` contract |
| **Dependency Injection** | `get_db()` yields per-request connections from shared pool |
| **RBAC** | `require_role("admin")` enforces minimum role via FastAPI Depends |

---

## Middleware Pipeline

Middleware is registered in order (outermost → innermost):

1. **CORS** — `add_cors_middleware(app)` allows configurable origins
2. **RequestIDMiddleware** — Attaches `X-Request-ID` header (UUID) to every request/response for tracing
3. **AuthMiddleware** — Extracts JWT from `Authorization: Bearer <token>`, decodes it, and sets `request.state.user_context`; allows optional/unauthenticated access to `/auth/*` and `/`
4. **RateLimitMiddleware** — Token-bucket algorithm per `(user_id, route)`; configured via `RATE_LIMIT_RPM`

---

## Router / Endpoint Design

### Namespace Convention

All endpoints are prefixed with `/api/v1/`. Each resource domain gets its own router module.

| Router | Base Path | Auth | Key Endpoints |
|--------|-----------|------|---------------|
| `auth` | `/auth` | None | `POST /login`, `POST /refresh` |
| `servers` | `/servers` | Required | CRUD + `PATCH /{id}/deactivate` |
| `checks` | `/checks` | Required | CRUD + `GET /health` |
| `checks` (mappings) | `/mappings` | Required | CRUD |
| `thresholds` | `/thresholds` | Required | CRUD |
| `monitoring` | `/monitoring` | Required | `GET /runs`, `GET /logs`, `GET /metrics`, `GET /metrics/aggregate` |
| `alerts` | `/alerts` | Required | `GET /`, `POST /{id}/acknowledge` |
| `incidents` | `/incidents` | Required | `GET /{id}`, `PATCH /{id}` |
| `dashboard` | `/dashboard` | Required | `GET /summary`, `GET /servers/{id}/health`, `GET /metrics/chart` |
| `audit` | `/audit-logs` | Admin | `GET /` |
| `admin` | `/admin` | Admin | `POST /credentials/rotate` |
| `schema_tables` | `/schema-tables` | Required | `GET /` |

### Response Envelope Contract

**Success:**
```json
{
  "data": { ... },
  "meta": {
    "pagination": { "total": 150, "limit": 50, "offset": 0, "has_more": true },
    "filters": { "env_type": "prod" }
  }
}
```

**Error:**
```json
{
  "error": {
    "code": "version_conflict",
    "message": "Resource was modified by another user",
    "fields": null
  }
}
```

---

## Service Layer

Services encapsulate business logic and coordinate across repositories.

| Service | Responsibility |
|---------|---------------|
| `AuthService` | Login validation, token creation, refresh |
| `ServerService` | Server CRUD, connection validation, credential encryption/decryption |
| `CheckService` | Check CRUD, mapping management, health summary |
| `ThresholdService` | Threshold CRUD by check/server |
| `MonitoringService` | Check run history, monitoring logs, metrics query + aggregation |
| `AlertService` | Alert listing, acknowledgment, unacknowledged count |
| `IncidentService` | Incident listing, detail with alerts, root cause update |
| `DashboardService` | Dashboard summary aggregation, per-server health, metrics chart data |
| `AuditService` | Audit log query with filters |
| `CredentialService` | Bulk credential re-encryption during key rotation |

---

## Security & Auth

### Authentication Flow

```
Client                      API
  │                         │
  ├──POST /auth/login──────►│  Validate password (bcrypt)
  │                         │  Create JWT (HS256, exp claim)
  │◄──{ token, role }──────┤
  │                         │
  ├──GET /servers──────────►│  AuthMiddleware extracts token
  │  Authorization: Bearer  │  Decode → set request.state.user_context
  │                         │  Router handler uses require_role()
  │◄──{ data: [...] }──────┤
```

### Credential Encryption

Server passwords are encrypted at rest using AES-256-GCM:
- Key sourced from `CREDENTIAL_ENCRYPTION_KEY` env var (base64-encoded 32 bytes)
- `CredentialEncryptor` initialized at app startup; validated before serving requests
- Admin endpoint `POST /admin/credentials/rotate` re-encrypts all stored credentials with a new key

---

## Database Interaction

- **asyncpg Pool** — Single shared pool created at startup, connections acquired per-request via `get_db()` dependency
- **Command Timeout** — `DB_STATEMENT_TIMEOUT_MS` (default 30s) applied to all pool connections
- **Migrations** — Plain SQL files in `migrations/` executed in order:
  - `001_create_api_schema.sql` — Schema creation
  - `002_create_users_table.sql` — Users + roles
  - `003_create_audit_log_table.sql` — Audit trail
  - `004_seed_admin_user.sql` — Default admin credentials
- **Schema Organization:** `api.*` schema for application tables; `monitoring.*`, `config.*`, `alerts.*` for collector data

---

## Exception Handling

Centralized exception handlers in `main.py`:

| Exception | HTTP Status | Error Code |
|-----------|-------------|------------|
| `RequestValidationError` | 422 | `validation_error` |
| `HTTPException` (400) | 400 | `bad_request` |
| `HTTPException` (401) | 401 | `unauthorized` |
| `HTTPException` (403) | 403 | `forbidden` |
| `HTTPException` (404) | 404 | `not_found` |
| `HTTPException` (409) | 409 | `conflict` |
| `HTTPException` (429) | 429 | `rate_limit_exceeded` |
| `HTTPException` (500) | 500 | `internal_error` |
| Unhandled `Exception` | 500 | `internal_error` |

---

## Testing Strategy

| Test Type | Framework | Location | Focus |
|-----------|-----------|----------|-------|
| Unit | pytest | `tests/unit/` | Service logic, auth, encryption, validation |
| Property | Hypothesis | `tests/property/` | Invariant testing: envelopes, pagination, filtering, RBAC, timestamps, health states, optimistic locking |
| Integration | pytest-asyncio | `tests/integration/` | Router-level tests against real/fake DB |

Profiles: `dev` (fast), `ci` (thorough), `nightly` (exhaustive)
