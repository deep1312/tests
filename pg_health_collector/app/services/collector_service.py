import logging
import time
from decimal import Decimal
from datetime import datetime, timedelta, timezone
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, List, Optional

from psycopg2.extras import Json

from app.collectors.base import evaluate_threshold, execute_check_query
from app.db.executor import QueryExecutor

logger = logging.getLogger(__name__)

# Check run status constants
CHECK_STATUS_SUCCESS = 1
CHECK_STATUS_FAILED = 2
CHECK_STATUS_TIMEOUT = 3
CHECK_STATUS_IN_PROGRESS = 4


def _to_jsonable(value: Any) -> Any:
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, dict):
        return {k: _to_jsonable(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_to_jsonable(v) for v in value]
    return value


class CollectorMetadataService:
    Q_ACTIVE_CHECKS = "internal/select_active_checks.sql"
    Q_THRESHOLDS = "internal/select_check_thresholds.sql"
    Q_INSERT_RUN = "internal/insert_check_run.sql"
    Q_UPDATE_RUN = "internal/update_check_run.sql"
    Q_INSERT_METRIC = "internal/insert_metrics.sql"
    Q_INSERT_LOG = "internal/insert_monitoring_log.sql"
    Q_GET_OR_CREATE_INCIDENT = "internal/get_or_create_open_incident.sql"
    Q_RESOLVE_INCIDENT = "internal/resolve_incident.sql"
    Q_INSERT_ALERT = "internal/insert_alert.sql"
    Q_RESET_MAPPING_FAILURE = "internal/reset_mapping_failure.sql"
    Q_INCREMENT_MAPPING_FAILURE = "internal/increment_mapping_failure.sql"
    Q_STALE_IN_PROGRESS_CLEANUP = "internal/stale_in_progress_cleanup.sql"
    Q_ACTIVE_TABLE_COUNT_TABLES = "internal/select_active_table_count_tables.sql"

    def __init__(self, query_executor: QueryExecutor):
        self.query_executor = query_executor

    def get_active_checks(self):
        return self.query_executor.fetch_all(self.Q_ACTIVE_CHECKS)

    def get_thresholds(self, check_id: int, server_id: int):
        return self.query_executor.fetch_all(self.Q_THRESHOLDS, (check_id, server_id))

    def create_check_run(self, started_at, scheduled_at, cycle_started_at, server_id: int, check_id: int, status: int):
        return self.query_executor.fetch_one(
            self.Q_INSERT_RUN, (started_at, scheduled_at, cycle_started_at, server_id, check_id, status)
        )

    def complete_check_run(
        self,
        run_id: int,
        started_at,
        ended_at,
        status: int,
        execution_time_ms: int,
        error_message,
    ):
        return self.query_executor.fetch_one(
            self.Q_UPDATE_RUN,
            (run_id, started_at, ended_at, status, execution_time_ms, error_message),
        )

    def insert_metric(
        self,
        collected_at,
        server_id: int,
        check_id: int,
        metric_name: str,
        metric_value,
        labels,
    ):
        return self.query_executor.fetch_one(
            self.Q_INSERT_METRIC,
            (collected_at, server_id, check_id, metric_name, metric_value, labels),
        )

    def insert_monitoring_log(
        self,
        collected_at,
        server_id: int,
        check_id: int,
        raw_result,
        status_code: int,
        execution_time_ms: int,
    ):
        return self.query_executor.fetch_one(
            self.Q_INSERT_LOG,
            (
                collected_at,
                server_id,
                check_id,
                raw_result,
                status_code,
                execution_time_ms,
            ),
        )

    def get_or_create_open_incident(self, server_id: int, check_id: int, started_at, root_cause):
        return self.query_executor.fetch_one(
            self.Q_GET_OR_CREATE_INCIDENT, (server_id, check_id, started_at, root_cause)
        )

    def resolve_incident(self, server_id: int, check_id: int, ended_at, root_cause):
        return self.query_executor.fetch_all(
            self.Q_RESOLVE_INCIDENT, (server_id, check_id, ended_at, root_cause)
        )

    def insert_alert(
        self,
        incident_id,
        server_id: int,
        check_id: int,
        metric_name: str,
        observed_value: str,
        status: int,
        triggered_at,
        acknowledged_at,
    ):
        return self.query_executor.fetch_one(
            self.Q_INSERT_ALERT,
            (
                incident_id,
                server_id,
                check_id,
                metric_name,
                observed_value,
                status,
                triggered_at,
                acknowledged_at,
            ),
        )

    def cleanup_stale_in_progress(self):
        return self.query_executor.execute(self.Q_STALE_IN_PROGRESS_CLEANUP)

    def get_active_table_count_tables(self):
        return self.query_executor.fetch_all(self.Q_ACTIVE_TABLE_COUNT_TABLES)

    def reset_mapping_failure(self, server_id: int, check_id: int):
        return self.query_executor.fetch_one(self.Q_RESET_MAPPING_FAILURE, (server_id, check_id))

    def increment_mapping_failure(
        self,
        server_id: int,
        check_id: int,
        threshold_failures: int,
        backoff_seconds: int,
    ):
        return self.query_executor.fetch_one(
            self.Q_INCREMENT_MAPPING_FAILURE,
            (server_id, check_id, threshold_failures, backoff_seconds),
        )

class CollectorRuntimeService:
    def __init__(
        self,
        metadata_service: CollectorMetadataService,
        poll_interval_sec: int = 30,
        max_parallel_checks: int = 5,
        circuit_breaker_threshold: int = 3,
        circuit_breaker_backoff_sec: int = 300,
        encryption_key: Optional[str] = None,
    ):
        self.metadata_service = metadata_service
        self.poll_interval_sec = max(1, poll_interval_sec)
        self.max_parallel_checks = max(1, max_parallel_checks)
        self.circuit_breaker_threshold = max(1, circuit_breaker_threshold)
        self.circuit_breaker_backoff_sec = max(1, circuit_breaker_backoff_sec)
        self.encryption_key = encryption_key
        self._schedule: Dict[tuple, datetime] = {}
        self._running: set = set()
        self._executor = ThreadPoolExecutor(max_workers=self.max_parallel_checks)

    def _sleep_until_next_boundary(self) -> None:
        """Sleep until the next poll_interval_sec boundary (e.g., :00 or :30 for 30s interval)."""
        now = time.time()
        interval = self.poll_interval_sec
        elapsed = now % interval
        sleep_sec = interval - elapsed
        if sleep_sec < 0.1:
            sleep_sec = interval
        time.sleep(sleep_sec)

    def run_forever(self) -> None:
        logger.info("Collector scheduler started with poll_interval_sec=%s", self.poll_interval_sec)
        self._sleep_until_next_boundary()
        cycle = 0
        while True:
            try:
                cycle += 1
                cycle_start = datetime.now(timezone.utc).replace(microsecond=0)
                self.run_once(cycle_start)
                elapsed = time.time() - cycle_start.timestamp()
                logger.info("Cycle %d dispatched checks elapsed_sec=%.2f", cycle, elapsed)
            except Exception:
                logger.exception("Cycle %d failed", cycle)
            self._sleep_until_next_boundary()

    def run_once(self, cycle_start: datetime) -> int:
        due_checks = self.metadata_service.get_active_checks()
        to_run: List[Dict[str, Any]] = []
        seen_keys: set = set()

        for check in due_checks:
            key = (check["server_id"], check["check_id"])
            freq = int(check.get("effective_frequency_sec") or 30)

            if key in seen_keys:
                continue
            seen_keys.add(key)

            if key in self._running:
                logger.debug(
                    "Skipping server_id=%s check_id=%s - still running",
                    check["server_id"], check["check_id"],
                )
                continue

            sched = check.get("scheduled_at")
            scheduled_at = sched if sched is not None else cycle_start
            check["scheduled_at"] = scheduled_at

            prev_next = self._schedule.get(key)

            if prev_next is not None and cycle_start < prev_next:
                logger.debug(
                    "In-memory guard blocked server_id=%s check_id=%s "
                    "prev_next=%s cycle_start=%s",
                    check["server_id"], check["check_id"],
                    prev_next.isoformat(), cycle_start.isoformat(),
                )
                continue

            to_run.append(check)
            self._schedule[key] = cycle_start + timedelta(seconds=freq)

        stale = set(self._schedule.keys()) - {(c["server_id"], c["check_id"]) for c in due_checks}
        for key in stale:
            del self._schedule[key]

        if not to_run:
            return 0

        for check in to_run:
            future = self._executor.submit(self._run_single_check, check, cycle_start)
            future.add_done_callback(self._on_check_future_done)
        return len(to_run)

    def _run_single_check(self, check: Dict[str, Any], cycle_start: datetime) -> None:
        server_id = check["server_id"]
        check_id = check["check_id"]
        key = (server_id, check_id)
        self._running.add(key)
        try:
            self._execute_check(check, cycle_start)
        finally:
            self._running.discard(key)

    def _execute_check(self, check: Dict[str, Any], cycle_start: datetime) -> None:
        server_id = check["server_id"]
        check_id = check["check_id"]
        logger.info("Check start server_id=%s check_id=%s", server_id, check_id)
        started_at = cycle_start
        scheduled_at = check.get("scheduled_at") or started_at
        run = self.metadata_service.create_check_run(
            started_at, scheduled_at, cycle_start, server_id, check_id, CHECK_STATUS_IN_PROGRESS
        )
        if run is None:
            logger.warning(
                "DB-level guard skipped duplicate run server_id=%s check_id=%s scheduled_at=%s",
                server_id, check_id, scheduled_at.isoformat(),
            )
            return
        run_id = run["run_id"]
        run_started_at = run["started_at"]
        cycle_status = CHECK_STATUS_SUCCESS
        error_message: Optional[str] = None
        execution_time_ms = 0
        try:
            if check_id == 10:
                tables = self.metadata_service.get_active_table_count_tables()
                if not tables:
                    logger.warning("Check 10: no active tables in config.table_count_config")
                    rows = []
                else:
                    table_arr = [f"{t['schema_name']}.{t['table_name']}" for t in tables]
                    arr_literal = "ARRAY[" + ", ".join(f"'{t}'" for t in table_arr) + "]"
                    check = dict(check)
                    check["query_text"] = f"SELECT * FROM monitoring_dashboard.get_table_counts({arr_literal});"
                    logger.info("Check 10: built query for %s tables on server_id=%s", len(table_arr), server_id)
                    query_started = time.time()
                    rows = execute_check_query(check, self.encryption_key)
                    execution_time_ms = int((time.time() - query_started) * 1000)
            else:
                query_started = time.time()
                rows = execute_check_query(check, self.encryption_key)
                execution_time_ms = int((time.time() - query_started) * 1000)
            self._persist_results(check, rows, execution_time_ms, run_started_at)
        except Exception as exc:
            error_text = str(exc).lower()
            cycle_status = CHECK_STATUS_TIMEOUT if ("timeout" in error_text or "statement timeout" in error_text) else CHECK_STATUS_FAILED
            error_message = str(exc)
            logger.error(
                "Check failed server_id=%s check_id=%s error=%s",
                server_id,
                check_id,
                error_message,
            )
            failure_state = self.metadata_service.increment_mapping_failure(
                server_id=server_id,
                check_id=check_id,
                threshold_failures=self.circuit_breaker_threshold,
                backoff_seconds=self.circuit_breaker_backoff_sec,
            )
            if failure_state and failure_state.get("backoff_until") is not None:
                logger.warning(
                    "Circuit breaker active server_id=%s check_id=%s consecutive_failures=%s backoff_until=%s",
                    server_id,
                    check_id,
                    failure_state.get("consecutive_failures"),
                    failure_state.get("backoff_until"),
                )
        finally:
            self.metadata_service.complete_check_run(
                run_id=run_id,
                started_at=run_started_at,
                ended_at=datetime.now(timezone.utc).replace(microsecond=0),
                status=cycle_status,
                execution_time_ms=execution_time_ms,
                error_message=error_message,
            )
            if cycle_status == CHECK_STATUS_SUCCESS:
                self.metadata_service.reset_mapping_failure(server_id=server_id, check_id=check_id)
                self.metadata_service.resolve_incident(
                    server_id=server_id,
                    check_id=check_id,
                    ended_at=datetime.now(timezone.utc).replace(microsecond=0),
                    root_cause="Check recovered",
                )
            logger.info(
                "Check end server_id=%s check_id=%s status=%s execution_time_ms=%s",
                server_id,
                check_id,
                cycle_status,
                execution_time_ms,
            )

    @staticmethod
    def _on_check_future_done(future) -> None:
        try:
            future.result()
        except Exception:
            logger.exception("Background check future failed")

    def shutdown(self) -> None:
        self._executor.shutdown(wait=False)

    def _persist_results(self, check: Dict[str, Any], rows: List[Dict[str, Any]], execution_time_ms: int, collected_at: datetime) -> None:
        payload = _to_jsonable({"row_count": len(rows), "rows": rows})
        self.metadata_service.insert_monitoring_log(
            collected_at=collected_at,
            server_id=check["server_id"],
            check_id=check["check_id"],
            raw_result=Json(payload),
            status_code=1,
            execution_time_ms=execution_time_ms,
        )
        thresholds = self.metadata_service.get_thresholds(check["check_id"], check["server_id"])
        for row in rows:
            self._persist_row_metrics(check, collected_at, row, thresholds)

    def _persist_row_metrics(
        self,
        check: Dict[str, Any],
        collected_at,
        row: Dict[str, Any],
        thresholds: List[Dict[str, Any]],
    ) -> None:
        labels = {k: v for k, v in row.items() if not isinstance(v, (int, float)) and k != "metric_name"}
        labels = _to_jsonable(labels)
        for metric_name, metric_value in row.items():
            if isinstance(metric_value, bool):
                continue
            if isinstance(metric_value, (int, float)):
                self.metadata_service.insert_metric(
                    collected_at=collected_at,
                    server_id=check["server_id"],
                    check_id=check["check_id"],
                    metric_name=metric_name,
                    metric_value=metric_value,
                    labels=Json(labels),
                )
                self._evaluate_and_alert(
                    check=check,
                    metric_name=metric_name,
                    metric_value=metric_value,
                    thresholds=thresholds,
                    collected_at=collected_at,
                )

    def _evaluate_and_alert(
        self,
        check: Dict[str, Any],
        metric_name: str,
        metric_value: Any,
        thresholds: List[Dict[str, Any]],
        collected_at,
    ) -> None:
        matching = [t for t in thresholds if t["metric_name"] == metric_name]
        if not matching:
            return

        any_open = False
        for threshold in matching:
            warning_hit = evaluate_threshold(
                metric_value,
                threshold["comparison_operator"],
                threshold["warning_value_num"],
            )
            critical_hit = evaluate_threshold(
                metric_value,
                threshold["comparison_operator"],
                threshold["critical_value_num"],
            )
            if not warning_hit and not critical_hit:
                continue
            any_open = True
            status = 2 if critical_hit else 1
            incident = self.metadata_service.get_or_create_open_incident(
                server_id=check["server_id"],
                check_id=check["check_id"],
                started_at=collected_at,
                root_cause=f"{metric_name} breached threshold",
            )
            self.metadata_service.insert_alert(
                incident_id=incident["incident_id"],
                server_id=check["server_id"],
                check_id=check["check_id"],
                metric_name=metric_name,
                observed_value=str(metric_value),
                status=status,
                triggered_at=collected_at,
                acknowledged_at=None,
            )
        if not any_open:
            self.metadata_service.resolve_incident(
                server_id=check["server_id"],
                check_id=check["check_id"],
                ended_at=collected_at,
                root_cause=f"{metric_name} back to normal",
            )
