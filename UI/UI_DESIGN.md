# PG Health Monitoring UI — High-Level Design

## Purpose

The PG Health Monitoring UI is a React 18 + TypeScript single-page application that provides a dashboard-driven interface for managing PostgreSQL server health. It consumes the backend API to display server status, health check results, alerts, incidents, and audit logs, with admin capabilities for configuration management.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                       App Shell                              │
│  ┌──────────┐  ┌────────────────────────────────────────┐   │
│  │          │  │              TopBar                     │   │
│  │          │  │  [Role badge]              [Logout]     │   │
│  │          │  ├────────────────────────────────────────┤   │
│  │ Sidebar  │  │         <SessionBanner />                │   │
│  │          │  ├────────────────────────────────────────┤   │
│  │  Dashboard│  │                                         │   │
│  │  Servers  │  │            <Outlet />                    │   │
│  │  Checks   │  │          (Page Content)                  │   │
│  │  Alerts   │  │                                         │   │
│  │  Incidents│  │                                         │   │
│  │  Audit    │  │                                         │   │
│  │  Settings │  │                                         │   │
│  │          │  │                                         │   │
│  │ [Logout] │  │                                         │   │
│  └──────────┘  └────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| **Framework** | React 18 | Mature ecosystem, concurrent features |
| **Language** | TypeScript | Type safety across API boundaries |
| **Build** | Vite | Fast HMR, native ESM, optimized builds |
| **Routing** | React Router v6 | Nested routes, layout routes, lazy loading |
| **Data Fetching** | TanStack Query v5 | Caching, dedup, background refetch, pagination |
| **State** | Zustand | Lightweight, no boilerplate, localStorage persistence |
| **HTTP** | Axios | Interceptors for JWT injection + 401 handling |
| **Styling** | Tailwind CSS v3 | Utility-first, consistent design tokens |
| **Components** | shadcn/ui (Radix) | Accessible, unstyled primitives with Tailwind |
| **Charts** | Recharts | Composable, responsive, React-native charting |
| **Testing** | Vitest + RTL + jest-axe | Fast, native TypeScript, a11y assertions |

---

## Data Flow

```
┌──────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────┐
│          │    │              │    │              │    │          │
│  React   │───►│  TanStack    │───►│  Axios       │───►│  API     │
│  Pages   │    │  Query Hooks │    │  Client      │    │  Backend │
│          │◄───│  (src/api/)  │◄───│  + Intercept │◄───│          │
└──────────┘    └──────────────┘    └──────────────┘    └──────────┘
     │                                    │
     │                              ┌─────┴──────┐
     │                              │  authStore  │
     │                              │  (Zustand)  │
     │                              │  localStorage│
     │                              └────────────┘
     ▼
┌──────────┐
│ Zustand  │
│ Auth     │
│ Store    │
└──────────┘
```

### Request Flow

1. **Page renders** → calls a TanStack Query hook (e.g., `useServers`)
2. **Query hook** makes GET request via `apiClient` (Axios instance)
3. **Request interceptor** injects `Authorization: Bearer <token>` from `authStore`
4. **Response interceptor** checks for 401 → clears token + redirects to `/login`; checks 403 → sets `permissionDenied` flag; reads `X-Token-Expires-In` header → updates `authStore.expiresAt`
5. **TanStack Query** caches the response, deduplicates concurrent requests, and stale-refetches after 30s
6. **Page re-renders** with `{ data, isLoading, error }` state

---

## Component Tree

```
<App>
  <QueryClientProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="servers" element={<Servers />} />
            <Route path="checks" element={<Checks />} />
            <Route path="thresholds" element={<Thresholds />} />
            <Route path="alerts" element={<Alerts />} />
            <Route path="incidents" element={<Incidents />} />
            <Route path="incidents/:id" element={<IncidentDetail />} />
            <Route path="monitoring" element={<Monitoring />} />
            <Route path="monitoring-dashboard" element={<MonitoringDashboard />} />
            <Route path="table-count" element={<TableCountDashboard />} />
            <Route path="audit" element={<AuditLog />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  </QueryClientProvider>
</App>
```

### Page Directory

| Page | Route | Auth | Description |
|------|-------|------|-------------|
| `Login` | `/login` | None | Username/password form; redirects on auth |
| `Dashboard` | `/` | Required | Server health cards, failing checks, metrics chart |
| `Servers` | `/servers` | Required | Server CRUD table with inline forms |
| `Checks` | `/checks` | Required | Check definition + mapping management |
| `Thresholds` | `/thresholds` | Required | Per-check threshold configuration |
| `Monitoring` | `/monitoring` | Required | Check run history log |
| `MonitoringDashboard` | `/monitoring-dashboard` | Required | Live monitoring overview |
| `TableCountDashboard` | `/table-count` | Required | Table row count trends |
| `Alerts` | `/alerts` | Required | Alert list with acknowledge action |
| `Incidents` | `/incidents` | Required | Open/resolved incident list |
| `IncidentDetail` | `/incidents/:id` | Required | Single incident + root cause editor |
| `AuditLog` | `/audit` | Admin | Filterable audit trail table |
| `Settings` | `/settings` | Admin | User preferences |

---

## State Management

### Zustand Auth Store (`authStore.ts`)

```
AuthState {
  token: string | null         ← persisted to localStorage
  role: 'admin' | 'viewer' | null
  expiresAt: number | null
  permissionDenied: boolean
  setToken(token, role, expiresInSeconds)
  setTokenExpiresIn(expiresInSeconds)  ← from X-Token-Expires-In header
  clearToken()
  setPermissionDenied(denied)
  isAuthenticated()            → boolean
  isTokenExpiringSoon()        → boolean (< 60s remaining)
}
```

### TanStack Query Cache

- `staleTime: 30_000` — data refetched after 30s
- `retry: 1` — single retry on failure
- Mutations auto-invalidate related queries on success via `onSuccess` callbacks

---

## API Hook Modules (`src/api/`)

| Module | Hooks |
|--------|-------|
| `servers.ts` | `useServers`, `useServer`, `useCreateServer`, `useUpdateServer`, `useDeactivateServer`, `useDeleteServer` |
| `checks.ts` | `useChecks`, `useCheck`, `useCreateCheck`, `useUpdateCheck`, `useDeleteCheck`, `useMappings`, `useCreateMapping`, `useUpdateMapping`, `useDeleteMapping`, `useCheckHealth` |
| `thresholds.ts` | `useThresholds`, `useThreshold`, `useCreateThreshold`, `useUpdateThreshold`, `useDeleteThreshold` |
| `monitoring.ts` | `useCheckRuns`, `useMonitoringLogs`, `useMetrics`, `useMetricsAggregate` |
| `alerts.ts` | `useAlerts`, `useAcknowledgeAlert` |
| `incidents.ts` | `useIncidents`, `useIncident`, `usePatchIncidentRootCause` |
| `dashboard.ts` | `useDashboardSummary`, `useServerHealth`, `useMetricsChart` |
| `audit.ts` | `useAuditLogs` |

---

## Key UI Patterns

### Shared Components (`src/components/shared/`)

| Component | Purpose |
|-----------|---------|
| `EmptyState` | Icon + title + description + optional CTA for zero-data states |
| `LoadingSpinner` | Accessible spinner with ARIA live region |
| `ErrorBanner` | Dismissible error banner with status code, message, request ID |
| `TimestampCell` | UTC→local conversion with UTC tooltip on hover |

### Error Handling Pattern

Every page follows a consistent rendering pattern:

```tsx
if (isLoading) return <LoadingSpinner />
if (isError) return <ErrorBanner error={error} />
if (!data?.length) return <EmptyState title="..." description="..." />
return <DataTable data={data} />
```

### Accessibility

- All pages have automated a11y tests using `jest-axe` (`tests/unit/a11y/`)
- WCAG 2.1 AA compliance target
- `LoadingSpinner` uses `aria-live="polite"`, `role="status"`
- `EmptyState` is keyboard navigable
- shadcn/ui components provide ARIA attributes out of the box

---

## Testing Strategy

| Suite | Tool | What It Covers |
|-------|------|----------------|
| Unit | Vitest + RTL | Component rendering + behavior, utility functions (timezone, duration), hook logic |
| Accessibility | jest-axe | WCAG 2.1 AA compliance per page |
| Property | Vitest + fast-check | Dashboard filter invariants, summary panel invariants |

Key tests: `TimestampCell.test.tsx`, `duration.test.ts`, `timezone.test.ts`, `EmptyState.test.tsx`, `Dashboard.a11y.test.tsx`, `Servers.a11y.test.tsx`, `useDashboardFilters.property.test.ts`, `useAutoRefresh.test.ts`

---

## Security

| Concern | Implementation |
|---------|---------------|
| **JWT Storage** | `localStorage` via Zustand (token, role, expiry) |
| **Auto-Logout** | 401 interceptor clears token + redirects to `/login` |
| **Session Warning** | `SessionBanner` shows when `isTokenExpiringSoon()` (< 60s) |
| **Route Protection** | `ProtectedRoute` wraps all authenticated routes; redirects to `/login` if not authenticated |
| **Role Gating** | `requiredRole="admin"` on Audit and Settings routes |
| **Permission Denied UI** | `permissionDenied` flag drives a toast/banner on 403 responses |

---

## Build & Deploy

- **Dev:** `npm run dev` → Vite dev server on `:5173` with HMR
- **Prod:** `npm run build` → optimized output to `dist/`
- **Env Config:** `VITE_API_URL` via `.env.local` / `.env.production`
- **Preview:** `npm run preview` → serves `dist/` locally
