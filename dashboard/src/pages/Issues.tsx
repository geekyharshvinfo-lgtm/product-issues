import React, { useEffect, useState, useMemo } from 'react'
import { supabase, Issue, IssueStatus, updateStatus, deleteIssue } from '../lib/supabase'
import StatusBadge from '../components/StatusBadge'
import ScreenshotModal from '../components/ScreenshotModal'

const ALL_STATUSES: IssueStatus[] = ['new', 'discussed', 'in_progress', 'done', 'wont_fix']
const STATUS_LABELS: Record<IssueStatus, string> = {
  new: 'New', discussed: 'Discussed', in_progress: 'In Progress', done: 'Done', wont_fix: "Won't Fix"
}

export default function IssuesPage() {
  const [issues, setIssues] = useState<Issue[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedStatuses, setSelectedStatuses] = useState<IssueStatus[]>([])
  const [urlFilter, setUrlFilter] = useState('')
  const [reporterFilter, setReporterFilter] = useState('')
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  useEffect(() => {
    fetchIssues()

    // Realtime subscription
    const channel = supabase
      .channel('issues-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'issues' }, () => {
        fetchIssues()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  async function fetchIssues() {
    const { data } = await supabase
      .from('issues')
      .select('*')
      .order('created_at', { ascending: false })
    setIssues(data ?? [])
    setLoading(false)
  }

  const filtered = useMemo(() => {
    return issues.filter(issue => {
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(issue.status)) return false
      if (urlFilter && !issue.url.toLowerCase().includes(urlFilter.toLowerCase())) return false
      if (reporterFilter && !issue.reporter_name.toLowerCase().includes(reporterFilter.toLowerCase())) return false
      return true
    })
  }, [issues, selectedStatuses, urlFilter, reporterFilter])

  function toggleStatus(s: IssueStatus) {
    setSelectedStatuses(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    )
  }

  async function handleStatusChange(id: string, status: IssueStatus) {
    setUpdatingId(id)
    await updateStatus(id, status)
    setIssues(prev => prev.map(i => i.id === id ? { ...i, status } : i))
    setUpdatingId(null)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this issue?')) return
    await deleteIssue(id)
    setIssues(prev => prev.filter(i => i.id !== id))
    if (selectedIssue?.id === id) setSelectedIssue(null)
  }

  function exportCSV() {
    const header = 'ID,URL,Page Title,Comment,Status,Reporter,Created At\n'
    const rows = filtered.map(i =>
      [i.id, i.url, i.page_title ?? '', i.comment, i.status, i.reporter_name, i.created_at]
        .map(v => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    ).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'product-issues.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <div className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Product Issues</h1>
          <p className="text-xs text-gray-500 mt-0.5">{filtered.length} of {issues.length} issues</p>
        </div>
        <button
          onClick={exportCSV}
          className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-md transition-colors"
        >
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="px-6 py-3 border-b border-gray-800 flex flex-wrap gap-3 items-center">
        {/* Status filter chips */}
        <div className="flex gap-1.5 flex-wrap">
          {ALL_STATUSES.map(s => (
            <button
              key={s}
              onClick={() => toggleStatus(s)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
                selectedStatuses.includes(s)
                  ? 'border-indigo-500 bg-indigo-900/50 text-indigo-300'
                  : 'border-gray-700 bg-transparent text-gray-400 hover:border-gray-500'
              }`}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
          {selectedStatuses.length > 0 && (
            <button
              onClick={() => setSelectedStatuses([])}
              className="px-2 py-1 text-xs text-gray-500 hover:text-gray-300"
            >
              Clear
            </button>
          )}
        </div>

        {/* URL filter */}
        <input
          type="text"
          placeholder="Filter by URL…"
          value={urlFilter}
          onChange={e => setUrlFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-md px-3 py-1.5 text-xs text-gray-200 placeholder-gray-500 outline-none focus:border-indigo-500 w-48"
        />

        {/* Reporter filter */}
        <input
          type="text"
          placeholder="Filter by reporter…"
          value={reporterFilter}
          onChange={e => setReporterFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-md px-3 py-1.5 text-xs text-gray-200 placeholder-gray-500 outline-none focus:border-indigo-500 w-44"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-500">Loading issues…</div>
      ) : filtered.length === 0 ? (
        <div className="flex items-center justify-center py-20 text-gray-600">No issues found</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Comment</th>
                <th className="px-4 py-3 font-medium">URL</th>
                <th className="px-4 py-3 font-medium">Reporter</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Screenshot</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(issue => (
                <tr
                  key={issue.id}
                  className="border-b border-gray-800/50 hover:bg-gray-900/40 transition-colors"
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    <select
                      value={issue.status}
                      disabled={updatingId === issue.id}
                      onChange={e => handleStatusChange(issue.id, e.target.value as IssueStatus)}
                      className="bg-transparent border-none outline-none cursor-pointer text-xs"
                      onClick={e => e.stopPropagation()}
                    >
                      {ALL_STATUSES.map(s => (
                        <option key={s} value={s} className="bg-gray-900">{STATUS_LABELS[s]}</option>
                      ))}
                    </select>
                    <StatusBadge status={issue.status} />
                  </td>
                  <td
                    className="px-4 py-3 max-w-xs cursor-pointer"
                    onClick={() => setSelectedIssue(issue)}
                  >
                    <div className="truncate text-gray-200">{issue.comment}</div>
                    {issue.page_title && (
                      <div className="truncate text-xs text-gray-500 mt-0.5">{issue.page_title}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 max-w-[200px]">
                    <a
                      href={issue.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-400 hover:text-indigo-300 text-xs truncate block"
                      title={issue.url}
                    >
                      {new URL(issue.url).hostname}
                    </a>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-400">{issue.reporter_name}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">
                    {new Date(issue.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    {issue.screenshot_path ? (
                      <button
                        onClick={() => setSelectedIssue(issue)}
                        className="text-xs text-indigo-400 hover:text-indigo-300"
                      >
                        View
                      </button>
                    ) : (
                      <span className="text-xs text-gray-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDelete(issue.id)}
                      className="text-xs text-gray-600 hover:text-red-400 transition-colors"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedIssue && (
        <ScreenshotModal issue={selectedIssue} onClose={() => setSelectedIssue(null)} />
      )}
    </div>
  )
}
