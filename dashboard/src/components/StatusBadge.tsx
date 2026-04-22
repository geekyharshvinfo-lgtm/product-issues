import React from 'react'
import { IssueStatus } from '../lib/supabase'

const CONFIG: Record<IssueStatus, { label: string; dot: string; text: string }> = {
  new:         { label: 'New',         dot: 'bg-slate-400',   text: 'text-slate-300' },
  discussed:   { label: 'Discussed',   dot: 'bg-blue-400',    text: 'text-blue-300' },
  in_progress: { label: 'In Progress', dot: 'bg-amber-400',   text: 'text-amber-300' },
  done:        { label: 'Done',        dot: 'bg-emerald-400', text: 'text-emerald-300' },
  wont_fix:    { label: "Won't Fix",   dot: 'bg-rose-400',    text: 'text-rose-300' },
}

export default function StatusBadge({ status }: { status: IssueStatus }) {
  const { label, dot, text } = CONFIG[status] ?? CONFIG.new
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${text}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
      {label}
    </span>
  )
}
