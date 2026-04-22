import React from 'react'
import { IssueStatus } from '../lib/supabase'

const CONFIG: Record<IssueStatus, { label: string; classes: string }> = {
  new:         { label: 'New',         classes: 'bg-gray-700 text-gray-300' },
  discussed:   { label: 'Discussed',   classes: 'bg-blue-900 text-blue-300' },
  in_progress: { label: 'In Progress', classes: 'bg-yellow-900 text-yellow-300' },
  done:        { label: 'Done',        classes: 'bg-green-900 text-green-300' },
  wont_fix:    { label: "Won't Fix",   classes: 'bg-red-900 text-red-300' },
}

export default function StatusBadge({ status }: { status: IssueStatus }) {
  const { label, classes } = CONFIG[status] ?? CONFIG.new
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${classes}`}>
      {label}
    </span>
  )
}
