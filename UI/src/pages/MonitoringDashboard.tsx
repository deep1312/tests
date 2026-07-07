import { useState, useMemo, useEffect } from 'react'
import { useSpeedMonitoringSources, useSpeedMonitoringSourceDetails, useMultiServerSpeedSourceDetails } from '../api/monitoringSources'
import type { MonitoringSource } from '../api/monitoringSources'
import { useServers } from '../api/servers'
import { Button } from '../components/ui/button'

import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/table'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../components/ui/sheet'
import { MultiSelect } from '../components/ui/multi-select'
import { LoadingSpinner } from '../components/shared/LoadingSpinner'
import { ErrorBanner } from '../components/shared/ErrorBanner'
import { Activity, Clock, RefreshCw, ChevronRight, Server, Layers } from 'lucide-react'

const SOURCE_ORDER = [
  'Congestion',
  'Spatel',
  'Navteq',
  'Inrix',
  'Timed',
  'LinkCalc Data',
  'Timed Pull',
  'Timed Reader Condition',
  'Timed TMDD',
  'WAZE_EVENT Condition',
  'Pull Push Log',
  'Reader Status Code Update Log',
  'Weather Station Data',
  'Wind Speed Data',
  'Weather Sensor Data',
  'Weather Radar Image Data',
  'Timed Native SegmentRealtime',
  'Timed Native SegmentRealtimeConditions',
  'Timed Native SegmentRealtimeDetails',
  'iCone Data',
  'AVL Data',
]

const STATUS_BG_COLORS = [
  'bg-emerald-500/10 text-emerald-500',
  'bg-amber-500/10 text-amber-500',
  'bg-destructive/10 text-destructive',
  'bg-blue-500/10 text-blue-500',
  'bg-purple-500/10 text-purple-500',
  'bg-orange-500/10 text-orange-500',
  'bg-teal-500/10 text-teal-500',
  'bg-pink-500/10 text-pink-500',
]

function getStatusBadgeClass(status: string): string {
  let hash = 0
  for (let i = 0; i < status.length; i++) {
    hash = status.charCodeAt(i) + ((hash << 5) - hash)
  }
  return STATUS_BG_COLORS[Math.abs(hash) % STATUS_BG_COLORS.length]
}

function formatTime(ts: string | null): string {
  if (!ts) return '\u2014'
  const d = new Date(ts)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function formatShortDate(ts: string | null): string {
  if (!ts) return '\u2014'
  const d = new Date(ts)
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

interface SourceCell {
  source: MonitoringSource | null
}

interface ComparisonRow {
  di_name: string
  servers: Record<number, SourceCell>
  category: 'mismatch' | 'match' | 'notFound'
}

function SourceCard({
  source,
  isSelected,
  onClick,
}: {
  source: MonitoringSource
  isSelected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-2xl border transition-all duration-200 ${
        isSelected
          ? 'border-primary bg-primary/5 ring-1 ring-primary/20 shadow-glow-sm'
          : 'glass-card-hover'
      }`}
    >
      <div className="p-3">
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className={`h-2 w-2 rounded-full shrink-0 ${getStatusBadgeClass(source.status).split(' ')[0]}`} />
            <span className="font-semibold text-xs text-foreground truncate">{source.di_name}</span>
          </div>
          <ChevronRight className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${isSelected ? 'text-primary rotate-90' : 'text-muted-foreground/40'}`} />
        </div>
        <div className="mt-1.5 flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1">
            <Clock className="w-2.5 h-2.5" />
            {source.frequency}
          </span>
          {source.latest_pulltimestamp && (
            <span className="text-muted-foreground/60">| {formatTime(source.latest_pulltimestamp)}</span>
          )}
          <span className="text-muted-foreground/40 truncate ml-auto">{source.server_label}</span>
        </div>
        <div className="mt-1.5 flex items-center gap-1.5">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold ${getStatusBadgeClass(source.status)}`}>
            {source.status}
          </span>
        </div>
      </div>
    </button>
  )
}

export function MonitoringDashboard() {
  const [selectedDiName, setSelectedDiName] = useState<string | null>(null)
  const [selectedServerForDetail, setSelectedServerForDetail] = useState<number>(0)
  const [activeStatus, setActiveStatus] = useState<string | null>(null)
  const [selectedServers, setSelectedServers] = useState<Set<number>>(new Set())
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set())
  const [selectedEnvs, setSelectedEnvs] = useState<Set<string>>(new Set())

  const { data: serversData, isLoading: serversLoading } = useServers(undefined, true)
  const envTypes = useMemo(() => {
    const types = new Set<string>()
    for (const s of serversData?.data ?? []) {
      if (s.env_type) types.add(s.env_type)
    }
    return [...types].sort()
  }, [serversData])

  const serverList = useMemo(() => {
    const raw = serversData?.data ?? []
    let filtered = raw.map((s) => ({ server_id: s.server_id, server_label: s.server_label, env_type: s.env_type }))
    if (selectedEnvs.size > 0) {
      filtered = filtered.filter((s) => selectedEnvs.has(s.env_type ?? ''))
    }
    return filtered
  }, [serversData, selectedEnvs])

  useEffect(() => {
    const validIds = new Set(serverList.map((s) => s.server_id))
    setSelectedServers((prev) => new Set([...prev].filter((id) => validIds.has(id))))
  }, [serverList])

  const hasServerSelection = selectedServers.size > 0
  const { data: sourcesResp, isFetching, isError, error } = useSpeedMonitoringSources(
    [...selectedServers],
    hasServerSelection
  )
  const { data: detailsResp, isLoading: detailsLoading, isError: detailsError } =
    useSpeedMonitoringSourceDetails(selectedDiName, selectedServerForDetail)

  const currentOrder = SOURCE_ORDER

  const sources = sourcesResp?.data ?? []
  const showComparison = selectedServers.size >= 2

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const s of sources) {
      counts[s.status] = (counts[s.status] || 0) + 1
    }
    return counts
  }, [sources])

  const statusTabs = useMemo(() => {
    return Object.keys(statusCounts).sort()
  }, [statusCounts])

  const allSourceNames = useMemo(() => {
    const available = new Set(sources.map((s) => s.di_name))
    return currentOrder.filter((name) => available.has(name))
  }, [sources, currentOrder])

  const sourceOrderIndex = useMemo(() => {
    const map = new Map<string, number>()
    currentOrder.forEach((name, idx) => map.set(name, idx))
    return map
  }, [currentOrder])

  const filteredSources = useMemo(() => {
    let result = sources
    if (activeStatus) {
      result = result.filter((s) => s.status === activeStatus)
    }
    if (selectedSources.size > 0) {
      result = result.filter((s) => selectedSources.has(s.di_name))
    }
    return [...result].sort(
      (a, b) => (sourceOrderIndex.get(a.di_name) ?? 999) - (sourceOrderIndex.get(b.di_name) ?? 999)
    )
  }, [sources, activeStatus, selectedSources, sourceOrderIndex])

  const selectedSourceObj = useMemo(() => {
    if (!selectedDiName) return null
    return sources.find((s) => s.di_name === selectedDiName) ?? null
  }, [sources, selectedDiName])

  const handleSourceClick = (source: { di_name: string; server_id: number }) => {
    setSelectedDiName(source.di_name)
    setSelectedServerForDetail(source.server_id)
  }

  const details: any[] = detailsResp?.data ?? []
  const hasError = details.some(
    (d) => typeof d === 'object' && d !== null && 'error' in d
  )
  const errorMessage = hasError
    ? (details.find((d) => 'error' in d) as { error: string } | undefined)?.error ?? null
    : null

  const activeServers = useMemo(() => {
    return serverList.filter((s) => selectedServers.has(s.server_id))
  }, [serverList, selectedServers])

  const comparisonRows: ComparisonRow[] = useMemo(() => {
    if (!showComparison) return []

    const sourceMap: Record<string, Record<number, MonitoringSource>> = {}

    for (const s of sources) {
      if (!sourceMap[s.di_name]) {
        sourceMap[s.di_name] = {}
      }
      sourceMap[s.di_name][s.server_id] = s
    }

    const rows: ComparisonRow[] = []
    for (const diName of currentOrder) {
      const serverSources = sourceMap[diName]
      if (!serverSources) continue

      const cellMap: Record<number, SourceCell> = {}
      let hasNotFound = false
      let firstStatus: string | null = null
      let statusMismatch = false

      for (const sid of selectedServers) {
        const src = serverSources[sid] ?? null
        cellMap[sid] = { source: src }
        if (!src) {
          hasNotFound = true
        } else if (firstStatus === null) {
          firstStatus = src.status
        } else if (src.status !== firstStatus) {
          statusMismatch = true
        }
      }

      let category: 'mismatch' | 'match' | 'notFound'
      if (hasNotFound) {
        category = 'notFound'
      } else if (statusMismatch) {
        category = 'mismatch'
      } else {
        category = 'match'
      }

      rows.push({ di_name: diName, servers: cellMap, category })
    }

    let result = rows
    if (selectedSources.size > 0) {
      result = result.filter((r) => selectedSources.has(r.di_name))
    }
    if (activeStatus) {
      result = result.filter((r) => {
        const vals = Object.values(r.servers)
          .filter((c) => c.source)
          .map((c) => c.source!.status)
        return vals.some((st) => st === activeStatus)
      })
    }
    return result
  }, [sources, showComparison, selectedServers, selectedSources, activeStatus, currentOrder])

  const mismatchCount = useMemo(() => {
    return comparisonRows.filter((r) => r.category === 'mismatch').length
  }, [comparisonRows])

  const notFoundCount = useMemo(() => {
    return comparisonRows.filter((r) => r.category === 'notFound').length
  }, [comparisonRows])

  const totalSources = comparisonRows.length

  const [detailDrawer, setDetailDrawer] = useState<{ diName: string; serverIds: number[] } | null>(null)

  const handleComparisonRowClick = (diName: string, rowServers: Record<number, SourceCell>) => {
    const serverIds = Object.entries(rowServers)
      .filter(([, cell]) => cell.source)
      .map(([sid]) => Number(sid))
    setDetailDrawer({ diName, serverIds })
  }

  const multiDetailQuery = useMultiServerSpeedSourceDetails(
    detailDrawer?.diName ?? null,
    detailDrawer?.serverIds ?? []
  )

  const multiDetailResults: { server_id: number; server_label: string; records: any[] }[] = useMemo(() => {
    const raw = multiDetailQuery.data ?? []
    return raw.map((records, idx) => ({
      server_id: detailDrawer?.serverIds[idx] ?? 0,
      server_label: serverList.find((s) => s.server_id === detailDrawer?.serverIds[idx])?.server_label ?? `Server ${detailDrawer?.serverIds[idx]}`,
      records,
    }))
  }, [multiDetailQuery.data, detailDrawer, serverList])

  function formatDetailCell(val: unknown): string {
    if (val == null) return '\u2014'
    if (typeof val === 'string') {
      const d = new Date(val)
      if (!isNaN(d.getTime())) return d.toLocaleString()
    }
    return String(val)
  }

  const envOptions = useMemo(() => envTypes.map((e) => ({ value: e, label: e })), [envTypes])
  const serverOptions = useMemo(
    () => serverList.map((s) => ({ value: String(s.server_id), label: s.server_label })),
    [serverList]
  )
  const sourceOptions = useMemo(
    () => allSourceNames.map((n) => ({ value: n, label: n })),
    [allSourceNames]
  )

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 h-full flex flex-col">
      {/* ── Page Header ── */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Activity className="w-5 h-5 text-primary" />
            </div>
            Monitoring Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Data Integration (DI) source monitoring & status overview
          </p>
        </div>
        <div className="flex items-center gap-3">
          {serversLoading ? (
            <>
              <div className="h-9 w-28 skeleton rounded-xl" />
              <div className="h-9 w-36 skeleton rounded-xl" />
              <div className="h-9 w-32 skeleton rounded-xl" />
            </>
          ) : (
            <>
              {envOptions.length > 0 && (
                <MultiSelect
                  options={envOptions}
                  selected={selectedEnvs}
                  onChange={setSelectedEnvs}
                  placeholder="Environments"
                  showSelectAll
                  disabled={isFetching}
                />
              )}
              {serverOptions.length > 0 && (
                <MultiSelect
                  options={serverOptions}
                  selected={new Set([...selectedServers].map(String))}
                  onChange={(s) => setSelectedServers(new Set([...s].map(Number)))}
                  placeholder="Servers"
                  searchable
                  showSelectAll
                  disabled={isFetching}
                />
              )}
              {sourceOptions.length > 0 && (
                <MultiSelect
                  options={sourceOptions}
                  selected={selectedSources}
                  onChange={setSelectedSources}
                  placeholder="Sources"
                  searchable
                  showSelectAll
                  disabled={isFetching}
                />
              )}
            </>
          )}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${isFetching ? 'glass-card text-primary' : 'text-muted-foreground'}`}>
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin text-primary' : ''}`} />
            <span className="text-[11px]">Auto-refresh 30s</span>
          </div>
        </div>
      </div>

      {isError && (
        <ErrorBanner message={(error as any)?.message ?? 'Failed to load monitoring sources.'} />
      )}

      {/* Global blocking overlay during fetching */}
      {isFetching && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/50 backdrop-blur-[2px]">
          <div className="glass-card flex flex-col items-center p-6 shadow-2xl">
            <LoadingSpinner />
            <p className="mt-4 text-sm font-semibold text-muted-foreground">Syncing Sources...</p>
          </div>
        </div>
      )}

      {showComparison ? (
        <>
          {/* ── Comparison Summary Bar ── */}
          {activeServers.length >= 2 && (
            <div className="glass-card p-4 shrink-0">
              {isFetching ? (
                <div className="flex items-center gap-3">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <span className="text-xs text-muted-foreground">Loading comparison data...</span>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                  <div>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Comparing</span>
                    <p className="text-sm font-bold text-foreground">
                      {activeServers.length} server{activeServers.length !== 1 ? 's' : ''}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate max-w-[200px]">
                      {activeServers.map((s) => s.server_label).join(', ')}
                    </p>
                  </div>
                  <div className="h-8 w-px bg-border/50" />
                  <div>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Sources</span>
                    <p className="text-sm font-bold text-foreground tabular-nums">{totalSources.toLocaleString()}</p>
                  </div>
                  <div className="h-8 w-px bg-border/50" />
                  <div>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Mismatch</span>
                    <p className={`text-sm font-bold tabular-nums ${mismatchCount > 0 ? 'text-destructive' : 'text-success'}`}>
                      {mismatchCount > 0 ? mismatchCount.toLocaleString() : '0'}
                    </p>
                    {mismatchCount > 0 && (
                      <p className="text-[10px] text-destructive">Status differences detected</p>
                    )}
                  </div>
                  <div className="h-8 w-px bg-border/50" />
                  <div>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Not Found</span>
                    <p className={`text-sm font-bold tabular-nums ${notFoundCount > 0 ? 'text-warning' : 'text-success'}`}>
                      {notFoundCount > 0 ? notFoundCount.toLocaleString() : '0'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Comparison Table ── */}
          {!hasServerSelection ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center glass-card p-10 rounded-2xl">
                <Server className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-sm font-medium text-muted-foreground">Select environment & server to begin</p>
              </div>
            </div>
          ) : isFetching ? (
            <div className="flex-1 flex items-center justify-center">
              <LoadingSpinner />
            </div>
          ) : comparisonRows.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center glass-card p-10 rounded-2xl">
                <Activity className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-sm font-medium text-muted-foreground">No monitoring sources found</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-auto">
              <div className="glass-card overflow-hidden">
                <Table className="text-xs">
                  <TableHeader>
                    <TableRow className="bg-muted/50 border-b border-border/50">
                      <TableHead className="sticky left-0 z-10 bg-muted/50 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-44 h-9 px-3">
                        <div className="flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5" />
                          Source
                        </div>
                      </TableHead>
                      {activeServers.map((srv) => (
                        <TableHead key={srv.server_id} className="text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground min-w-[150px] h-9 px-3">
                          <div className="flex items-center justify-center gap-1.5">
                            <Server className="w-3 h-3" />
                            {srv.server_label}
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {comparisonRows.map((row) => {
                      const isMismatchRow = row.category === 'mismatch'
                      const isNotFoundRow = row.category === 'notFound'

                      return (
                        <TableRow
                          key={row.di_name}
                          onClick={() => handleComparisonRowClick(row.di_name, row.servers)}
                          className={`cursor-pointer transition-colors duration-200 ${
                            isMismatchRow ? 'bg-destructive/5 hover:bg-destructive/10' : isNotFoundRow ? 'bg-warning/5 hover:bg-warning/10' : 'hover:bg-muted/30'
                          }`}
                        >
                          <TableCell className="sticky left-0 z-10 bg-[inherit] font-semibold text-foreground py-2 px-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xs">{row.di_name}</span>
                              {isMismatchRow && (
                                <span className="px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive text-[8px] font-semibold border border-destructive/20">
                                  Mismatch
                                </span>
                              )}
                              {isNotFoundRow && (
                                <span className="px-1.5 py-0.5 rounded-full bg-warning/10 text-warning text-[8px] font-semibold border border-warning/20">
                                  N/F
                                </span>
                              )}
                            </div>
                          </TableCell>
                          {activeServers.map((srv) => {
                            const cell = row.servers[srv.server_id]
                            if (!cell || !cell.source) {
                              return (
                                <TableCell key={srv.server_id} className="text-center text-muted-foreground py-2 px-3">
                                  <span className="text-[10px] font-medium text-warning">Not Found</span>
                                </TableCell>
                              )
                            }
                            const src = cell.source
                            return (
                              <TableCell key={srv.server_id} className="text-center py-2 px-3">
                                <div className="flex flex-col items-center gap-1">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold ${getStatusBadgeClass(src.status)}`}>
                                    {src.status}
                                  </span>
                                  <span className="text-[9px] text-muted-foreground font-mono">
                                    {formatShortDate(src.latest_pulltimestamp)}
                                  </span>
                                  <span className="text-[9px] text-muted-foreground/60 flex items-center gap-0.5">
                                    <Clock className="w-2.5 h-2.5" />{src.frequency}
                                  </span>
                                </div>
                              </TableCell>
                            )
                          })}
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {hasServerSelection && (
            <>
              {/* ── Status Filter Tabs ── */}
              {isFetching ? (
                <div className="flex flex-wrap gap-2 shrink-0">
                  <div className="h-8 w-20 skeleton rounded-xl" />
                  <div className="h-8 w-24 skeleton rounded-xl" />
                  <div className="h-8 w-20 skeleton rounded-xl" />
                </div>
              ) : statusTabs.length > 0 ? (
                <div className="flex flex-wrap gap-2 shrink-0">
                  <Button
                    variant={activeStatus === null ? 'default' : 'secondary'}
                    size="sm"
                    onClick={() => setActiveStatus(null)}
                    className="text-[11px] font-semibold uppercase tracking-wider h-8 px-3.5 rounded-xl transition-all duration-200"
                  >
                    All ({filteredSources.length})
                  </Button>
                  {statusTabs.map((st) => (
                    <Button
                      key={st}
                      variant={activeStatus === st ? 'default' : 'secondary'}
                      size="sm"
                      onClick={() => setActiveStatus(st)}
                      className="text-[11px] font-semibold uppercase tracking-wider h-8 px-3.5 rounded-xl transition-all duration-200"
                    >
                      {st} ({statusCounts[st]})
                    </Button>
                  ))}
                </div>
              ) : null}
            </>
          )}

          {/* ── Two-panel layout ── */}
          <div className="flex gap-4 flex-1 min-h-0">
            {/* Left: Source List */}
            <div className="w-80 shrink-0 overflow-y-auto space-y-2 pr-1">
              {!hasServerSelection ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center glass-card p-8 rounded-2xl">
                    <Server className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                    <p className="text-sm font-medium text-muted-foreground">Select environment & server to begin</p>
                  </div>
                </div>
              ) : isFetching ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="glass-card p-3 space-y-2">
                    <div className="h-4 skeleton rounded-lg w-2/3" />
                    <div className="h-3 skeleton rounded-lg w-1/2" />
                    <div className="h-3 skeleton rounded-lg w-1/3" />
                  </div>
                ))
              ) : filteredSources.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center glass-card p-8 rounded-2xl">
                    <Activity className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                    <p className="text-sm font-medium text-muted-foreground">No monitoring sources found</p>
                  </div>
                </div>
              ) : (
                filteredSources.map((source) => (
                  <SourceCard
                    key={`${source.server_id}-${source.di_name}`}
                    source={source}
                    isSelected={selectedDiName === source.di_name}
                    onClick={() => handleSourceClick(source)}
                  />
                ))
              )}
            </div>

            {/* Right: Details Panel */}
            <div className="flex-1 glass-card overflow-y-auto">
              {!selectedDiName ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Activity className="w-12 h-12 mb-3 opacity-20" />
                  <p className="text-sm font-medium">Select a source to view details</p>
                </div>
              ) : detailsLoading ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <LoadingSpinner />
                  <p className="text-xs text-muted-foreground mt-3">Loading details...</p>
                </div>
              ) : detailsError ? (
                <div className="p-5"><ErrorBanner message="Unable to load source details. Please retry." /></div>
              ) : errorMessage ? (
                <div className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-lg font-bold text-foreground">{selectedDiName}</h2>
                      {selectedSourceObj && (
                        <p className="text-xs text-muted-foreground mt-0.5">{selectedSourceObj.server_label}</p>
                      )}
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-muted text-muted-foreground text-[11px] font-semibold">{details.length} records</span>
                  </div>
                  <ErrorBanner message={errorMessage} />
                </div>
              ) : (
                <div className="p-5">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h2 className="text-lg font-bold text-foreground">{selectedDiName}</h2>
                      {selectedSourceObj && (
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                          <Server className="w-3 h-3" />{selectedSourceObj.server_label}
                          <span className="text-border">•</span>
                          <Clock className="w-3 h-3" />{selectedSourceObj.frequency}
                          {selectedSourceObj.latest_pulltimestamp && (
                            <><span className="text-border">•</span>Last: {formatTime(selectedSourceObj.latest_pulltimestamp)}</>
                          )}
                        </p>
                      )}
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-muted text-muted-foreground text-[11px] font-semibold">{details.length} records</span>
                  </div>
                  {details.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <p className="text-sm">No detailed records available</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-border/50">
                      <Table className="text-xs">
                        <TableHeader>
                          <TableRow className="bg-muted/50 border-b border-border/50">
                            {Object.keys(details[0]).map((key) => (
                              <TableHead
                                key={key}
                                className="text-[10px] font-semibold uppercase tracking-wider h-9 px-3 whitespace-nowrap text-muted-foreground"
                              >
                                {key.replace(/_/g, ' ')}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {details.map((record, idx) => (
                            <TableRow key={idx} className="hover:bg-muted/30 transition-colors duration-200">
                              {Object.values(record).map((val, cIdx) => (
                                <TableCell key={cIdx} className="text-foreground py-2 px-3 text-[11px]">
                                  {formatDetailCell(val)}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Detail Sheet for Comparison View ── */}
      <Sheet open={!!detailDrawer} onOpenChange={(open) => { if (!open) setDetailDrawer(null) }}>
        <SheetContent className="w-full max-w-4xl sm:max-w-4xl overflow-y-auto p-0">
          <SheetHeader className="px-5 py-4 border-b border-border/50 sticky top-0 z-10 bg-background/80 backdrop-blur-xl">
            <SheetTitle className="text-base font-bold text-foreground">{detailDrawer?.diName ?? ''}</SheetTitle>
            <p className="text-xs text-muted-foreground">
              {detailDrawer?.serverIds.length ?? 0} server{detailDrawer?.serverIds.length !== 1 ? 's' : ''}
            </p>
          </SheetHeader>
          <div className="p-5">
            {multiDetailQuery.isLoading ? (
              <div className="flex justify-center py-12"><LoadingSpinner /></div>
            ) : multiDetailResults.length === 0 ? (
              <p className="text-sm text-muted-foreground py-10 text-center">No detailed records</p>
            ) : (
              <div className="flex gap-4 overflow-x-auto pb-2">
                {multiDetailResults.map(({ server_id, server_label, records }) => (
                  <div key={server_id} className="glass-card flex-1 min-w-[280px] shrink-0 overflow-hidden">
                    <div className="px-4 py-3 border-b border-border/50 bg-muted/30">
                      <h3 className="text-sm font-bold text-foreground">{server_label}</h3>
                    </div>
                    <div className="overflow-x-auto">
                      {records.length === 0 ? (
                        <p className="text-xs text-muted-foreground px-4 py-6 text-center">No records</p>
                      ) : (
                        <table className="w-full text-[10px]">
                          <thead>
                            <tr className="border-b border-border/50 bg-muted/50">
                              {Object.keys(records[0]).map((key) => (
                                <th key={key} className="px-3 py-2 text-left font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap text-[9px]">
                                  {key === 'pulltime' ? 'Timestamp' : key.replace(/_/g, ' ')}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/50">
                            {records.map((record, ri) => (
                              <tr key={ri} className="hover:bg-muted/30 transition-colors duration-200">
                                {Object.entries(record).map(([key, val]) => (
                                  <td key={key} className="px-3 py-1.5 font-mono whitespace-nowrap text-foreground">
                                    {key === 'pulltime' ? formatDetailCell(val) : String(val ?? '\u2014')}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

export default MonitoringDashboard
