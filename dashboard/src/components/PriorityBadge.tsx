import React from 'react'
import { IssuePriority } from '../lib/supabase'

const CONFIG: Record<IssuePriority, { label: string; bar: string; text: string }> = {
  critical: { label: 'Critical', bar: 'bg-rose-500',   text: 'text-rose-400' },
  high:     { label: 'High',     bar: 'bg-orange-500', text: 'text-orange-400' },
  medium:   { label: 'Medium',   bar: 'bg-amber-500',  text: 'text-amber-400' },
  low:      { label: 'Low',      bar: 'bg-slate-500',  text: 'text-slate-400' },
}

export default function PriorityBadge({ priority }: { priority: IssuePriority }) {
  const { label, bar, text } = CONFIG[priority] ?? CONFIG.medium
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${text}`}>
      <span className={`w-0.5 h-3 rounded-full shrink-0 ${bar}`} />
      {label}
    </span>
  )
}
