# CHANGES LOG

## 2026-07-02 - Non-blocking Collector Cycle + Check Run Lifecycle Tracking

### Purpose
Fix critical issue where collector cycles were being missed because `run_forever()` blocks on `future.result()` until ALL checks complete. Some checks (e.g., check_id=9 pg_stat_statements) take 10-58+ seconds, causing entire cycles to take 5+ minutes. This blocks the next scheduled trigger at :00/:30.

### Problem Evidence (from 2026-07-01 logs)
- `Cycle 596 completed elapsed_sec=509.82` (8.5 minutes blocked!)
- `Cycle 617 completed elapsed_sec=60.37` (1+ minute blocked)
- Many cycles: `processed_checks=0 elapsed_sec=0.01` (empty cycles, checks still running from previous)
- The `ThreadPoolExecutor` + `future.result()` pattern in `run_once()` creates a new pool per cycle and waits for all futures

### Problem Evidence (from 2026-07-02 logs)
- After the non-blocking fix, 30s cycles with 0 checks still occurred (Cycles 6 and 8)
- **Root cause 1 (DB-level)**: `select_active_checks.sql` used `MAX(cr.started_at)` for `is_due` computation
  - `started_at` is the time of INSERT (slightly AFTER the cycle boundary), not the cycle boundary itself
  - e.g., check-2 inserted at `14:49:30.016`, next cycle at `14:50:00.008` → diff = 29.992s < 30 → `is_due = FALSE`
  - Fix: use `MAX(COALESCE(cr.cycle_started_at, cr.started_at))` — `cycle_started_at` is the exact cycle boundary
- **Root cause 2 (in-memory)**: `_schedule` guard used `now` (slightly after boundary) + freq to compute next run time
  - e.g., `_schedule[key] = 15:17:00.025 + 30s = 15:17:30.025`, next cycle `now=15:17:30.017` < `15:17:30.025` → SKIPPED
  - Fix: use `cycle_start` (exact boundary) for schedule computation: `_schedule[key] = cycle_start + timedelta(seconds=freq)`

### Requirements
1. Every 30 seconds (at :00 and :30), trigger all 9 checks for all servers
2. Before executing each check, insert a `check_run` entry with `status=4` (IN_PROGRESS)
3. Checks run asynchronously in background - the loop does NOT wait for completion
4. Next schedule triggers at :30 regardless of whether previous checks finished
5. Track `cycle_started_at` in `check_runs` to know which cycle triggered each check
6. If a check is still running from a previous cycle, skip it (don't start duplicate)

### Changes Made

#### 1. CHANGES.md (this file)
- Created to track all changes, purpose, and requirements

#### 2. Schema: `app/queries/internal/apply_scheduler_analytics_schema_updates.sql`
- Add `cycle_started_at timestamp with time zone` column to `monitoring.check_runs`
- Update status comment to include `4=IN_PROGRESS`

#### 3. SQL: `app/queries/internal/insert_check_run.sql`
- Add `cycle_started_at` as 7th parameter
- Default initial status to `4` (IN_PROGRESS)
- Comment update: status 4=IN_PROGRESS

#### 4. SQL: `app/queries/internal/select_active_checks.sql`
- Changed `last_started_at` → `last_cycle_at` using `MAX(COALESCE(cr.cycle_started_at, cr.started_at))`
- This ensures the `is_due` computation uses the exact cycle boundary time, not the INSERT timestamp
- Fallback to `started_at` for rows created before `cycle_started_at` column existed

#### 5. Python: `app/services/collector_service.py`
- **Non-blocking `run_forever()`**: Created persistent `ThreadPoolExecutor` (not per-cycle)
- **`run_once()` returns immediately**: Submits futures without calling `future.result()`
- **Error callback**: `add_done_callback()` logs exceptions from fire-and-forget futures
- **Status constants**: `IN_PROGRESS=4, SUCCESS=1, FAILED=2, TIMEOUT=3`
- **Pass `cycle_started_at`**: Cycle boundary timestamp flows through to `_execute_check()`
- **Insert with IN_PROGRESS**: `create_check_run()` now inserts with status=4 before execution
- **Graceful shutdown**: `shutdown()` method for clean executor termination

#### 6. Files Modified
- `CHANGES.md` (new)
- `app/queries/internal/apply_scheduler_analytics_schema_updates.sql`
- `app/queries/internal/insert_check_run.sql`
- `app/queries/internal/select_active_checks.sql`
- `app/services/collector_service.py`
- `app/main.py`

### Status Values
| Value | Meaning |
|-------|---------|
| 1 | SUCCESS |
| 2 | FAILED |
| 3 | TIMEOUT |
| 4 | IN_PROGRESS (new) |

## 2026-07-02 - Eliminate Microsecond Drift (Root Fix for Cycle Misses)

### Purpose
After the non-blocking + `cycle_started_at` fix, cycles were still being missed due to sub-millisecond timing drift between `datetime.now()` calls. `cycle_start` (set once per cycle) is now the single source of truth for all scheduling and timestamp decisions, truncated to whole seconds.

### Root Cause
- `run_forever()` set `cycle_start` with microsecond precision (e.g., `14:49:30.016`)
- `run_once()` called `datetime.now()` again (e.g., `14:49:30.042`) for scheduling — slightly different from `cycle_start`
- `_schedule[key] = now + freq` → e.g., `14:49:30.042 + 30s = 14:50:00.042`
- Next cycle at `14:50:00.019` → `now (14:50:00.019) < prev_next (14:50:00.042)` → SKIPPED
- This drift accumulates and varies by cycle (25-45ms), causing intermittent misses

### Fix
- Removed ALL `datetime.now()` calls from scheduling/timestamp logic
- `cycle_start` truncated to whole seconds: `datetime.now(timezone.utc).replace(microsecond=0)`
- `run_once()` uses `cycle_start` (not `now`) for `scheduled_at` fallback and `prev_next` comparison
- `_execute_check()` uses `cycle_start` for `started_at`
- `ended_at` calls also truncated to whole seconds with `.replace(microsecond=0)`
- All `_schedule[key]` values are now whole-second boundaries (e.g., `14:50:00`, not `14:50:00.042`)

### Design Decisions
- **Persistent thread pool**: Reuse one `ThreadPoolExecutor` across cycles instead of creating/shutting down per cycle
- **Fire-and-forget**: `run_once()` submits checks and returns immediately; next cycle starts at next boundary
- **`_running` guard preserved**: Prevents duplicate execution of the same check across overlapping cycles
- **`cycle_started_at`**: Identifies which scheduled cycle (e.g., "the cycle at 14:31:00") triggered a check, separate from per-check `started_at`
