import React from 'react'
import { IssuePriority } from '../lib/supabase'

const CONFIG: Record<IssuePriority, { label: string; classes: string; dot: string }> = {
  critical: { label: 'Critical', classes: 'bg-red-900 text-red-300',    dot: 'bg-red-400' },
  high:     { label: 'High',     classes: 'bg-orange-900 text-orange-300', dot: 'bg-orange-400' },
  medium:   { label: 'Medium',   classes: 'bg-yellow-900 text-yellow-300', dot: 'bg-yellow-400' },
  low:      { label: 'Low',      classes: 'bg-gray-700 text-gray-400',   dot: 'bg-gray-400' },
}

export default function PriorityBadge({ priority }: { priority: IssuePriority }) {
  const { label, classes, dot } = CONFIG[priority] ?? CONFIG.medium
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${classes}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  )
}
