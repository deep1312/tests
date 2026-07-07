# OPUS ANALYSIS PROMPT: Code Review & Task Breakdown

## Context
You are reviewing a monitoring/analytics dashboard application with these modules:
- Dashboard (server metrics overview)
- Server Page (individual server configuration)
- PG Check (PostgreSQL health monitoring - live & historical data)
- Sources (data collection management)
- Settings (admin configuration)
- General UI/UX improvements

**Your Role:** Code analyst. You must ANALYZE the codebase using Graphify, identify all affected files/components, and produce a structured task breakdown with EXACT implementation steps. Do NOT implement changes yet.

---

## CHANGE REQUIREMENTS

### Dashboard Module
1. **Legend Layout Fix**
   - Change: Show total server count (big number) + inactive server count (small, beside inactive)
   - Current: Unclear layout
   - Must verify: Legend component structure, data sources for server counts

2. **Remove Server Status Dropdown**
   - Change: Remove "server status stale etc." legend at right side top
   - Current: Visible dropdown with status options
   - Must verify: What triggers visibility, dependencies on this filter

3. **Rename Top Failures Section**
   - Change: Label shows "top failures" but data is collector failures → rename to "Collector Failures"
   - Current: Misleading title
   - Must verify: Data source (collector vs server), graph component name

### Server Page Module
1. **Check Frequency Dropdown Bug**
   - Change: Custom config dropdown shows cross button to remove/reset, but button doesn't work
   - Current: Cross visible but non-functional
   - Must verify: Button event handler, reset logic, localStorage/API persistence, validation

2. **Accordion Collapse Behavior**
   - Change: Opening check frequency dropdown on Server B should auto-collapse Server A's dropdown
   - Current: Multiple dropdowns stay open
   - Must verify: State management (useState, context, or Redux?), parent-child component structure

### PG Check Module (Live & Historical Data)
1. **Connection Block Enhancement**
   - Change: Show total connections + current query percentage (for ALL filters: 24h, 1h, custom)
   - For 1h filter: Use latest timestamp data only
   - Must verify: API endpoints, filter parameters, calculation logic, data aggregation

2. **Connection Graph Orientation**
   - Change: Fix time-axis direction (currently max time on LEFT, should be LEFT→RIGHT timeline)
   - Current: Inverted time progression
   - Must verify: Chart library (recharts/chartjs?), xAxis configuration, data ordering

3. **WAL Production Sizing**
   - Change: Remove static "Total size (GB)" label when data already includes unit (GB/MB/TB)
   - Current: Redundant "(GB)" suffix when unit already present
   - Must verify: Data format from API, label component logic, unit parsing

4. **Slow Query Graph Removal**
   - Change: Remove slow query graph entirely; keep only avg response time + active logged queries
   - Current: Graph shown but marked as "unrelevant"
   - Must verify: Which component displays slow query graph, dependencies on this data, affected pages

5. **Index Usage Dashboard**
   - Change: Convert percentage graph to big number display; remove graph visualization
   - Current: Graph-based display
   - Must verify: Data structure, component type (Chart vs Number), percentage calculation

6. **Table Bloat Display**
   - Change: Same as Index Usage—big number percentage, remove graph
   - Current: Graph-based display
   - Must verify: Data structure, component type, bloat percentage source

7. **Historical Data Dashboard Blank Legend Bug**
   - Change: When switching to historical data view, dashboard legend goes blank; should show latest check data
   - Current: Blank legend on historical, works fine on expanded view
   - Must verify: Data fetching logic for historical, legend population trigger, timestamp handling for "latest"

### Sources Module
1. **API Call Loading State**
   - Change: Show loading/fetching indicator during API calls; block user from changing filters or navigating pages
   - Current: No blocking, rapid clicks cause multiple API calls
   - Must verify: API call trigger points, loading state management, UI overlay mechanism, filter/navigation event handlers

### Settings Module
1. **Legend Enable/Disable Configuration**
   - Change: Create admin settings page where each legend on each page (Dashboard, Servers, PG Check, Alerts, Incidents) can be toggled on/off
   - Current: No configuration exists
   - Must verify: Settings schema, admin role check, persistence (DB/localStorage), legend visibility logic across all pages

### General Improvements
1. **Remove Green Highlight Dots**
   - Change: Remove static green "active" indicator dots from PG Check, Sources, and Table Count pages
   - Current: Non-dynamic visual indicators
   - Must verify: CSS class/inline styles, component locations, usage across pages

2. **Add Tooltips**
   - Pages affected: Dashboard, Servers, PG Check, Alerts, Incidents, Thresholds
   - Change: Add tooltips explaining legend meanings and data values
   - Must verify: Tooltip library (react-tooltip, headlessui, etc.), placement logic, i18n if needed

3. **Source Module Data Consistency**
   - Change: Ensure changes made for live data are also applied to historical data paths
   - Current: Possible discrepancy between live and historical implementations
   - Must verify: Separate data fetch functions, historical data transformation logic

4. **API & DB Changes Required**
   - Change: No static hardcoded values; all legends, settings, unit labels must be dynamic from API/DB
   - Current: Unknown hardcoding locations
   - Must verify: Config tables in DB, API endpoints for settings/legends, hardcoded values in code

---

## ANALYSIS INSTRUCTIONS (For Opus)

### Step 1: File & Component Mapping with Graphify
Run graphify to generate dependency graph showing:
- All React components involved in each module (Dashboard, ServerPage, PGCheck, Sources, Settings)
- Data flow: API → State → Components
- Shared state management (Context/Redux)
- Affected pages and nested components

**Output:** ASCII dependency tree or graph file showing component relationships

### Step 2: Code Inventory Checklist
For EACH change requirement, identify:
- [ ] Which files need modification (components, hooks, API clients, types)
- [ ] Current implementation pattern (state management approach)
- [ ] Data sources (API endpoint, database table, localStorage)
- [ ] Affected child/parent components
- [ ] Potential side effects (other features that depend on modified code)

### Step 3: Task Breakdown Matrix
Create a table with columns:
| Change ID | Module | Component | File Path | Current Logic | Required Change | Dependencies | Estimated Complexity |
|-----------|--------|-----------|-----------|---|---|---|---|

### Step 4: Implementation Sequence
Order tasks by:
1. **Backend-first** (API endpoints, DB schema, settings table)
2. **State management** (Redux/Context setup for new settings)
3. **Components** (UI updates using new data)
4. **Integration** (connecting all pieces, testing filters)

List tasks in numbered order with prerequisites clearly marked.

### Step 5: Potential Issues & Questions
Identify:
- [ ] Any ambiguities in requirements
- [ ] Missing information (e.g., "total connections" calculation method?)
- [ ] Conflicting requirements
- [ ] Performance concerns (blocking on API calls, large datasets)
- [ ] Browser storage strategy for disabled legends

---

## OUTPUT FORMAT (For Opus Response)

```
# ANALYSIS COMPLETE

## 1. DEPENDENCY GRAPH
[Graphify output or ASCII tree]

## 2. FILE INVENTORY
- [ ] Component: `src/components/Dashboard/Legend.tsx`
- [ ] Component: `src/components/ServerPage/CheckFrequency.tsx`
- [ ] API: `src/api/pgcheck.ts` → endpoints: getPGCheckData(), getHistoricalData()
- [ ] DB Schema: `checks` table, `settings` table (needs creation)
- ... [full list]

## 3. TASK BREAKDOWN TABLE
[Matrix as above]

## 4. NUMBERED TASK LIST (READY FOR GEMINI)

### Backend Tasks
1. **Create Settings Schema in DB** (Priority: HIGH)
   - File: Database migration file
   - Change: Add `legend_config` table with columns: page_name, legend_name, is_enabled, admin_only, created_at
   - Affected: All pages that display legends
   - Blocks: Tasks 10, 11, 12

2. **Create Settings API Endpoint** (Priority: HIGH)
   - File: `src/api/settings.ts` (new file)
   - Change: POST /api/settings/legend → { page, legend, enabled }
   - Change: GET /api/settings/legends → returns all legend configs
   - Blocks: Task 11

3. ... [continue numbering through all tasks]

### Frontend Tasks
15. **Fix Connection Block Data Aggregation** (Priority: HIGH)
   - Files: `src/components/PGCheck/ConnectionBlock.tsx`, `src/hooks/usePGCheckData.ts`
   - Change: Calculate percentage from current_connections / max_connections
   - Change: Apply filter logic (24h, 1h) to aggregation
   - Depends on: Task 7 (API response format confirmation)
   - Complexity: Medium

... [continue]

## 5. POTENTIAL ISSUES
- **Issue A:** WAL production data format unclear—does API already include unit (GB/MB), or is it numeric?
- **Issue B:** "Inactive server count"—is this INACTIVE status or COUNT of inactive servers?
- **Issue C:** Settings persistence—should disabled legends be per-user or global (admin-set)?
- ... [list all]

## 6. CLARIFICATION QUESTIONS FOR DEVELOPER
1. What is the data structure of WAL production from the API?
2. Should legend settings be per-user or global?
3. Is the green dot indicator CSS-only or component-based?
... [questions]
```

---

## IMPORTANT NOTES FOR OPUS

- **Use Graphify:** Generate actual dependency visualization, not just text descriptions
- **Be Thorough:** Every task must have affected files, current logic explanation, and exact change needed
- **Flag Ambiguities:** Don't assume; ask clarifying questions if requirement is unclear
- **Task Ordering:** Ensure prerequisites are clear so Gemini can work sequentially
- **Complexity Estimation:** Mark each task as LOW/MEDIUM/HIGH for priority
- **No Implementation:** Analysis only. Gemini will implement based on your breakdown.

---

## WHEN DONE

create the complete file which Provide the complete task list in a format Gemini can execute without needing re-analysis.
The Gemini prompt will reference Task IDs (e.g., "Execute Task 1, Task 2, Task 5...") in order.