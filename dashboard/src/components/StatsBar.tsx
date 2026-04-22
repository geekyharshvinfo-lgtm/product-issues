import React from 'react'
import { Issue } from '../lib/supabase'

interface Props { issues: Issue[] }

export default function StatsBar({ issues }: Props) {
  const stats = [
    { label: 'Total',       value: issues.length,                                                                          color: 'text-white' },
    { label: 'New',         value: issues.filter(i => i.status === 'new').length,                                          color: 'text-slate-300' },
    { label: 'In Progress', value: issues.filter(i => i.status === 'in_progress').length,                                  color: 'text-amber-400' },
    { label: 'Done',        value: issues.filter(i => i.status === 'done').length,                                         color: 'text-emerald-400' },
    { label: 'Overdue',     value: issues.filter(i => i.due_date && new Date(i.due_date) < new Date() && i.status !== 'done').length, color: 'text-rose-400' },
    { label: 'Critical',    value: issues.filter(i => i.priority === 'critical' && i.status !== 'done').length,            color: 'text-rose-400' },
  ]

  return (
    <div className="flex items-center gap-8 px-6 py-3 border-b border-white/[0.06]">
      {stats.map((s, i) => (
        <div key={s.label} className="flex items-baseline gap-2">
          <span className={`text-2xl font-semibold tabular-nums ${s.color}`}>{s.value}</span>
          <span className="text-xs text-white/30 font-medium">{s.label}</span>
        </div>
      ))}
    </div>
  )
}
