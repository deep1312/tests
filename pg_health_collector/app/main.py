import logging

from app.core.config import load_config
from app.core.logger import configure_logging
from app.db.connection import PostgresConnectionManager
from app.db.executor import QueryExecutor
from app.services.collector_service import CollectorMetadataService, CollectorRuntimeService

logger = logging.getLogger(__name__)


def main() -> None:
    configure_logging()
    cfg = load_config()
    postgres_cfg = cfg["postgres"]
    collector_cfg = cfg.get("collector", {})
    encryption_key = cfg.get("credential_encryption_key", "")

    metadata_conn_manager = PostgresConnectionManager(postgres_cfg)
    metadata_conn_manager.initialize_pool()

    try:
        query_executor = QueryExecutor(metadata_conn_manager)
        # Ensure new scheduler analytics/circuit-breaker columns exist before runtime starts.
        query_executor.execute("internal/apply_scheduler_analytics_schema_updates.sql")
        metadata_service = CollectorMetadataService(query_executor)
        # Mark any stale IN_PROGRESS check runs as FAILED before starting the loop.
        metadata_service.cleanup_stale_in_progress()
        runtime_service = CollectorRuntimeService(
            metadata_service=metadata_service,
            poll_interval_sec=collector_cfg.get("poll_interval_sec", 30),
            max_parallel_checks=collector_cfg.get("max_parallel_checks", 5),
            circuit_breaker_threshold=collector_cfg.get("circuit_breaker_threshold", 3),
            circuit_breaker_backoff_sec=collector_cfg.get("circuit_breaker_backoff_sec", 300),
            encryption_key=encryption_key,
        )
        runtime_service.run_forever()
    except KeyboardInterrupt:
        logger.info("Collector shutting down...")
    finally:
        runtime_service.shutdown()
        metadata_conn_manager.close_all()


if __name__ == "__main__":
    main()
