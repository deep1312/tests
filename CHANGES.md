# CHANGES LOG

## 2026-07-03 - Design Documents + Knowledge Graphs + Project Instructions

### Purpose
Create comprehensive design documentation for the API and UI components, build persistent knowledge graphs for all three components (API, UI, Collector), and establish project-wide conventions for change tracking and AI-assisted development.

### Changes Made

#### 1. Design Documents
- `API/API_DESIGN.md` — Architecture overview, middleware pipeline (CORS→RequestID→Auth→RateLimit), layered design (Router→Service→Repository→DB), security flow (JWT + bcrypt + AES-256-GCM), response envelope contract, exception handling, testing strategy
- `UI/UI_DESIGN.md` — Architecture overview, data flow diagrams, component tree with all routes, TanStack Query hook inventory, state management (Zustand authStore), shared component patterns, error handling patterns, accessibility strategy, security concerns

#### 2. Knowledge Graphs (graphify — full pipeline)
- `API/graphify-out/` — 2,135 nodes, 3,895 edges, 203 communities
- `UI/graphify-out/` — 712 nodes, 1,104 edges, 90 communities
- `pg_health_collector/graphify-out/` — 137 nodes, 241 edges, 15 communities
- All include: interactive `graph.html`, `GRAPH_REPORT.md`, `graph.json`

#### 3. Project Instructions & Changelog
- `.claude/CLAUDE.md` — Project-level AI instructions: before changes, query graphify + read design docs; after changes, log in CHANGES.md + update graphify
- `CHANGES.md` (this file) — Root-level changelog following collector's format

### Key Design Decisions
- **graphify for persistent memory**: Each component maintains its own knowledge graph in `graphify-out/` for cross-session context
- **Design docs as source of truth**: `API_DESIGN.md` and `UI_DESIGN.md` are the primary architectural references
- **Unified changelog**: Root `CHANGES.md` tracks all project-wide changes; component-specific logs in each subdirectory

### Files Created
- `API/API_DESIGN.md`
- `UI/UI_DESIGN.md`
- `API/graphify-out/` (graph.html, GRAPH_REPORT.md, graph.json, cost.json)
- `UI/graphify-out/` (graph.html, GRAPH_REPORT.md, graph.json, cost.json)
- `pg_health_collector/graphify-out/` (graph.html, GRAPH_REPORT.md, graph.json, cost.json)
- `.claude/CLAUDE.md`
- `CHANGES.md`
- `.gitignore`

## 2026-07-03 - Unified Frequency Override UI (Servers Page) — Fixed

### Reverted previous implementation; rewritten with per-card lazy loading and proper data binding.

### Root Causes of Bugs
1. **Expand all 3**: `useMappings` was called once at the top level — all cards shared the same `mappings` variable and the query fired on mount even when no server was expanded (no `enabled` guard).
2. **No API calls for per-server data**: `useMappings` lacked `enabled` support, so it always fetched with `serverId=undefined` (returning ALL mappings).
3. **Default frequency not from DB**: `FreqEditor` initialized to hardcoded `30` instead of reading `Check.default_frequency_sec` from the API.
4. **Revert broken**: `handleClear` sent `null as any` (worked), but the `FreqEditor` local state was stale after API refetch because `useState` never synced with prop changes.
5. **No refresh on status change**: No invalidation mechanism when mappings were added or toggled.

### Fixes Applied

#### `UI/src/api/checks.ts` — `useMappings`
- Added optional `options?: { enabled?: boolean }` parameter
- Default `enabled` is `!!serverId` (only auto-fetch when a serverId is provided)

#### `UI/src/pages/Servers.tsx` — Complete Rewrite
- **Extracted `ServerCard` sub-component**: Each card manages its own `expanded` state and own `useMappings` call with `enabled: expanded` — panel only opens for the clicked card and only fetches when open.
- **`FreqEditor` fixed**:
  - Added `defaultFreqSec` prop from `Check.default_frequency_sec`
  - Shows default frequency inline: `(30s default)`
  - `useEffect` syncs local state when `mapping.custom_frequency_sec` or `defaultFreqSec` changes externally (but not when dirty)
  - Cancel button resets to effective frequency without API call
  - Clear (×) sends `null` to backend and resets dirty; `useEffect` picks up the new value from the API refetch
- **Grid layout preserved**: `lg:grid-cols-3` for 3 servers per row
- **Removed top-level `expandedServerId` state** — no longer needed

### Query Invalidation
- `useUpdateMapping.onSuccess` already calls `queryClient.invalidateQueries({ queryKey: ['mappings'] })` which invalidates all per-server mapping queries in TanStack Query v5

### Files Modified
- `UI/src/api/checks.ts` — `useMappings` signature: added `options?: { enabled?: boolean }`
- `UI/src/pages/Servers.tsx` — Full rewrite of the frequency editor

### Follow-up fixes

#### is_enabled toggle in Servers panel
- Added `onToggleEnabled` prop to `FreqEditor` + `onToggleMappingEnabled` to `ServerCard`
- Each mapping row now has a small green/grey toggle switch to enable/disable the mapping
- Calls `useUpdateMapping` with `{ is_enabled: bool }` — backend already supports this
- Toggle immediately reflects in the LOV (TanStack invalidates `['mappings']` on success)

#### Auto-create mappings on server creation
- `API/app/services/server_service.py` — added auto-mapping block in `create_server()`
- After the server row + audit log, fetches all active checks via `check_repo.list_checks(conn, is_active=True)`
- Creates a `server_checks_mapping` row for each active check (skips duplicates with `UniqueViolationError`)
- Logs and appends a warning if auto-mapping partially fails; does not block server creation

## 2026-07-03 - Root .gitignore

### Purpose
Add project-wide `.gitignore` to prevent committing generated files, dependencies, logs, environment secrets, IDE files, and graphify intermediates.

### Files Created
- `.gitignore` — Python caches, node_modules, venv, logs, .env, IDE files, OS files, graphify temp scripts
