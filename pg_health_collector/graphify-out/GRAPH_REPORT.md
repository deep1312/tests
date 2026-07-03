# Graph Report - C:\projects\PG Insides\pg_health_collector  (2026-07-03)

## Corpus Check
- Corpus is ~8,513 words - fits in a single context window. You may not need a graph.

## Summary
- 137 nodes · 241 edges · 15 communities (14 shown, 1 thin omitted)
- Extraction: 85% EXTRACTED · 15% INFERRED · 0% AMBIGUOUS · INFERRED: 37 edges (avg confidence: 0.76)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]

## God Nodes (most connected - your core abstractions)
1. `CollectorMetadataService` - 18 edges
2. `QueryExecutor` - 15 edges
3. `int` - 14 edges
4. `CollectorRuntimeService` - 14 edges
5. `QueryExecutor` - 14 edges
6. `CollectorRuntimeService` - 14 edges
7. `main()` - 9 edges
8. `str` - 9 edges
9. `config.checks_master` - 8 edges
10. `config.servers` - 8 edges

## Surprising Connections (you probably didn't know these)
- `CollectorMetadataService` --implements--> `Query Boundaries (config/monitoring/alerts)`  [INFERRED]
  app/services/collector_service.py → COLLECTOR_DESIGN.md
- `CollectorRuntimeService` --executes--> `Target PostgreSQL Servers`  [INFERRED]
  app/services/collector_service.py → COLLECTOR_DESIGN.md
- `CollectorRuntimeService` --implements--> `Check Run Lifecycle Tracking`  [INFERRED]
  app/services/collector_service.py → COLLECTOR_DESIGN.md
- `CollectorRuntimeService` --implements--> `Circuit Breaker Pattern`  [INFERRED]
  app/services/collector_service.py → COLLECTOR_DESIGN.md
- `CollectorRuntimeService` --implements--> `Scheduler Loop`  [INFERRED]
  app/services/collector_service.py → COLLECTOR_DESIGN.md

## Import Cycles
- 1-file cycle: `services/collector_service.py -> services/collector_service.py`

## Communities (15 total, 1 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.16
Nodes (8): datetime, CollectorMetadataService, CollectorRuntimeService, Any, int, str, Sleep until the next poll_interval_sec boundary (e.g., :00 or :30 for 30s interv, _to_jsonable()

### Community 1 - "Community 1"
Cohesion: 0.10
Nodes (18): CHECK_STATUS_FAILED, CHECK_STATUS_IN_PROGRESS, CHECK_STATUS_SUCCESS, CHECK_STATUS_TIMEOUT, CollectorMetadataService, CollectorRuntimeService, _to_jsonable, Target PostgreSQL Servers (+10 more)

### Community 2 - "Community 2"
Cohesion: 0.12
Nodes (6): load_config(), Any, str, PostgresConnectionManager, QueryExecutor, main()

### Community 3 - "Community 3"
Cohesion: 0.31
Nodes (14): Metadata DB (pg_monitoring), Query Boundaries (config/monitoring/alerts), Threshold Evaluation and Alerting, alerts Schema, config Schema, monitoring Schema, alerts.alerts, alerts.incidents (+6 more)

### Community 4 - "Community 4"
Cohesion: 0.34
Nodes (5): Any, int, str, QueryExecutor, QueryExecutor

### Community 5 - "Community 5"
Cohesion: 0.33
Nodes (8): _decrypt_password(), evaluate_threshold(), execute_check_query(), Any, bool, str, Decrypt a base64-encoded AES-256-GCM encrypted password., Execute check query_text on target postgres server and return rows.

### Community 6 - "Community 6"
Cohesion: 0.29
Nodes (6): ErrorOnlyFilter, configure_logging(), ErrorOnlyFilter, bool, int, LogRecord

### Community 8 - "Community 8"
Cohesion: 0.50
Nodes (3): load_sql_file(), str, Load an SQL file and return its text.

## Knowledge Gaps
- **21 isolated node(s):** `bool`, `str`, `Any`, `LogRecord`, `bool` (+16 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `main()` connect `Community 2` to `Community 0`, `Community 6`, `Community 7`?**
  _High betweenness centrality (0.229) - this node is a cross-community bridge._
- **Why does `QueryExecutor` connect `Community 4` to `Community 0`?**
  _High betweenness centrality (0.145) - this node is a cross-community bridge._
- **Why does `CollectorRuntimeService` connect `Community 0` to `Community 2`, `Community 4`?**
  _High betweenness centrality (0.124) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `CollectorMetadataService` (e.g. with `main()` and `QueryExecutor`) actually correct?**
  _`CollectorMetadataService` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 7 inferred relationships involving `QueryExecutor` (e.g. with `datetime` and `QueryExecutor`) actually correct?**
  _`QueryExecutor` has 7 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `CollectorRuntimeService` (e.g. with `main()` and `QueryExecutor`) actually correct?**
  _`CollectorRuntimeService` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 12 inferred relationships involving `QueryExecutor` (e.g. with `apply_scheduler_analytics_schema_updates.sql` and `get_or_create_open_incident.sql`) actually correct?**
  _`QueryExecutor` has 12 INFERRED edges - model-reasoned connections that need verification._