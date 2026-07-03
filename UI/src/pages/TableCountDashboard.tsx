import { useMemo, useState, useRef, useEffect } from 'react'
import { useTableCountData, useTableCountHistory } from '../api/monitoring'
import { useServers } from '../api/servers'
import { useSchemaTables, useCreateSchemaTable, useDeleteSchemaTable } from '../api/schemaTables'
import { LoadingSpinner } from '../components/shared/LoadingSpinner'
import { ErrorBanner } from '../components/shared/ErrorBanner'
import { useAuthStore } from '../store/authStore'
import { Table2, RefreshCw, Search, X, ChevronDown, Plus, Trash2 } from 'lucide-react'
import { formatInTZ } from '../utils/timezone'

interface TableCell {
  record_count: number | null
  status: string
}

interface TableRow {
  displayName: string
  rawName: string
  servers: Record<number, TableCell>
}

interface DrawerState {
  open: boolean
  serverId: number
  serverLabel: string
  tableName: string
  displayName: string
  recordCount: number | null
}

function formatTime(ts: string | null | undefined): string {
  return formatInTZ(ts, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function MultiServerSelect({
  servers,
  selected,
  onChange,
}: {
  servers: readonly (readonly [number, { label: string; collectedAt: string | null }])[]
  selected: Set<number>
  onChange: (ids: Set<number>) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const label =
    selected.size === servers.length
      ? 'All servers'
      : selected.size === 0
        ? 'Select servers...'
        : `${selected.size} server${selected.size > 1 ? 's' : ''} selected`

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-xl border border-border/50 bg-muted/50 px-4 py-2.5 text-xs font-semibold text-foreground transition-all duration-200 hover:border-primary/50 hover:shadow-glow-sm"
      >
        {label}
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 z-20 mt-1.5 w-64 rounded-2xl border border-border/50 bg-card/95 backdrop-blur-xl p-2 shadow-xl">
          {servers.map(([sid, info]) => {
            const isChecked = selected.has(sid)
            return (
              <label
                key={sid}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs text-foreground transition-colors duration-200 hover:bg-muted/50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => {
                    const next = new Set(selected)
                    if (isChecked) next.delete(sid)
                    else next.add(sid)
                    onChange(next)
                  }}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary/30"
                />
                <span className="font-medium">{info.label}</span>
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}

function SchemaTableManager() {
  const { data: records } = useSchemaTables()
  const createMutation = useCreateSchemaTable()
  const deleteMutation = useDeleteSchemaTable()
  const role = useAuthStore((s) => s.role)
  const isAdmin = role === 'admin'

  const [addSchema, setAddSchema] = useState('')
  const [addTable, setAddTable] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [selectedConfigId, setSelectedConfigId] = useState<number | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleAdd = async () => {
    if (!addSchema.trim() || !addTable.trim()) return
    try {
      await createMutation.mutateAsync({ schema_name: addSchema.trim(), table_name: addTable.trim() })
      setAddSchema('')
      setAddTable('')
    } catch {}
  }

  const handleDelete = async () => {
    if (selectedConfigId === null) return
    try {
      await deleteMutation.mutateAsync(selectedConfigId)
      setSelectedConfigId(null)
    } catch {}
  }

  const totalActive = records?.filter((r) => r.is_active).length ?? 0
  const selectedRecord = selectedConfigId !== null
    ? records?.find((r) => r.id === selectedConfigId)
    : null

  return (
    <div className="flex items-center gap-3">
      {isAdmin && (
        <>
          <input
            type="text"
            placeholder="Schema"
            value={addSchema}
            onChange={(e) => setAddSchema(e.target.value)}
            className="w-36 h-10 px-3 rounded-xl bg-muted/50 border border-border text-foreground text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:border-transparent focus:outline-none transition-all duration-200"
          />
          <input
            type="text"
            placeholder="Table"
            value={addTable}
            onChange={(e) => setAddTable(e.target.value)}
            className="w-36 h-10 px-3 rounded-xl bg-muted/50 border border-border text-foreground text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:border-transparent focus:outline-none transition-all duration-200"
          />
          <button
            onClick={handleAdd}
            disabled={createMutation.isPending || !addSchema.trim() || !addTable.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shadow-glow-sm hover:shadow-glow-md transition-all duration-300 disabled:opacity-50 disabled:shadow-none"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
        </>
      )}
      <div ref={ref} className="relative">
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-1.5 rounded-xl border border-border/50 bg-muted/50 px-3 py-2.5 text-xs font-semibold text-muted-foreground transition-all duration-200 hover:border-primary/50 hover:text-primary"
        >
          <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
          Configured ({totalActive})
        </button>
        {dropdownOpen && (
          <div className="absolute right-0 top-full z-20 mt-1.5 w-80 rounded-2xl border border-border/50 bg-card/95 backdrop-blur-xl p-2 shadow-xl">
            {!records || records.length === 0 ? (
              <p className="p-4 text-center text-sm text-muted-foreground">No records configured</p>
            ) : (
              <div className="max-h-64 overflow-y-auto">
                {records.filter((r) => r.is_active).map((r) => (
                  <div
                    key={r.id}
                    onClick={() => setSelectedConfigId(r.id === selectedConfigId ? null : r.id)}
                    className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-xs cursor-pointer transition-all duration-200 ${
                      r.id === selectedConfigId
                        ? 'bg-primary/10 text-primary ring-1 ring-primary/20'
                        : 'hover:bg-muted/50'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <span className="font-medium text-foreground">{r.schema_name}</span>
                      <span className="mx-1 text-muted-foreground/50">.</span>
                      <span className="text-foreground">{r.table_name}</span>
                    </div>
                    {r.id === selectedConfigId && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedConfigId(null) }}
                        className="ml-2 rounded-lg p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-200"
                        title="Deselect"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {selectedConfigId !== null && isAdmin && (
              <div className="mt-2 border-t border-border/50 pt-2">
                <button
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-destructive/10 px-3 py-2.5 text-xs font-semibold text-destructive transition-all duration-200 hover:bg-destructive/20 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete {selectedRecord ? `${selectedRecord.schema_name}.${selectedRecord.table_name}` : ''}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function TableCountDashboard() {
  const [selectedServers, setSelectedServers] = useState<Set<number>>(new Set())
  const selectedServerArray = useMemo(() => Array.from(selectedServers), [selectedServers])
  const { data: serverData } = useServers()
  const { data, isLoading, error, refetch, isRefetching } = useTableCountData(selectedServerArray)
  const { data: configRecords } = useSchemaTables()
  const [search, setSearch] = useState('')
  const [drawer, setDrawer] = useState<DrawerState | null>(null)

  const historyQuery = useTableCountHistory(
    drawer?.serverId ?? 0,
    drawer?.tableName ?? '',
    drawer?.open ?? false,
  )

  const { servers, tableRows } = useMemo(() => {
    const rawData = data?.data ?? []
    const collectedAtMap: Record<number, string | null> = {}
    const tableMap: Record<string, TableRow> = {}

    rawData.forEach((item: any) => {
      const sid = item.server_id
      collectedAtMap[sid] = item.collected_at || item.started_at || null

      const tables = Array.isArray(item.result_metadata) ? item.result_metadata : []
      tables.forEach((t: any) => {
        const rawName: string = t.table_name || 'unknown'
        if (!tableMap[rawName]) {
          tableMap[rawName] = {
            displayName: rawName,
            rawName,
            servers: {},
          }
        }
        tableMap[rawName].servers[sid] = {
          record_count: t.record_count ?? null,
          status: t.status || 'UNKNOWN',
        }
      })
    })

    // Merge in configured tables that have no monitoring data yet
    if (configRecords) {
      const activeConfigs = configRecords.filter((r) => r.is_active)
      for (const cfg of activeConfigs) {
        const rawName = `${cfg.schema_name}.${cfg.table_name}`
        if (!tableMap[rawName]) {
          tableMap[rawName] = {
            displayName: rawName,
            rawName,
            servers: {},
          }
        }
      }
    }

    const serverList = (serverData?.data ?? [])
      .map(s => [s.server_id, { label: s.server_label, collectedAt: collectedAtMap[s.server_id] ?? null }] as const)
      .sort(([, a], [, b]) => a.label.localeCompare(b.label))

    return { servers: serverList, tableRows: Object.values(tableMap) }
  }, [data, configRecords, serverData])

  const activeServers = useMemo(() => {
    return servers.filter(([sid]) => selectedServers.has(sid))
  }, [servers, selectedServers])

  const { sortedRows } = useMemo(() => {
    if (selectedServers.size === 0) {
      return { sortedRows: [] }
    }

    let filtered = tableRows
    if (search.trim()) {
      const q = search.toLowerCase()
      filtered = tableRows.filter((r) => r.displayName.toLowerCase().includes(q))
    }

    const mismatch: TableRow[] = []
    const match: TableRow[] = []
    const notFound: TableRow[] = []

    for (const row of filtered) {
      const presentCounts: number[] = []
      let hasMissing = false
      for (const sid of selectedServers) {
        const cell = row.servers[sid]
        if (!cell) {
          hasMissing = true
        } else if (cell.record_count !== null && cell.record_count !== undefined) {
          presentCounts.push(cell.record_count)
        }
      }

      if (hasMissing) {
        notFound.push(row)
      } else if (presentCounts.length <= 1) {
        match.push(row)
      } else {
        const allSame = presentCounts.every((c) => c === presentCounts[0])
        if (allSame) {
          match.push(row)
        } else {
          mismatch.push(row)
        }
      }
    }

    mismatch.sort((a, b) => a.displayName.localeCompare(b.displayName))
    match.sort((a, b) => a.displayName.localeCompare(b.displayName))
    notFound.sort((a, b) => a.displayName.localeCompare(b.displayName))

    return {
      sortedRows: [...mismatch, ...match, ...notFound],
    }
    }, [tableRows, search, selectedServers])

  const { mismatchCount, totalCompared } = useMemo(() => {
    const activeCells = selectedServers

    let mCount = 0
    let tCount = 0

    for (const row of tableRows) {
      const presentCounts: number[] = []
      let hasMissing = false
      for (const sid of activeCells) {
        const cell = row.servers[sid]
        if (!cell) { hasMissing = true; break }
        if (cell.record_count !== null && cell.record_count !== undefined) {
          presentCounts.push(cell.record_count)
        }
      }
      if (hasMissing) continue
      if (presentCounts.length <= 1) continue
      tCount++
      if (!presentCounts.every((c) => c === presentCounts[0])) {
        mCount++
      }
    }

    return { mismatchCount: mCount, totalCompared: tCount }
  }, [tableRows, selectedServers])

  const history = historyQuery.data ?? []

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      {/* ── Page Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Table2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Table Count</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {totalCompared} tables | {activeServers.length} server{activeServers.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <SchemaTableManager />
          <MultiServerSelect
            servers={servers}
            selected={selectedServers}
            onChange={setSelectedServers}
          />
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-muted text-foreground font-medium text-sm hover:bg-muted/80 transition-all duration-200 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefetching ? 'animate-spin text-primary' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Mismatch Summary ── */}
      {activeServers.length >= 2 && (
        <div className="glass-card p-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <div>
              <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Servers</span>
              <p className="text-sm font-bold text-foreground">
                {activeServers.length} ({activeServers.map(([, info]) => info.label).join(', ')})
              </p>
            </div>
            <div className="h-8 w-px bg-border/50" />
            <div>
              <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Tables</span>
              <p className="text-sm font-bold text-foreground tabular-nums">
                {totalCompared.toLocaleString()}
              </p>
            </div>
            <div className="h-8 w-px bg-border/50" />
            <div>
              <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Mismatches</span>
              <p className={`text-sm font-bold tabular-nums ${mismatchCount > 0 ? 'text-destructive' : 'text-success'}`}>
                {mismatchCount > 0 ? mismatchCount.toLocaleString() : '0'}
              </p>
              {mismatchCount > 0 && (
                <p className="text-[10px] text-destructive">Differences detected</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Search Bar ── */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search tables..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-10 pl-10 pr-3 rounded-xl bg-muted/50 border border-border text-foreground text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:border-transparent focus:outline-none transition-all duration-200"
        />
      </div>

      {/* ── Data Table ── */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border/50 bg-muted/50">
                <th className="sticky left-0 z-10 bg-muted/50 px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Tables
                </th>
                {activeServers.map(([sid, info]) => (
                  <th key={sid} className="px-4 py-3 text-center">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {info.label}
                    </div>
                    <div className="text-[9px] text-muted-foreground/60 mt-0.5">
                      {formatTime(info.collectedAt)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {selectedServers.size === 0 ? (
                <tr>
                  <td colSpan={activeServers.length + 1 || 1} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Table2 className="w-10 h-10 text-muted-foreground/30" />
                      <p className="text-sm text-muted-foreground">Select servers to view table count data</p>
                    </div>
                  </td>
                </tr>
              ) : isLoading ? (
                <tr>
                  <td colSpan={activeServers.length + 1 || 1} className="px-4 py-16 text-center">
                    <LoadingSpinner />
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={activeServers.length + 1 || 1} className="px-4 py-10 text-center">
                    <ErrorBanner error={error} />
                    <button
                      onClick={() => refetch()}
                      className="mt-3 px-4 py-2 rounded-xl bg-destructive/10 text-xs font-semibold text-destructive hover:bg-destructive/20 transition-all duration-200"
                    >
                      Retry
                    </button>
                  </td>
                </tr>
              ) : sortedRows.length === 0 ? (
                <tr>
                  <td colSpan={activeServers.length + 1} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Search className="w-8 h-8 text-muted-foreground/30" />
                      <p className="text-sm text-muted-foreground">
                        {search ? 'No tables match your search' : 'No table count data available'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                sortedRows.map((row) => {
                  const presentCounts: number[] = []
                  let hasMissing = false
                  for (const sid of selectedServers) {
                    const cell = row.servers[sid]
                    if (!cell) { hasMissing = true; break }
                    if (cell.record_count !== null && cell.record_count !== undefined) {
                      presentCounts.push(cell.record_count)
                    }
                  }
                  const isMismatch = !hasMissing && presentCounts.length > 1 && !presentCounts.every((c) => c === presentCounts[0])
                  const isNotFoundRow = hasMissing

                  return (
                    <tr
                      key={row.rawName}
                      className={`transition-colors duration-200 ${
                        isMismatch
                          ? 'bg-destructive/5 hover:bg-destructive/10'
                          : isNotFoundRow
                            ? 'bg-warning/5 hover:bg-warning/10'
                            : 'hover:bg-muted/30'
                      }`}
                    >
                      <td className="sticky left-0 z-10 bg-[inherit] px-4 py-2.5 font-semibold text-foreground">
                        <div className="flex items-center gap-2">
                          <span className="text-xs">{row.displayName}</span>
                          {isMismatch && (
                            <span className="px-2 py-0.5 rounded-full bg-destructive/10 text-[8px] font-semibold uppercase text-destructive border border-destructive/20">
                              Mismatch
                            </span>
                          )}
                          {isNotFoundRow && (
                            <span className="px-2 py-0.5 rounded-full bg-warning/10 text-[8px] font-semibold uppercase text-warning border border-warning/20">
                              Not Found
                            </span>
                          )}
                        </div>
                      </td>
                      {activeServers.map(([sid, info]) => {
                        const cell = row.servers[sid]
                        if (!cell) {
                          return (
                            <td key={sid} className="px-4 py-2.5 text-center">
                              <span className="text-[10px] font-medium text-warning">Not Found</span>
                            </td>
                          )
                        }
                        const isSuccess = cell.status === 'SUCCESS'
                        return (
                          <td key={sid} className="px-4 py-2.5 text-center">
                            <button
                              onClick={() =>
                                setDrawer({
                                  open: true,
                                  serverId: sid,
                                  serverLabel: info.label,
                                  tableName: row.rawName,
                                  displayName: row.displayName,
                                  recordCount: cell.record_count,
                                })
                              }
                              className="group inline-block rounded-xl px-3 py-1.5 transition-all duration-200 hover:bg-muted/50 active:scale-95"
                            >
                              <div className="font-bold tabular-nums text-foreground group-hover:text-primary text-sm transition-colors duration-200">
                                {cell.record_count !== null && cell.record_count !== undefined
                                  ? Number(cell.record_count).toLocaleString()
                                  : '\u2014'}
                              </div>
                              <span className={`mt-0.5 inline-block px-2 py-0.5 rounded-full text-[8px] font-semibold uppercase leading-none ${
                                isSuccess ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                              }`}>
                                {cell.status}
                              </span>
                            </button>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Footer Stats ── */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span>Tables: <strong className="text-foreground tabular-nums">{totalCompared.toLocaleString()}</strong></span>
        <span>Servers: <strong className="text-foreground tabular-nums">{activeServers.length}</strong></span>
        {mismatchCount > 0 && (
          <span>Mismatch: <strong className="text-destructive tabular-nums">{mismatchCount.toLocaleString()}</strong></span>
        )}
      </div>

      {/* ── Slide Drawer ── */}
      {drawer && (
        <>
          <div
            className="fixed inset-0 z-40 bg-background/40 backdrop-blur-sm"
            onClick={() => setDrawer(null)}
          />
          <div className="fixed right-0 top-0 z-50 h-full w-full max-w-md bg-card/95 backdrop-blur-xl shadow-2xl border-l border-border/50 overflow-y-auto transition-transform">
            {/* Drawer Header */}
            <div className="sticky top-0 z-10 border-b border-border/50 bg-card/80 backdrop-blur-xl px-5 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-foreground">{drawer.displayName}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{drawer.serverLabel}</p>
              </div>
              <button
                onClick={() => setDrawer(null)}
                className="rounded-xl p-2 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-all duration-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="px-5 py-5">
              {/* Stat Cards */}
              <div className="mb-5 grid grid-cols-2 gap-3">
                <div className="glass-card p-4">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Current Count</div>
                  <div className="mt-1 text-2xl font-bold text-foreground tabular-nums">
                    {drawer.recordCount !== null ? Number(drawer.recordCount).toLocaleString() : '\u2014'}
                  </div>
                </div>
                <div className="glass-card p-4">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">History Points</div>
                  <div className="mt-1 text-2xl font-bold text-foreground tabular-nums">{history.length}</div>
                </div>
              </div>

              {/* History Table */}
              {historyQuery.isLoading ? (
                <div className="flex justify-center py-12">
                  <LoadingSpinner />
                </div>
              ) : history.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">No historical data available</p>
              ) : (
                <div className="glass-card overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-border/50 bg-muted/50">
                      <tr>
                        <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Collected At</th>
                        <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Count</th>
                        <th className="px-4 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {history.map((h, i) => (
                        <tr key={i} className="hover:bg-muted/30 transition-colors duration-200">
                          <td className="px-4 py-2 font-mono text-foreground text-[11px]">
                            {formatTime(h.collected_at)}
                          </td>
                          <td className="px-4 py-2 text-right font-bold tabular-nums text-foreground text-[11px]">
                            {h.record_count !== null ? Number(h.record_count).toLocaleString() : '\u2014'}
                          </td>
                          <td className="px-4 py-2 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold ${
                              h.status === 'SUCCESS'
                                ? 'bg-success/10 text-success'
                                : 'bg-destructive/10 text-destructive'
                            }`}>
                              {h.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
