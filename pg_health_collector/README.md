# PG Health Collector

This service polls metadata DB, picks due checks for active servers, runs each check query on target postgres servers, and stores outcomes in metadata monitoring/alerts tables.

## Collector Execution Tasks (One by One)

- [x] **Task 1 - Load config**  
  Read `configs/config.yaml` for metadata DB connection and collector runtime settings.
- [x] **Task 2 - Initialize metadata connection pool**  
  Open pooled connections to metadata database (`pg_monitoring`).
- [x] **Task 3 - Load hardcoded SQL files**  
  Read SQL files from `app/queries/internal` using path-based loader + in-memory cache.
- [x] **Task 4 - Scheduler loop**  
  Start infinite polling loop (default 30 sec interval).
- [x] **Task 5 - Fetch due checks**  
  Execute `select_due_server_checks.sql` to get active server/check entries that are due.
- [x] **Task 5a - Catch-up calculation**  
  Scheduler calculates overdue run count (`due_runs`) from `monitoring.check_runs.started_at` and effective frequency.
- [x] **Task 6 - Create run row**  
  Insert start row in `monitoring.check_runs` with `insert_check_run.sql`.
- [x] **Task 7 - Execute source check query**  
  Connect to target postgres (`server_ip`, `port`, `db_name`, `username`, `password_encrypted`) and execute `query_text`.
- [x] **Task 8 - Store raw result**  
  Insert payload to `monitoring.monitoring_logs` with `insert_monitoring_log.sql`.
- [x] **Task 9 - Store numeric metrics**  
  For numeric columns in returned rows, insert into `monitoring.monitoring_metrics` with `insert_metrics.sql`.
- [x] **Task 10 - Evaluate thresholds**  
  Load active thresholds via `select_check_thresholds.sql` and evaluate operators (`>`, `<`, `=`, `!=`, `~`).
- [x] **Task 11 - Incident and alert handling**  
  If threshold breach: use `get_or_create_open_incident.sql` and `insert_alert.sql`.  
  If values normalized: call `resolve_incident.sql`.
- [x] **Task 12 - Complete run row**  
  Update `monitoring.check_runs` end time/status/error using `update_check_run.sql`.
- [x] **Task 13 - Sleep and repeat**  
  Wait until next cycle interval, then continue.

## Runtime Flow

1. `app/main.py` bootstraps logging, config, DB pool, and runtime service.
2. `CollectorRuntimeService.run_forever()` controls cycle timing.
3. `CollectorRuntimeService.run_once()` gets due checks.
4. `CollectorRuntimeService._run_single_check()` owns one check execution unit.
5. `CollectorRuntimeService._persist_results()` writes logs/metrics and applies alert logic.

## Query Boundaries

- Collector reads from `config.*`.
- Collector writes to `monitoring.*` and `alerts.*`.
- Collector does **not** update `config.*` tables.
- Collector applies capped catch-up re-runs in memory only (no extra scheduler columns).

## Logging

- Collector log files are stored in `logs` directory at project root.
- Daily runtime log: `logs/YYYY-MM-DD.log`.
- Daily error-only log: `logs/YYYY-MM-DD.error.log`.
- Task Scheduler bootstrap logging is not used; only collector-generated logs are kept.
