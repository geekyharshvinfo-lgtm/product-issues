import React, { useEffect, useState, useMemo, useCallback } from 'react'
import {
  supabase, Issue, IssueStatus, IssuePriority,
  TeamMember, Project, SavedFilter,
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
const STATUS_LABELS:  Record<IssueStatus, string>   = { new:'New', discussed:'Discussed', in_progress:'In Progress', done:'Done', wont_fix:"Won't Fix" }
const PRIORITY_LABELS:Record<IssuePriority, string> = { critical:'Critical', high:'High', medium:'Medium', low:'Low' }

type SortField = 'created_at' | 'priority' | 'status' | 'due_date' | 'reporter_name'
type SortDir   = 'asc' | 'desc'
type View      = 'table' | 'kanban' | 'analytics'

const PRIORITY_ORDER: Record<IssuePriority, number> = { critical: 0, high: 1, medium: 2, low: 3 }
const STATUS_ORDER:   Record<IssueStatus, number>   = { new: 0, in_progress: 1, discussed: 2, done: 3, wont_fix: 4 }

const REPORTER_KEY = 'pit_reporter_name'

function getReporterName(): string {
  return localStorage.getItem(REPORTER_KEY) || 'Anonymous'
}

export default function IssuesPage() {
  const [issues, setIssues]             = useState<Issue[]>([])
  const [teamMembers, setTeamMembers]   = useState<TeamMember[]>([])
  const [projects, setProjects]         = useState<Project[]>([])
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([])
  const [loading, setLoading]           = useState(true)
  const [view, setView]                 = useState<View>('table')
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null)
  const [selectedIds, setSelectedIds]   = useState<Set<string>>(new Set())
  const [updatingId, setUpdatingId]     = useState<string | null>(null)
  const [reporterName]                  = useState(getReporterName)

  // Filters
  const [search, setSearch]                 = useState('')
  const [statusFilter, setStatusFilter]     = useState<IssueStatus[]>([])
  const [priorityFilter, setPriorityFilter] = useState<IssuePriority[]>([])
  const [assigneeFilter, setAssigneeFilter] = useState('')
  const [projectFilter, setProjectFilter]   = useState('')
  const [tagFilter, setTagFilter]           = useState('')
  const [urlFilter, setUrlFilter]           = useState('')
  const [dateFrom, setDateFrom]             = useState('')
  const [dateTo, setDateTo]                 = useState('')
  const [groupByDomain, setGroupByDomain]   = useState(false)
  const [sortField, setSortField]           = useState<SortField>('created_at')
  const [sortDir, setSortDir]               = useState<SortDir>('desc')

  // Sidebar
  const [showProjectMgr, setShowProjectMgr] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')

  useEffect(() => {
    Promise.all([fetchIssues(), fetchTeamMembers(), fetchProjects(), fetchSavedFilters()])
    const channel = supabase.channel('issues-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'issues' }, fetchIssues)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function fetchIssues() {
    const { data } = await supabase.from('issues').select('*').order('created_at', { ascending: false })
    setIssues(data ?? [])
    setLoading(false)
  }

  async function fetchTeamMembers() {
    const { data } = await supabase.from('team_members').select('*').order('name')
    setTeamMembers(data ?? [])
  }

  async function fetchProjects() {
    const { data } = await supabase.from('projects').select('*').order('name')
    setProjects(data ?? [])
  }

  async function fetchSavedFilters() {
    const { data } = await supabase.from('saved_filters').select('*').order('created_at')
    setSavedFilters(data ?? [])
  }

  // Sorting helper
  function sortIssues(list: Issue[]): Issue[] {
    return [...list].sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'priority':    cmp = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]; break
        case 'status':      cmp = STATUS_ORDER[a.status]     - STATUS_ORDER[b.status];     break
        case 'due_date':    cmp = (a.due_date ?? '9999') < (b.due_date ?? '9999') ? -1 : 1; break
        case 'reporter_name': cmp = a.reporter_name.localeCompare(b.reporter_name); break
        default:            cmp = a.created_at < b.created_at ? -1 : 1
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }

  const filtered = useMemo(() => {
    let list = issues.filter(issue => {
      if (statusFilter.length   && !statusFilter.includes(issue.status))     return false
      if (priorityFilter.length && !priorityFilter.includes(issue.priority)) return false
      if (assigneeFilter && issue.assignee !== assigneeFilter)               return false
      if (projectFilter  && issue.project_id !== projectFilter)              return false
      if (tagFilter      && !(issue.tags ?? []).includes(tagFilter))         return false
      if (urlFilter      && !issue.url.toLowerCase().includes(urlFilter.toLowerCase())) return false
      if (dateFrom       && issue.created_at < dateFrom)                    return false
      if (dateTo         && issue.created_at > dateTo + 'T23:59:59')        return false
      if (search) {
        const q = search.toLowerCase()
        if (!issue.comment.toLowerCase().includes(q) &&
            !(issue.title ?? '').toLowerCase().includes(q) &&
            !issue.url.toLowerCase().includes(q) &&
            !issue.reporter_name.toLowerCase().includes(q)) return false
      }
      return true
    })
    return sortIssues(list)
  }, [issues, statusFilter, priorityFilter, assigneeFilter, projectFilter, tagFilter, urlFilter, dateFrom, dateTo, search, sortField, sortDir])

  // Domain grouping
  const grouped = useMemo(() => {
    if (!groupByDomain) return null
    const map: Record<string, Issue[]> = {}
    filtered.forEach(i => {
      try { const h = new URL(i.url).hostname; (map[h] = map[h] || []).push(i) } catch {}
    })
    return map
  }, [filtered, groupByDomain])

  // All tags for filter dropdown
  const allTags = useMemo(() => {
    const s = new Set<string>()
    issues.forEach(i => (i.tags ?? []).forEach(t => s.add(t)))
    return [...s].sort()
  }, [issues])

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  function clearFilters() {
    setSearch(''); setStatusFilter([]); setPriorityFilter([]); setAssigneeFilter('')
    setProjectFilter(''); setTagFilter(''); setUrlFilter(''); setDateFrom(''); setDateTo('')
  }

  async function saveCurrentFilter() {
    const name = prompt('Filter preset name:')?.trim()
    if (!name) return
    const filter_json = { statusFilter, priorityFilter, assigneeFilter, projectFilter, tagFilter, urlFilter, dateFrom, dateTo, search }
    await supabase.from('saved_filters').insert({ name, filter_json, created_by: reporterName })
    fetchSavedFilters()
  }

  function applyFilter(f: SavedFilter) {
    const j = f.filter_json as Record<string, unknown>
    setStatusFilter((j.statusFilter as IssueStatus[]) ?? [])
    setPriorityFilter((j.priorityFilter as IssuePriority[]) ?? [])
    setAssigneeFilter((j.assigneeFilter as string) ?? '')
    setProjectFilter((j.projectFilter as string) ?? '')
    setTagFilter((j.tagFilter as string) ?? '')
    setUrlFilter((j.urlFilter as string) ?? '')
    setDateFrom((j.dateFrom as string) ?? '')
    setDateTo((j.dateTo as string) ?? '')
    setSearch((j.search as string) ?? '')
  }

  async function deleteSavedFilter(id: string) {
    await supabase.from('saved_filters').delete().eq('id', id)
    fetchSavedFilters()
  }

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
    if (!confirm('Delete this issue?')) return
    await deleteIssue(id)
    setIssues(prev => prev.filter(i => i.id !== id))
    if (selectedIssue?.id === id) setSelectedIssue(null)
    setSelectedIds(prev => { const s = new Set(prev); s.delete(id); return s })
  }

  async function bulkUpdateStatus(status: IssueStatus) {
    const ids = [...selectedIds]
    await Promise.all(ids.map(id => updateIssueField(id, { status })))
    setIssues(prev => prev.map(i => selectedIds.has(i.id) ? { ...i, status } : i))
    setSelectedIds(new Set())
  }

  async function bulkDelete() {
    if (!confirm(`Delete ${selectedIds.size} issues?`)) return
    const ids = [...selectedIds]
    await Promise.all(ids.map(id => deleteIssue(id)))
    setIssues(prev => prev.filter(i => !selectedIds.has(i.id)))
    setSelectedIds(new Set())
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }

  function toggleSelectAll() {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(filtered.map(i => i.id)))
  }

  async function addProject() {
    if (!newProjectName.trim()) return
    await supabase.from('projects').insert({ name: newProjectName.trim() })
    setNewProjectName('')
    fetchProjects()
  }

  const hasActiveFilters = search || statusFilter.length || priorityFilter.length || assigneeFilter || projectFilter || tagFilter || urlFilter || dateFrom || dateTo

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <span className="text-gray-700 ml-1">↕</span>
    return <span className="text-indigo-400 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  function renderTable(list: Issue[]) {
    return (
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider">
            <th className="px-3 py-3 w-8">
              <input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0} onChange={toggleSelectAll}
                className="rounded border-gray-600 bg-gray-800 text-indigo-500" />
            </th>
            <th className="px-3 py-3 cursor-pointer hover:text-gray-300" onClick={() => toggleSort('status')}>Status <SortIcon field="status" /></th>
            <th className="px-3 py-3 cursor-pointer hover:text-gray-300" onClick={() => toggleSort('priority')}>Priority <SortIcon field="priority" /></th>
            <th className="px-3 py-3">Title / Comment</th>
            <th className="px-3 py-3">URL</th>
            <th className="px-3 py-3">Assignee</th>
            <th className="px-3 py-3 cursor-pointer hover:text-gray-300" onClick={() => toggleSort('reporter_name')}>Reporter <SortIcon field="reporter_name" /></th>
            <th className="px-3 py-3 cursor-pointer hover:text-gray-300" onClick={() => toggleSort('due_date')}>Due <SortIcon field="due_date" /></th>
            <th className="px-3 py-3 cursor-pointer hover:text-gray-300" onClick={() => toggleSort('created_at')}>Date <SortIcon field="created_at" /></th>
            <th className="px-3 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {list.map(issue => {
            const overdue = issue.due_date && new Date(issue.due_date) < new Date() && issue.status !== 'done'
            return (
              <tr key={issue.id}
                className={`border-b border-gray-800/50 hover:bg-gray-900/40 transition-colors ${selectedIds.has(issue.id) ? 'bg-indigo-900/10' : ''}`}>
                <td className="px-3 py-3">
                  <input type="checkbox" checked={selectedIds.has(issue.id)} onChange={() => toggleSelect(issue.id)}
                    className="rounded border-gray-600 bg-gray-800 text-indigo-500" onClick={e => e.stopPropagation()} />
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <select value={issue.status} disabled={updatingId === issue.id}
                    onChange={e => handleInlineStatus(issue.id, e.target.value as IssueStatus)}
                    className="bg-transparent border-none outline-none cursor-pointer text-xs w-0 h-0 opacity-0 absolute"
                    onClick={e => e.stopPropagation()} />
                  <div onClick={() => setSelectedIssue(issue)} className="cursor-pointer">
                    <StatusBadge status={issue.status} />
                  </div>
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <PriorityBadge priority={issue.priority} />
                </td>
                <td className="px-3 py-3 max-w-xs cursor-pointer" onClick={() => setSelectedIssue(issue)}>
                  {issue.title && <div className="text-xs font-medium text-white truncate">{issue.title}</div>}
                  <div className="truncate text-gray-400 text-xs mt-0.5">{issue.comment}</div>
                  {(issue.tags ?? []).length > 0 && (
                    <div className="flex gap-1 mt-1">
                      {(issue.tags ?? []).slice(0,3).map(t => (
                        <span key={t} className="text-xs bg-indigo-900/40 text-indigo-400 px-1.5 rounded cursor-pointer" onClick={e => { e.stopPropagation(); setTagFilter(t) }}>#{t}</span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-3 py-3 max-w-[160px]">
                  <a href={issue.url} target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300 text-xs truncate block" title={issue.url}>
                    {(() => { try { return new URL(issue.url).hostname } catch { return issue.url } })()}
                  </a>
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <select value={issue.assignee ?? ''} onClick={e => e.stopPropagation()}
                    onChange={async e => {
                      const assignee = e.target.value || null
                      await updateIssueField(issue.id, { assignee })
                      await logActivity(issue.id, reporterName, 'changed assignee', 'assignee', issue.assignee ?? '', assignee ?? '')
                      handleUpdate({ ...issue, assignee })
                    }}
                    className="bg-transparent text-xs text-gray-400 outline-none cursor-pointer border-none max-w-[100px] truncate">
                    <option value="" className="bg-gray-900">Unassigned</option>
                    {teamMembers.map(m => <option key={m.id} value={m.name} className="bg-gray-900">{m.name}</option>)}
                  </select>
                </td>
                <td className="px-3 py-3 whitespace-nowrap text-xs text-gray-500">{issue.reporter_name}</td>
                <td className={`px-3 py-3 whitespace-nowrap text-xs ${overdue ? 'text-red-400 font-medium' : 'text-gray-500'}`}>
                  {issue.due_date ? new Date(issue.due_date).toLocaleDateString() : '—'}
                  {overdue && ' ⚠'}
                </td>
                <td className="px-3 py-3 whitespace-nowrap text-xs text-gray-500">
                  {new Date(issue.created_at).toLocaleDateString()}
                </td>
                <td className="px-3 py-3">
                  <button onClick={() => handleDelete(issue.id)} className="text-xs text-gray-600 hover:text-red-400 transition-colors">✕</button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex">

      {/* Sidebar */}
      <div className="w-56 shrink-0 border-r border-gray-800 bg-gray-900/50 flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <div className="text-sm font-semibold text-white">Product Issues</div>
          <div className="text-xs text-gray-500 mt-0.5">{reporterName}</div>
        </div>

        {/* View switcher */}
        <div className="p-3 space-y-1">
          {(['table','kanban','analytics'] as View[]).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors capitalize ${view === v ? 'bg-indigo-900/60 text-indigo-300' : 'text-gray-400 hover:bg-gray-800'}`}>
              {v === 'table' ? '☰ Table' : v === 'kanban' ? '⊞ Kanban' : '◎ Analytics'}
            </button>
          ))}
        </div>

        {/* Saved filters */}
        <div className="px-3 pb-2 border-t border-gray-800 mt-2 pt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">Saved Filters</span>
            {hasActiveFilters && (
              <button onClick={saveCurrentFilter} className="text-xs text-indigo-400 hover:text-indigo-300">+ Save</button>
            )}
          </div>
          {savedFilters.map(f => (
            <div key={f.id} className="flex items-center justify-between group">
              <button onClick={() => applyFilter(f)} className="flex-1 text-left text-xs text-gray-400 hover:text-gray-200 py-1 truncate">{f.name}</button>
              <button onClick={() => deleteSavedFilter(f.id)} className="text-gray-700 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100">✕</button>
            </div>
          ))}
          {savedFilters.length === 0 && <p className="text-xs text-gray-700">No saved filters</p>}
        </div>

        {/* Projects */}
        <div className="px-3 pb-3 border-t border-gray-800 mt-2 pt-3 flex-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">Projects</span>
            <button onClick={() => setShowProjectMgr(!showProjectMgr)} className="text-xs text-indigo-400 hover:text-indigo-300">+</button>
          </div>
          <button onClick={() => setProjectFilter('')}
            className={`w-full text-left text-xs py-1 px-2 rounded transition-colors ${!projectFilter ? 'text-indigo-300' : 'text-gray-400 hover:text-gray-200'}`}>
            All issues
          </button>
          {projects.map(p => (
            <button key={p.id} onClick={() => setProjectFilter(p.id)}
              className={`w-full text-left text-xs py-1 px-2 rounded transition-colors truncate ${projectFilter === p.id ? 'text-indigo-300' : 'text-gray-400 hover:text-gray-200'}`}>
              {p.name}
            </button>
          ))}
          {showProjectMgr && (
            <div className="flex gap-1 mt-2">
              <input value={newProjectName} onChange={e => setNewProjectName(e.target.value)}
                placeholder="Project name"
                className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 outline-none focus:border-indigo-500"
                onKeyDown={e => e.key === 'Enter' && addProject()} />
              <button onClick={addProject} className="text-xs bg-indigo-600 text-white px-2 rounded">Add</button>
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top bar */}
        <div className="border-b border-gray-800 px-5 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            {/* Global search */}
            <div className="relative flex-1 max-w-xs">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">⌕</span>
              <input type="text" placeholder="Search issues…" value={search} onChange={e => setSearch(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-7 pr-3 py-1.5 text-xs text-gray-200 placeholder-gray-500 outline-none focus:border-indigo-500" />
            </div>
            <span className="text-xs text-gray-600">{filtered.length} / {issues.length}</span>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="text-xs text-red-400 hover:text-red-300">Clear filters</button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setGroupByDomain(!groupByDomain)}
              className={`text-xs px-2.5 py-1.5 rounded border transition-colors ${groupByDomain ? 'border-indigo-500 text-indigo-300 bg-indigo-900/30' : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}>
              Group by domain
            </button>

            {/* Export menu */}
            <div className="relative group">
              <button className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-md transition-colors border border-gray-700">
                Export ▾
              </button>
              <div className="absolute right-0 top-8 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10 w-32 hidden group-hover:block">
                <button onClick={() => exportExcel(filtered)} className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-gray-700 rounded-t-lg">Excel (.xlsx)</button>
                <button onClick={() => exportCSV(filtered)}  className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-gray-700">CSV</button>
                <button onClick={() => exportPDF(filtered)}  className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-gray-700 rounded-b-lg">PDF Report</button>
              </div>
            </div>
          </div>
        </div>

        {/* Stats bar */}
        <StatsBar issues={issues} />

        {/* Filter bar */}
        {view !== 'analytics' && (
          <div className="px-5 py-2.5 border-b border-gray-800 flex flex-wrap gap-2 items-center bg-gray-900/20">
            {ALL_STATUSES.map(s => (
              <button key={s} onClick={() => setStatusFilter(prev => prev.includes(s) ? prev.filter(x=>x!==s) : [...prev,s])}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${statusFilter.includes(s) ? 'border-indigo-500 bg-indigo-900/50 text-indigo-300' : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}>
                {STATUS_LABELS[s]}
              </button>
            ))}
            <span className="text-gray-700">|</span>
            {ALL_PRIORITIES.map(p => (
              <button key={p} onClick={() => setPriorityFilter(prev => prev.includes(p) ? prev.filter(x=>x!==p) : [...prev,p])}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${priorityFilter.includes(p) ? 'border-orange-500 bg-orange-900/30 text-orange-300' : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}>
                {PRIORITY_LABELS[p]}
              </button>
            ))}
            <span className="text-gray-700">|</span>
            <select value={assigneeFilter} onChange={e => setAssigneeFilter(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-md px-2 py-1 text-xs text-gray-300 outline-none">
              <option value="">All assignees</option>
              {teamMembers.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
            </select>
            {allTags.length > 0 && (
              <select value={tagFilter} onChange={e => setTagFilter(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-md px-2 py-1 text-xs text-gray-300 outline-none">
                <option value="">All tags</option>
                {allTags.map(t => <option key={t} value={t}>#{t}</option>)}
              </select>
            )}
            <input type="text" placeholder="Filter URL…" value={urlFilter} onChange={e => setUrlFilter(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-md px-2 py-1 text-xs text-gray-300 outline-none focus:border-indigo-500 w-36" />
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-md px-2 py-1 text-xs text-gray-300 outline-none" title="From date" />
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-md px-2 py-1 text-xs text-gray-300 outline-none" title="To date" />
          </div>
        )}

        {/* Bulk actions bar */}
        {selectedIds.size > 0 && (
          <div className="px-5 py-2 bg-indigo-900/30 border-b border-indigo-800 flex items-center gap-3">
            <span className="text-xs text-indigo-300 font-medium">{selectedIds.size} selected</span>
            <span className="text-indigo-700">|</span>
            <span className="text-xs text-gray-400">Set status:</span>
            {ALL_STATUSES.map(s => (
              <button key={s} onClick={() => bulkUpdateStatus(s)}
                className="text-xs text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 px-2 py-1 rounded transition-colors">
                {STATUS_LABELS[s]}
              </button>
            ))}
            <span className="text-indigo-700">|</span>
            <button onClick={bulkDelete} className="text-xs text-red-400 hover:text-red-300">Delete all</button>
            <button onClick={() => setSelectedIds(new Set())} className="text-xs text-gray-500 hover:text-gray-300 ml-auto">Cancel</button>
          </div>
        )}

        {/* Content area */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-gray-500">Loading issues…</div>
          ) : view === 'analytics' ? (
            <AnalyticsView issues={issues} />
          ) : view === 'kanban' ? (
            <KanbanView issues={filtered} reporterName={reporterName} onUpdate={handleUpdate} onSelect={setSelectedIssue} />
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center py-20 text-gray-600">No issues found</div>
          ) : groupByDomain && grouped ? (
            Object.entries(grouped).map(([domain, domainIssues]) => (
              <div key={domain}>
                <div className="sticky top-0 bg-gray-900 px-5 py-2 border-b border-gray-800 z-10">
                  <span className="text-xs font-semibold text-indigo-400">{domain}</span>
                  <span className="text-xs text-gray-600 ml-2">{domainIssues.length} issues</span>
                </div>
                <div className="overflow-x-auto">{renderTable(domainIssues)}</div>
              </div>
            ))
          ) : (
            <div className="overflow-x-auto">{renderTable(filtered)}</div>
          )}
        </div>
      </div>

      {/* Issue detail modal */}
      {selectedIssue && (
        <IssueDetailModal
          issue={selectedIssue}
          teamMembers={teamMembers}
          reporterName={reporterName}
          onClose={() => setSelectedIssue(null)}
          onUpdate={handleUpdate}
        />
      )}
    </div>
  )
}
