import React from 'react'
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Issue } from '../lib/supabase'

interface Props { issues: Issue[] }

const STATUS_COLORS: Record<string, string> = {
  new: '#6b7280', discussed: '#3b82f6', in_progress: '#f59e0b', done: '#10b981', wont_fix: '#ef4444'
}
const PRIORITY_COLORS: Record<string, string> = {
  critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#6b7280'
}

export default function AnalyticsView({ issues }: Props) {
  // Status breakdown
  const statusData = ['new','discussed','in_progress','done','wont_fix'].map(s => ({
    name: s.replace('_',' '), value: issues.filter(i => i.status === s).length, color: STATUS_COLORS[s]
  })).filter(d => d.value > 0)

  // Priority breakdown
  const priorityData = ['critical','high','medium','low'].map(p => ({
    name: p, value: issues.filter(i => i.priority === p).length, color: PRIORITY_COLORS[p]
  })).filter(d => d.value > 0)

  // Issues per domain
  const domainMap: Record<string, number> = {}
  issues.forEach(i => {
    try { const h = new URL(i.url).hostname; domainMap[h] = (domainMap[h] || 0) + 1 } catch {}
  })
  const domainData = Object.entries(domainMap)
    .sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([name, value]) => ({ name: name.replace('www.',''), value }))

  // Reporter leaderboard
  const reporterMap: Record<string, number> = {}
  issues.forEach(i => { reporterMap[i.reporter_name] = (reporterMap[i.reporter_name] || 0) + 1 })
  const reporterData = Object.entries(reporterMap).sort((a, b) => b[1] - a[1]).slice(0, 10)

  return (
    <div className="p-6 space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Status Pie */}
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <h3 className="text-sm font-medium text-gray-300 mb-4">Issues by Status</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                {statusData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#e5e7eb' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Priority Pie */}
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <h3 className="text-sm font-medium text-gray-300 mb-4">Issues by Priority</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={priorityData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                {priorityData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#e5e7eb' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Issues per Domain */}
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 md:col-span-2">
          <h3 className="text-sm font-medium text-gray-300 mb-4">Issues per Domain</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={domainData} margin={{ left: -10 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#e5e7eb' }} />
              <Bar dataKey="value" fill="#6366f1" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Reporter Leaderboard */}
      <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
        <h3 className="text-sm font-medium text-gray-300 mb-4">Reporter Leaderboard</h3>
        <div className="space-y-2">
          {reporterData.map(([name, count], i) => (
            <div key={name} className="flex items-center gap-3">
              <span className="text-xs text-gray-600 w-5 text-right">{i + 1}</span>
              <div className="w-7 h-7 rounded-full bg-indigo-800 flex items-center justify-center text-xs font-bold text-indigo-200 shrink-0">
                {name[0]?.toUpperCase()}
              </div>
              <span className="flex-1 text-sm text-gray-300">{name}</span>
              <div className="flex items-center gap-2">
                <div className="h-1.5 rounded-full bg-indigo-600" style={{ width: `${(count / reporterData[0][1]) * 120}px` }} />
                <span className="text-xs text-gray-400 w-6 text-right">{count}</span>
              </div>
            </div>
          ))}
          {reporterData.length === 0 && <p className="text-gray-600 text-sm">No data yet.</p>}
        </div>
      </div>
    </div>
  )
}
