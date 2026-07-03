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
        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:border-blue-300"
      >
        {label}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 z-20 mt-1 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
          {servers.map(([sid, info]) => {
            const isChecked = selected.has(sid)
            return (
              <label
                key={sid}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer"
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
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-300"
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
            className="w-36 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 placeholder-slate-300 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
          <input
            type="text"
            placeholder="Table"
            value={addTable}
            onChange={(e) => setAddTable(e.target.value)}
            className="w-36 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 placeholder-slate-300 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
          <button
            onClick={handleAdd}
            disabled={createMutation.isPending || !addSchema.trim() || !addTable.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-blue-700 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
        </>
      )}
      <div ref={ref} className="relative">
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 shadow-sm transition-all hover:border-blue-300 hover:text-blue-600"
        >
          <ChevronDown className={`h-3 w-3 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
          Configured ({totalActive})
        </button>
        {dropdownOpen && (
          <div className="absolute right-0 top-full z-20 mt-1 w-80 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
            {!records || records.length === 0 ? (
              <p className="p-3 text-center text-xs text-slate-400">No records configured</p>
            ) : (
              <div className="max-h-64 overflow-y-auto">
                {records.filter((r) => r.is_active).map((r) => (
                  <div
                    key={r.id}
                    onClick={() => setSelectedConfigId(r.id === selectedConfigId ? null : r.id)}
                    className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs cursor-pointer transition-colors ${
                      r.id === selectedConfigId
                        ? 'bg-blue-50 text-blue-700'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <span className="font-medium">{r.schema_name}</span>
                      <span className="mx-1 text-slate-300">.</span>
                      <span>{r.table_name}</span>
                    </div>
                    {r.id === selectedConfigId && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedConfigId(null) }}
                        className="ml-2 rounded p-0.5 text-blue-400 hover:text-red-500 transition-colors"
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
              <div className="mt-2 border-t border-slate-100 pt-2">
                <button
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
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
    <div className="mx-auto max-w-[1600px] px-4 py-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-indigo-100 p-2 text-indigo-600">
            <Table2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900">Table Count</h1>
            <p className="text-[11px] text-slate-400">
              {totalCompared} tables | {activeServers.length} server{activeServers.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <SchemaTableManager />
          <MultiServerSelect
            servers={servers}
            selected={selectedServers}
            onChange={setSelectedServers}
          />
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-bold text-slate-600 shadow-sm transition-all hover:border-blue-300 hover:text-blue-600"
          >
            <RefreshCw className={`h-3 w-3 ${isRefetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Mismatch Summary */}
      {activeServers.length >= 2 && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <div>
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Servers</span>
              <p className="text-sm font-black text-slate-900">
                {activeServers.length} ({activeServers.map(([, info]) => info.label).join(', ')})
              </p>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div>
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Tables</span>
              <p className="text-sm font-black text-slate-900">
                {totalCompared.toLocaleString()}
              </p>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div>
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Mismatches</span>
              <p className={`text-sm font-black ${mismatchCount > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {mismatchCount > 0 ? mismatchCount.toLocaleString() : '0'}
              </p>
              {mismatchCount > 0 && (
                <p className="text-[10px] text-red-500">Differences detected</p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="mb-4 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
        <input
          type="text"
          placeholder="Search tables..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-700 placeholder-slate-400 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-[11px]">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                Tables
              </th>
              {activeServers.map(([sid, info]) => (
                <th key={sid} className="px-3 py-2.5 text-center">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    {info.label}
                  </div>
                  <div className="text-[8px] text-slate-300">
                    {formatTime(info.collectedAt)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {selectedServers.size === 0 ? (
              <tr>
                <td colSpan={activeServers.length + 1 || 1} className="px-3 py-12 text-center text-xs text-slate-400">
                  Select servers to view table count data
                </td>
              </tr>
            ) : isLoading ? (
              <tr>
                <td colSpan={activeServers.length + 1 || 1} className="px-3 py-12 text-center">
                  <LoadingSpinner />
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={activeServers.length + 1 || 1} className="px-3 py-8 text-center">
                  <ErrorBanner error={error} />
                  <button
                    onClick={() => refetch()}
                    className="mt-2 rounded-lg bg-red-50 px-3 py-1.5 text-[10px] font-bold text-red-600 hover:bg-red-100 transition-colors"
                  >
                    Retry
                  </button>
                </td>
              </tr>
            ) : sortedRows.length === 0 ? (
              <tr>
                <td colSpan={activeServers.length + 1} className="px-3 py-8 text-center text-xs text-slate-400">
                  {search ? 'No tables match your search' : 'No table count data available'}
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
                    className={`transition-colors ${
                      isMismatch
                        ? 'bg-red-50/40 hover:bg-red-50/70'
                        : isNotFoundRow
                          ? 'bg-amber-50/40 hover:bg-amber-50/70'
                          : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="sticky left-0 z-10 bg-[inherit] px-3 py-2 font-semibold text-slate-800">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs">{row.displayName}</span>
                        {isMismatch && (
                          <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[8px] font-bold uppercase text-red-700 leading-none">
                            Mismatch
                          </span>
                        )}
                        {isNotFoundRow && (
                          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[8px] font-bold uppercase text-amber-700 leading-none">
                            Not Found
                          </span>
                        )}
                      </div>
                    </td>
                    {activeServers.map(([sid, info]) => {
                      const cell = row.servers[sid]
                      if (!cell) {
                        return (
                          <td key={sid} className="px-3 py-2 text-center text-slate-300">
                            <span className="text-[9px] font-medium text-amber-500">Not Found</span>
                          </td>
                        )
                      }
                      const isSuccess = cell.status === 'SUCCESS'
                      return (
                        <td key={sid} className="px-3 py-2 text-center">
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
                            className="group inline-block rounded-lg px-2 py-1 transition-all hover:bg-slate-100 active:scale-95"
                          >
                            <div className="font-bold tabular-nums text-slate-700 group-hover:text-indigo-600 text-xs">
                              {cell.record_count !== null && cell.record_count !== undefined
                                ? Number(cell.record_count).toLocaleString()
                                : '\u2014'}
                            </div>
                            <span className={`mt-0.5 inline-block rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase leading-none ${
                              isSuccess ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
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

      <div className="mt-3 flex items-center gap-3 text-[9px] text-slate-400">
        <span>Tables: <strong className="text-slate-600">{totalCompared.toLocaleString()}</strong></span>
        <span>Servers: <strong className="text-slate-600">{activeServers.length}</strong></span>
        {mismatchCount > 0 && (
          <span>Mismatch: <strong className="text-red-600">{mismatchCount.toLocaleString()}</strong></span>
        )}
      </div>

      {/* Slide Drawer */}
      {drawer && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
            onClick={() => setDrawer(null)}
          />
          <div className="fixed right-0 top-0 z-50 h-full w-full max-w-md bg-white shadow-2xl border-l border-slate-200 overflow-y-auto transition-transform">
            <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-black text-slate-900">{drawer.displayName}</h2>
                <p className="text-[11px] text-slate-400">{drawer.serverLabel}</p>
              </div>
              <button
                onClick={() => setDrawer(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-4 py-3">
              <div className="mb-4 grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Current Count</div>
                  <div className="mt-0.5 text-lg font-black text-slate-900">
                    {drawer.recordCount !== null ? Number(drawer.recordCount).toLocaleString() : '\u2014'}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">History Points</div>
                  <div className="mt-0.5 text-lg font-black text-slate-900">{history.length}</div>
                </div>
              </div>

              {historyQuery.isLoading ? (
                <div className="flex justify-center py-8">
                  <LoadingSpinner />
                </div>
              ) : history.length === 0 ? (
                <p className="py-8 text-center text-xs text-slate-400">No historical data available</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-left text-[11px]">
                    <thead className="border-b border-slate-200 bg-slate-50 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      <tr>
                        <th className="px-3 py-2">Collected At</th>
                        <th className="px-3 py-2 text-right">Count</th>
                        <th className="px-3 py-2 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {history.map((h, i) => (
                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                          <td className="px-3 py-1.5 font-mono text-slate-700 text-[10px]">
                            {formatTime(h.collected_at)}
                          </td>
                          <td className="px-3 py-1.5 text-right font-bold tabular-nums text-slate-700 text-[10px]">
                            {h.record_count !== null ? Number(h.record_count).toLocaleString() : '\u2014'}
                          </td>
                          <td className="px-3 py-1.5 text-center">
                            <span className={`inline-block rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase leading-none ${
                              h.status === 'SUCCESS'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-red-100 text-red-700'
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
