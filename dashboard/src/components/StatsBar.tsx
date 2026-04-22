import React from 'react'
import { Issue, IssuePriority } from '../lib/supabase'

interface Props { issues: Issue[] }

export default function StatsBar({ issues }: Props) {
  const total = issues.length
  const byStatus = {
    new:         issues.filter(i => i.status === 'new').length,
    in_progress: issues.filter(i => i.status === 'in_progress').length,
    discussed:   issues.filter(i => i.status === 'discussed').length,
    done:        issues.filter(i => i.status === 'done').length,
    wont_fix:    issues.filter(i => i.status === 'wont_fix').length,
  }
  const overdue = issues.filter(i => i.due_date && new Date(i.due_date) < new Date() && i.status !== 'done').length
  const critical = issues.filter(i => i.priority === 'critical' && i.status !== 'done').length

  const stats = [
    { label: 'Total',       value: total,               color: 'text-gray-300' },
    { label: 'New',         value: byStatus.new,         color: 'text-gray-400' },
    { label: 'In Progress', value: byStatus.in_progress, color: 'text-yellow-400' },
    { label: 'Discussed',   value: byStatus.discussed,   color: 'text-blue-400' },
    { label: 'Done',        value: byStatus.done,        color: 'text-green-400' },
    { label: 'Overdue',     value: overdue,              color: overdue > 0 ? 'text-red-400' : 'text-gray-600' },
    { label: 'Critical',    value: critical,             color: critical > 0 ? 'text-red-400' : 'text-gray-600' },
  ]

  return (
    <div className="flex items-center gap-6 px-6 py-3 border-b border-gray-800 bg-gray-900/30 overflow-x-auto">
      {stats.map((s, i) => (
        <React.Fragment key={s.label}>
          {i > 0 && <span className="text-gray-700">|</span>}
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span className={`text-xl font-bold ${s.color}`}>{s.value}</span>
            <span className="text-xs text-gray-500">{s.label}</span>
          </div>
        </React.Fragment>
      ))}
    </div>
  )
}
