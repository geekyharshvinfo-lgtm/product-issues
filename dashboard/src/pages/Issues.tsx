import React, { useEffect, useState, useMemo } from 'react'
import {
  supabase, Issue, IssueStatus, IssuePriority,
  TeamMember,
  updateIssueField, deleteIssue, logActivity
} from '../lib/supabase'
import StatusBadge from '../components/StatusBadge'
import PriorityBadge from '../components/PriorityBadge'
import StatsBar from '../components/StatsBar'
import IssueDetailModal from '../components/IssueDetailModal'
import KanbanView from '../components/KanbanView'
import AnalyticsView from '../components/AnalyticsView'
import { exportExcel, exportCSV, exportPDF } from '../lib/export'

const ALL_STATUSES:   IssueStatus[]   = ['new','discussed','in_progress','done','wont_fix']
const ALL_PRIORITIES: IssuePriority[] = ['critical','high','medium','low']
const STATUS_LABELS:  Record<IssueStatus,string>   = { new:'New', discussed:'Discussed', in_progress:'In Progress', done:'Done', wont_fix:'Not an Issue' }
const PRIORITY_LABELS:Record<IssuePriority,string> = { critical:'Critical', high:'High', medium:'Medium', low:'Low' }

type SortField = 'created_at' | 'priority' | 'status' | 'due_date' | 'reporter_name'
type SortDir   = 'asc' | 'desc'
type View      = 'table' | 'kanban' | 'analytics'

const PRIORITY_ORDER: Record<IssuePriority,number> = { critical:0, high:1, medium:2, low:3 }
const STATUS_ORDER:   Record<IssueStatus,number>   = { new:0, in_progress:1, discussed:2, done:3, wont_fix:4 }
const REPORTER_KEY = 'pit_reporter_name'

function getReporterName() { return localStorage.getItem(REPORTER_KEY) || 'Anonymous' }

export default function IssuesPage() {
  const [issues,       setIssues]       = useState<Issue[]>([])
  const [teamMembers,  setTeamMembers]  = useState<TeamMember[]>([])
  const [loading,      setLoading]      = useState(true)
  const [view,         setView]         = useState<View>('table')
  const [selectedIssue,setSelectedIssue]= useState<Issue | null>(null)
  const [selectedIds,  setSelectedIds]  = useState<Set<string>>(new Set())
  const [updatingId,   setUpdatingId]   = useState<string | null>(null)
  const [reporterName] = useState(getReporterName)
  const [exportOpen,   setExportOpen]   = useState(false)

  // Filters
  const [search,         setSearch]         = useState('')
  const [statusFilter,   setStatusFilter]   = useState<IssueStatus[]>([])
  const [priorityFilter, setPriorityFilter] = useState<IssuePriority[]>([])
  const [assigneeFilter, setAssigneeFilter] = useState('')
  const [urlFilter,      setUrlFilter]      = useState('')
  const [dateFrom,       setDateFrom]       = useState('')
  const [dateTo,         setDateTo]         = useState('')
  const [groupByDomain,  setGroupByDomain]  = useState(false)
  const [sortField,      setSortField]      = useState<SortField>('created_at')
  const [sortDir,        setSortDir]        = useState<SortDir>('desc')

  useEffect(() => {
    Promise.all([fetchIssues(), fetchTeamMembers()])
    const channel = supabase.channel('issues-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'issues' }, fetchIssues)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function fetchIssues() {
    const { data } = await supabase.from('issues').select('*').order('created_at', { ascending: false })
    setIssues(data ?? []); setLoading(false)
  }
  async function fetchTeamMembers() {
    const { data } = await supabase.from('team_members').select('*').order('name')
    setTeamMembers(data ?? [])
  }


  function sortIssues(list: Issue[]) {
    return [...list].sort((a, b) => {
      let cmp = 0
      if (sortField === 'priority')     cmp = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
      else if (sortField === 'status')  cmp = STATUS_ORDER[a.status]     - STATUS_ORDER[b.status]
      else if (sortField === 'due_date')cmp = (a.due_date ?? '9999') < (b.due_date ?? '9999') ? -1 : 1
      else if (sortField === 'reporter_name') cmp = a.reporter_name.localeCompare(b.reporter_name)
      else cmp = a.created_at < b.created_at ? -1 : 1
      return sortDir === 'asc' ? cmp : -cmp
    })
  }

  const filtered = useMemo(() => sortIssues(issues.filter(issue => {
    if (statusFilter.length   && !statusFilter.includes(issue.status))     return false
    if (priorityFilter.length && !priorityFilter.includes(issue.priority)) return false
    if (assigneeFilter && issue.assignee !== assigneeFilter)               return false
    if (urlFilter      && !issue.url.toLowerCase().includes(urlFilter.toLowerCase())) return false
    if (dateFrom       && issue.created_at < dateFrom)                     return false
    if (dateTo         && issue.created_at > dateTo + 'T23:59:59')         return false
    if (search) {
      const q = search.toLowerCase()
      if (!issue.comment.toLowerCase().includes(q) &&
          !(issue.title ?? '').toLowerCase().includes(q) &&
          !issue.url.toLowerCase().includes(q) &&
          !issue.reporter_name.toLowerCase().includes(q)) return false
    }
    return true
  })), [issues, statusFilter, priorityFilter, assigneeFilter, urlFilter, dateFrom, dateTo, search, sortField, sortDir])

  const grouped = useMemo(() => {
    if (!groupByDomain) return null
    const map: Record<string, Issue[]> = {}
    filtered.forEach(i => { try { const h = new URL(i.url).hostname; (map[h] = map[h] || []).push(i) } catch {} })
    return map
  }, [filtered, groupByDomain])

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  const hasActiveFilters = search || statusFilter.length || priorityFilter.length || assigneeFilter || urlFilter || dateFrom || dateTo

  function handleUpdate(updated: Issue) {
    setIssues(prev => prev.map(i => i.id === updated.id ? updated : i))
    if (selectedIssue?.id === updated.id) setSelectedIssue(updated)
  }

  async function handleInlineStatus(id: string, status: IssueStatus) {
    const issue = issues.find(i => i.id === id)
    if (!issue) return
    setUpdatingId(id)
    await updateIssueField(id, { status })
    await logActivity(id, reporterName, 'changed status', 'status', issue.status, status)
    handleUpdate({ ...issue, status })
    setUpdatingId(null)
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this issue?')) return
    await deleteIssue(id)
    setIssues(prev => prev.filter(i => i.id !== id))
    if (selectedIssue?.id === id) setSelectedIssue(null)
    setSelectedIds(prev => { const s = new Set(prev); s.delete(id); return s })
  }

  async function bulkUpdateStatus(status: IssueStatus) {
    await Promise.all([...selectedIds].map(id => updateIssueField(id, { status })))
    setIssues(prev => prev.map(i => selectedIds.has(i.id) ? { ...i, status } : i))
    setSelectedIds(new Set())
  }

  async function bulkDelete() {
    if (!window.confirm(`Delete ${selectedIds.size} issues?`)) return
    await Promise.all([...selectedIds].map(id => deleteIssue(id)))
    setIssues(prev => prev.filter(i => !selectedIds.has(i.id)))
    setSelectedIds(new Set())
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }


  function SortIndicator({ field }: { field: SortField }) {
    if (sortField !== field) return <span style={{ color: 'rgba(255,255,255,0.15)', marginLeft: 4 }}>↕</span>
    return <span style={{ color: '#818cf8', marginLeft: 4 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  function renderTable(list: Issue[]) {
    return (
      <table className="w-full">
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {[
              { label: '', w: 'w-10' },
              { label: 'Status',   field: 'status'        as SortField },
              { label: 'Priority', field: 'priority'      as SortField },
              { label: 'Title / Description' },
              { label: 'URL' },
              { label: 'Assignee' },
              { label: 'Reporter', field: 'reporter_name' as SortField },
              { label: 'Due',      field: 'due_date'      as SortField },
              { label: 'Date',     field: 'created_at'    as SortField },
              { label: '' },
            ].map((col, i) => (
              <th key={i}
                className={`px-3 py-3 text-left text-xs font-medium ${col.field ? 'cursor-pointer select-none' : ''}`}
                style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 500, letterSpacing: '0.03em' }}
                onClick={() => col.field && toggleSort(col.field)}>
                {col.label}{col.field && <SortIndicator field={col.field} />}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {list.map(issue => {
            const overdue = issue.due_date && new Date(issue.due_date) < new Date() && issue.status !== 'done'
            const isSelected = selectedIds.has(issue.id)
            return (
              <tr key={issue.id}
                className="group transition-colors"
                style={{
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  background: isSelected ? 'rgba(99,102,241,0.06)' : 'transparent',
                }}
                onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isSelected ? 'rgba(99,102,241,0.06)' : 'transparent' }}>

                <td className="px-3 py-3">
                  <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(issue.id)}
                    onClick={e => e.stopPropagation()}
                    className="rounded" style={{ accentColor: '#6366f1', cursor: 'pointer' }} />
                </td>

                <td className="px-3 py-3 whitespace-nowrap cursor-pointer" onClick={() => setSelectedIssue(issue)}>
                  <StatusBadge status={issue.status} />
                </td>

                <td className="px-3 py-3 whitespace-nowrap">
                  <PriorityBadge priority={issue.priority} />
                </td>

                <td className="px-3 py-3 max-w-xs cursor-pointer" onClick={() => setSelectedIssue(issue)}>
                  {issue.title && (
                    <div className="text-xs font-medium truncate mb-0.5" style={{ color: 'rgba(255,255,255,0.85)' }}>{issue.title}</div>
                  )}
                  <div className="truncate text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{issue.comment}</div>
                </td>

                <td className="px-3 py-3 max-w-[150px]">
                  <a href={issue.url} target="_blank" rel="noreferrer"
                    className="text-xs truncate block transition-colors"
                    style={{ color: 'rgba(99,102,241,0.7)' }}
                    onMouseEnter={e => { (e.target as HTMLElement).style.color = '#818cf8' }}
                    onMouseLeave={e => { (e.target as HTMLElement).style.color = 'rgba(99,102,241,0.7)' }}
                    title={issue.url}>
                    {(() => { try { return new URL(issue.url).hostname } catch { return issue.url } })()}
                  </a>
                </td>

                <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                  <select value={issue.assignee ?? ''}
                    onChange={async e => {
                      const assignee = e.target.value || null
                      await updateIssueField(issue.id, { assignee })
                      await logActivity(issue.id, reporterName, 'changed assignee', 'assignee', issue.assignee ?? '', assignee ?? '')
                      handleUpdate({ ...issue, assignee })
                    }}
                    className="text-xs outline-none cursor-pointer bg-transparent max-w-[100px] truncate"
                    style={{ color: issue.assignee ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.2)', border: 'none' }}>
                    <option value="" style={{ background: '#1a1a1c' }}>Unassigned</option>
                    {teamMembers.map(m => <option key={m.id} value={m.name} style={{ background: '#1a1a1c' }}>{m.name}</option>)}
                  </select>
                </td>

                <td className="px-3 py-3 whitespace-nowrap">
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{issue.reporter_name}</span>
                </td>

                <td className="px-3 py-3 whitespace-nowrap">
                  <span className={`text-xs font-medium ${overdue ? 'text-rose-400' : ''}`}
                    style={!overdue ? { color: 'rgba(255,255,255,0.25)' } : {}}>
                    {issue.due_date ? new Date(issue.due_date).toLocaleDateString() : '—'}
                  </span>
                </td>

                <td className="px-3 py-3 whitespace-nowrap">
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
                    {new Date(issue.created_at).toLocaleDateString()}
                  </span>
                </td>

                <td className="px-3 py-3">
                  <button onClick={() => handleDelete(issue.id)}
                    className="text-xs opacity-0 group-hover:opacity-100 transition-all"
                    style={{ color: 'rgba(255,255,255,0.25)' }}
                    onMouseEnter={e => { (e.target as HTMLElement).style.color = '#f87171' }}
                    onMouseLeave={e => { (e.target as HTMLElement).style.color = 'rgba(255,255,255,0.25)' }}>
                    ✕
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    )
  }

  const sidebarItemStyle = (active: boolean) => ({
    display: 'block', width: '100%', textAlign: 'left' as const,
    padding: '6px 10px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer',
    transition: 'background 0.1s',
    background: active ? 'rgba(99,102,241,0.15)' : 'transparent',
    color: active ? '#a5b4fc' : 'rgba(255,255,255,0.45)',
    border: 'none',
  })

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#0d0d0f', color: '#f3f4f6', fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif" }}>

      {/* Sidebar */}
      <div className="w-52 shrink-0 flex flex-col py-4" style={{ borderRight: '1px solid rgba(255,255,255,0.06)', background: '#0d0d0f' }}>
        <div className="px-4 mb-5">
          <div className="text-sm font-semibold text-white">Product Issues</div>
          <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{reporterName}</div>
        </div>

        {/* Views */}
        <div className="px-3 space-y-0.5">
          {([['table','Table'], ['kanban','Kanban'], ['analytics','Analytics']] as [View,string][]).map(([v, label]) => (
            <button key={v} onClick={() => setView(v)} style={sidebarItemStyle(view === v)}>{label}</button>
          ))}
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top bar */}
        <div className="flex items-center gap-3 px-5 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="relative flex-1 max-w-sm">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.25)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" placeholder="Search issues..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full text-xs rounded-lg pl-8 pr-3 py-2 outline-none transition-colors"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)', color: '#e5e7eb' }} />
          </div>
          <span className="text-xs tabular-nums" style={{ color: 'rgba(255,255,255,0.25)' }}>{filtered.length} of {issues.length}</span>
          {hasActiveFilters && (
            <button onClick={() => { setSearch(''); setStatusFilter([]); setPriorityFilter([]); setAssigneeFilter(''); setUrlFilter(''); setDateFrom(''); setDateTo('') }}
            className="text-xs transition-colors" style={{ color: '#f87171', background: 'none', border: 'none', cursor: 'pointer' }}>
              Clear filters
            </button>
          )}
          <button onClick={() => setGroupByDomain(!groupByDomain)}
            className="text-xs px-3 py-1.5 rounded-lg transition-all"
            style={{
              background: groupByDomain ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${groupByDomain ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.08)'}`,
              color: groupByDomain ? '#a5b4fc' : 'rgba(255,255,255,0.4)',
              cursor: 'pointer',
            }}>
            Group by domain
          </button>

          {/* Export dropdown */}
          <div className="relative">
            <button onClick={() => setExportOpen(!exportOpen)}
              className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.55)', cursor: 'pointer' }}>
              Export
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            {exportOpen && (
              <div className="absolute right-0 top-9 rounded-xl overflow-hidden shadow-2xl z-20 py-1 min-w-[130px]"
                style={{ background: '#1a1a1e', border: '1px solid rgba(255,255,255,0.1)' }}>
                {[['Excel (.xlsx)', () => exportExcel(filtered)], ['CSV', () => exportCSV(filtered)], ['PDF Report', () => exportPDF(filtered)]].map(([label, fn]) => (
                  <button key={label as string} onClick={() => { (fn as () => void)(); setExportOpen(false) }}
                    className="w-full text-left px-4 py-2.5 text-xs transition-colors"
                    style={{ color: 'rgba(255,255,255,0.6)', background: 'none', border: 'none', cursor: 'pointer' }}
                    onMouseEnter={e => { (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.05)' }}
                    onMouseLeave={e => { (e.target as HTMLElement).style.background = 'none' }}>
                    {label as string}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <StatsBar issues={issues} />

        {/* Filter bar */}
        {view !== 'analytics' && (
          <div className="flex flex-wrap items-center gap-2 px-5 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.01)' }}>
            {ALL_STATUSES.map(s => (
              <button key={s} onClick={() => setStatusFilter(p => p.includes(s) ? p.filter(x=>x!==s) : [...p,s])}
                className="text-xs px-3 py-1.5 rounded-lg transition-all font-medium"
                style={{
                  background: statusFilter.includes(s) ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${statusFilter.includes(s) ? 'rgba(99,102,241,0.35)' : 'rgba(255,255,255,0.07)'}`,
                  color: statusFilter.includes(s) ? '#a5b4fc' : 'rgba(255,255,255,0.4)',
                  cursor: 'pointer',
                }}>
                {STATUS_LABELS[s]}
              </button>
            ))}
            <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.08)' }} />
            {ALL_PRIORITIES.map(p => (
              <button key={p} onClick={() => setPriorityFilter(prev => prev.includes(p) ? prev.filter(x=>x!==p) : [...prev,p])}
                className="text-xs px-3 py-1.5 rounded-lg transition-all font-medium"
                style={{
                  background: priorityFilter.includes(p) ? 'rgba(251,191,36,0.1)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${priorityFilter.includes(p) ? 'rgba(251,191,36,0.3)' : 'rgba(255,255,255,0.07)'}`,
                  color: priorityFilter.includes(p) ? '#fcd34d' : 'rgba(255,255,255,0.4)',
                  cursor: 'pointer',
                }}>
                {PRIORITY_LABELS[p]}
              </button>
            ))}
            <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.08)' }} />
            <select value={assigneeFilter} onChange={e => setAssigneeFilter(e.target.value)}
              className="text-xs rounded-lg px-2.5 py-1.5 outline-none cursor-pointer"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: assigneeFilter ? '#e5e7eb' : 'rgba(255,255,255,0.35)' }}>
              <option value="" style={{ background: '#1a1a1c' }}>All assignees</option>
              {teamMembers.map(m => <option key={m.id} value={m.name} style={{ background: '#1a1a1c' }}>{m.name}</option>)}
            </select>
            <input type="text" placeholder="Filter by URL..." value={urlFilter} onChange={e => setUrlFilter(e.target.value)}
              className="text-xs rounded-lg px-2.5 py-1.5 outline-none w-36"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: '#e5e7eb' }} />
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="text-xs rounded-lg px-2.5 py-1.5 outline-none"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: dateFrom ? '#e5e7eb' : 'rgba(255,255,255,0.3)' }} />
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="text-xs rounded-lg px-2.5 py-1.5 outline-none"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: dateTo ? '#e5e7eb' : 'rgba(255,255,255,0.3)' }} />
          </div>
        )}

        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 px-5 py-2.5" style={{ background: 'rgba(99,102,241,0.08)', borderBottom: '1px solid rgba(99,102,241,0.15)' }}>
            <span className="text-xs font-semibold" style={{ color: '#a5b4fc' }}>{selectedIds.size} selected</span>
            <div style={{ width: '1px', height: '14px', background: 'rgba(99,102,241,0.3)' }} />
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Set status:</span>
            {ALL_STATUSES.map(s => (
              <button key={s} onClick={() => bulkUpdateStatus(s)}
                className="text-xs px-2.5 py-1 rounded-lg transition-colors"
                style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}>
                {STATUS_LABELS[s]}
              </button>
            ))}
            <div style={{ width: '1px', height: '14px', background: 'rgba(255,255,255,0.1)' }} />
            <button onClick={bulkDelete} className="text-xs transition-colors"
              style={{ color: '#f87171', background: 'none', border: 'none', cursor: 'pointer' }}>Delete</button>
            <button onClick={() => setSelectedIds(new Set())} className="text-xs ml-auto transition-colors"
              style={{ color: 'rgba(255,255,255,0.3)', background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1" style={{ overflow: view === 'kanban' ? 'visible' : 'auto' }}>
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <span className="text-sm" style={{ color: 'rgba(255,255,255,0.2)' }}>Loading...</span>
            </div>
          ) : view === 'analytics' ? (
            <AnalyticsView issues={issues} />
          ) : view === 'kanban' ? (
            <KanbanView issues={filtered} reporterName={reporterName} onUpdate={handleUpdate} onSelect={setSelectedIssue} />
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <span className="text-sm" style={{ color: 'rgba(255,255,255,0.2)' }}>No issues found</span>
              {hasActiveFilters && <span className="text-xs" style={{ color: 'rgba(255,255,255,0.15)' }}>Try clearing your filters</span>}
            </div>
          ) : groupByDomain && grouped ? (
            Object.entries(grouped).map(([domain, domainIssues]) => (
              <div key={domain}>
                <div className="sticky top-0 px-5 py-2.5 flex items-center gap-3 z-10"
                  style={{ background: '#0d0d0f', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <span className="text-xs font-semibold" style={{ color: '#818cf8' }}>{domain}</span>
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>{domainIssues.length} issues</span>
                </div>
                {renderTable(domainIssues)}
              </div>
            ))
          ) : renderTable(filtered)}
        </div>
      </div>

      {selectedIssue && (
        <IssueDetailModal issue={selectedIssue} teamMembers={teamMembers} reporterName={reporterName}
          onClose={() => setSelectedIssue(null)} onUpdate={handleUpdate} />
      )}
    </div>
  )
}
