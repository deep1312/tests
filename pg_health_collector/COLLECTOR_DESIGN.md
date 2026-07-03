# PG Health Collector — High-Level Design

## Purpose

The PG Health Collector is a lightweight, asynchronous monitoring agent that polls a metadata database for due checks, executes SQL queries against target PostgreSQL servers, and persists the results (metrics, logs, alerts) back to the metadata database. It runs as a long-lived process with a fixed-interval cycle loop (default 30s).

---

## Architecture

```
                    ┌──────────────────────────────────────┐
                    │         Metadata DB (pg_monitoring)   │
                    │  ┌───────────┐  ┌──────────────────┐  │
                    │  │ config.*  │  │ monitoring.*     │  │
                    │  │ servers   │  │ check_runs       │  │
                    │  │ checks    │  │ monitoring_logs  │  │
                    │  │ thresholds│  │ monitoring_metric │  │
                    │  │ mappings  │  ├──────────────────┤  │
                    │  │           │  │ alerts.*         │  │
                    │  └───────────┘  │ incidents        │  │
                    │                 │ alerts           │  │
                    │                 └──────────────────┘  │
                    └──────────┬───────────┬───────────────┘
                               │           ▲
                    reads config│           │ writes monitoring
                    +-------------------------------+ alerts
                    │        PG Health Collector     │
                    │  main.py                       │
                    │  ├─ CollectorRuntimeService    │
                    │  │   ├─ run_forever() (loop)   │
                    │  │   ├─ run_once() (dispatch)  │
                    │  │   └─ _run_single_check()   │
                    │  ├─ CollectorMetadataService   │
                    │  └─ QueryExecutor (SQL cache)  │
                    └──────────┬────────────────────┘
                               │
                    ┌──────────▼────────────────────────┐
                    │     Target PostgreSQL Servers      │
                    │  (each runs check query_text)      │
                    └───────────────────────────────────┘
```

### Key Components

| Component | File | Responsibility |
|-----------|------|----------------|
| `main.py` | `app/main.py` | Bootstrap: logging, config, DB pool, schema updates, stale-cleanup, start loop |
| `CollectorRuntimeService` | `app/services/collector_service.py` | Cycle timing, check dispatch, in-memory schedule guard, thread pool management |
| `CollectorMetadataService` | `app/services/collector_service.py` | All metadata DB queries (active checks, thresholds, check_runs CRUD, incidents, alerts) |
| `QueryExecutor` | `app/db/executor.py` | SQL file loader + placeholder re-mapping (`$N` → `%s`) + query cache |
| `PostgresConnectionManager` | `app/db/connection.py` | psycopg2 `SimpleConnectionPool` wrapper |
| `execute_check_query` | `app/collectors/base.py` | Decrypts credentials, connects to target, runs query with `statement_timeout` |

---

## Collector Cycle Lifecycle

```
run_forever()
│
├─ _sleep_until_next_boundary()    # sleep until :00 or :30
│
└─ LOOP:
   ├─ cycle_start = NOW() truncated to seconds
   ├─ run_once(cycle_start)
   │   ├─ get_active_checks()          # SQL: select_active_checks.sql
   │   ├─ for each due check:
   │   │   ├─ in-memory guard: skip if cycle_start < _schedule[key]
   │   │   ├─ _schedule[key] = cycle_start + freq    # set next allowed time
   │   │   └─ add to to_run list
   │   ├─ prune stale _schedule keys
   │   └─ submit each check to ThreadPoolExecutor
   │       └─ _run_single_check(check, cycle_start)
   │           ├─ _running.add(key)
   │           ├─ _execute_check()
   │           └─ _running.discard(key)  [finally]
   │
   ├─ log "Cycle N dispatched checks"
   └─ _sleep_until_next_boundary()
```

### Key Design Decisions

- **Non-blocking dispatch**: `run_once()` submits checks to a persistent `ThreadPoolExecutor` and returns immediately. The loop does not wait for check completion.
- **`_schedule` guard**: Prevents the same check from running more than once per frequency window. Uses `cycle_start` (whole-second boundary) to avoid microsecond drift.
- **`_running` set guard**: Prevents duplicate execution when a check from a previous cycle is still running (overlap protection).
- **Error isolation**: A failure in one check does not affect other checks in the same cycle.

---

## Check Execution Lifecycle

```
_execute_check(check, cycle_start)
│
├─ create_check_run()
│   INSERT INTO monitoring.check_runs
│   (started_at, scheduled_at, cycle_started_at, server_id, check_id, status=4)
│   └─ ON CONFLICT DO NOTHING  (DB-level duplicate guard)
│
├─ [if INSERT returned None → skip: DB guard blocked duplicate]
│
├─ TRY:
│   ├─ execute_check_query()    # connect to target, run SQL
│   └─ _persist_results()       # write logs + metrics + evaluate thresholds
│
├─ EXCEPT:
│   ├─ classify: TIMEOUT (3) vs FAILED (2)
│   ├─ increment_mapping_failure()  # circuit breaker
│   └─ log error
│
└─ FINALLY:
    ├─ complete_check_run()
    │   UPDATE monitoring.check_runs SET
    │   ended_at, status(1/2/3), execution_time_ms, error_message
    │
    └─ [if SUCCESS]:
        ├─ reset_mapping_failure()   # clear circuit breaker
        └─ resolve_incident()        # close any open incident
```

### Check Run Status Values

| Value | Label | Description |
|-------|-------|-------------|
| 1 | SUCCESS | Check completed and results persisted |
| 2 | FAILED | Check execution raised an exception (non-timeout) |
| 3 | TIMEOUT | Exception contained "timeout" or "statement timeout" |
| 4 | IN_PROGRESS | Inserted before execution, updated on completion |

### Timestamp Columns in `monitoring.check_runs`

| Column | Source | Purpose |
|--------|--------|---------|
| `started_at` | `cycle_start` | When the check was submitted (cycle boundary) |
| `scheduled_at` | From `select_active_checks` or `cycle_start` | Intended scheduled time from the frequency logic |
| `cycle_started_at` | `cycle_start` | The exact cycle boundary that triggered this run (e.g. `14:31:00`) |
| `ended_at` | `NOW()` truncated to seconds | When the check completed |

---

## Circuit Breaker

When a check fails, `increment_mapping_failure()` increments `consecutive_failures` in `config.server_checks_mapping`. If `consecutive_failures >= threshold`, `backoff_until` is set to `NOW() + backoff_seconds`.

While `backoff_until > NOW()`, `select_active_checks.sql` excludes the mapping, preventing further execution until the backoff expires or is cleared.

On success, `reset_mapping_failure()` resets `consecutive_failures = 0` and clears `backoff_until`.

### Configuration

| Parameter | Default | Column in `server_checks_mapping` |
|-----------|---------|-----------------------------------|
| `circuit_breaker_threshold` | 3 | `consecutive_failures` compared against this |
| `circuit_breaker_backoff_sec` | 300 | Used in `NOW() + make_interval(secs => $4)` |

---

## Threshold Evaluation & Alerting

After persisting metrics, the collector evaluates each numeric metric against active thresholds from `config.check_thresholds`:

```
_evaluate_and_alert()
│
├─ For each threshold matching metric_name:
│   ├─ evaluate_threshold(value, operator, warning_value)
│   ├─ evaluate_threshold(value, operator, critical_value)
│   ├─ Supported operators: >, <, =, !=, ~ (regex)
│   └─ [if breach detected]:
│       ├─ get_or_create_open_incident()  # status=1 (OPEN)
│       └─ insert_alert()
│
└─ [if no breach and any incident was previously open]:
    └─ resolve_incident()
```

### Incident States

| Status | Label | Description |
|--------|-------|-------------|
| 1 | OPEN | At least one active alert for this check |
| 2 | RESOLVED | All metrics returned to normal or check recovered |

---

## Startup Sequence

1. **Configure logging** — daily rotating file + console + error-only file
2. **Load config** — `configs/config.yaml` (metadata DB, encryption key, collector params)
3. **Initialize connection pool** — `SimpleConnectionPool` to metadata DB
4. **Apply schema updates** — `apply_scheduler_analytics_schema_updates.sql`
   - Add `scheduled_at`, `cycle_started_at` columns
   - Add `consecutive_failures`, `backoff_until` columns
   - Create `uq_check_runs_server_check_scheduled` unique index
5. **Clean stale IN_PROGRESS** — `stale_in_progress_cleanup.sql`
   - Marks all `status=4 AND ended_at IS NULL` as `FAILED` with error message
   - Handles collector crashes or forced restarts mid-execution
6. **Start scheduler loop** — `run_forever()` begins cycle dispatch

---

## Query Boundaries

| Schema | Access | Purpose |
|--------|--------|---------|
| `config.*` | SELECT only | Servers, checks, thresholds, mappings, circuit breaker state |
| `monitoring.*` | INSERT / UPDATE | check_runs, monitoring_logs, monitoring_metrics |
| `alerts.*` | INSERT / UPDATE | incidents, alerts |

---

## Logging

- **Console**: stdout with `%(asctime)s %(levelname)s [%(name)s] %(message)s`
- **Runtime log**: `logs/YYYY-MM-DD.log` (all levels)
- **Error log**: `logs/YYYY-MM-DD.error.log` (ERROR and above only)
- File rotation: daily (new file per calendar day)
