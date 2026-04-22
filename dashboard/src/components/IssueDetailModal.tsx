import React, { useEffect, useState } from 'react'
import { Issue, IssueComment, ActivityLog, IssueLink, IssuePriority, IssueStatus, TeamMember, supabase, getScreenshotUrl, updateIssueField, logActivity } from '../lib/supabase'
import StatusBadge from './StatusBadge'
import PriorityBadge from './PriorityBadge'

interface Props {
  issue: Issue
  teamMembers: TeamMember[]
  reporterName: string
  onClose: () => void
  onUpdate: (updated: Issue) => void
}

const ALL_STATUSES: IssueStatus[]   = ['new','discussed','in_progress','done','wont_fix']
const ALL_PRIORITIES: IssuePriority[] = ['critical','high','medium','low']
const LINK_TYPES = ['duplicate','blocks','blocked_by','related']

export default function IssueDetailModal({ issue, teamMembers, reporterName, onClose, onUpdate }: Props) {
  const [comments, setComments]         = useState<IssueComment[]>([])
  const [activities, setActivities]     = useState<ActivityLog[]>([])
  const [links, setLinks]               = useState<IssueLink[]>([])
  const [newComment, setNewComment]     = useState('')
  const [watching, setWatching]         = useState(false)
  const [linkSearch, setLinkSearch]     = useState('')
  const [linkResults, setLinkResults]   = useState<Issue[]>([])
  const [linkType, setLinkType]         = useState<string>('related')
  const [activeTab, setActiveTab]       = useState<'details'|'comments'|'activity'|'links'>('details')
  const [local, setLocal]               = useState<Issue>(issue)

  useEffect(() => {
    fetchComments()
    fetchActivity()
    fetchLinks()
    checkWatcher()
  }, [issue.id])

  async function fetchComments() {
    const { data } = await supabase.from('issue_comments').select('*').eq('issue_id', issue.id).order('created_at')
    setComments(data ?? [])
  }

  async function fetchActivity() {
    const { data } = await supabase.from('activity_log').select('*').eq('issue_id', issue.id).order('created_at', { ascending: false })
    setActivities(data ?? [])
  }

  async function fetchLinks() {
    const { data } = await supabase
      .from('issue_links')
      .select('*, linked_issue:issues!issue_links_linked_issue_id_fkey(*)')
      .eq('issue_id', issue.id)
    setLinks(data ?? [])
  }

  async function checkWatcher() {
    const { data } = await supabase.from('issue_watchers').select('id').eq('issue_id', issue.id).eq('watcher_name', reporterName).single()
    setWatching(!!data)
  }

  async function handleFieldChange<K extends keyof Issue>(field: K, value: Issue[K]) {
    const old = local[field]
    setLocal(prev => ({ ...prev, [field]: value }))
    await updateIssueField(local.id, { [field]: value } as Partial<Issue>)
    await logActivity(local.id, reporterName, `changed ${field}`, field as string, String(old ?? ''), String(value ?? ''))
    onUpdate({ ...local, [field]: value })
    fetchActivity()
  }

  async function submitComment() {
    if (!newComment.trim()) return
    await supabase.from('issue_comments').insert({ issue_id: issue.id, author_name: reporterName, body: newComment.trim() })
    await logActivity(issue.id, reporterName, 'added a comment')
    setNewComment('')
    fetchComments()
    fetchActivity()
  }

  async function toggleWatcher() {
    if (watching) {
      await supabase.from('issue_watchers').delete().eq('issue_id', issue.id).eq('watcher_name', reporterName)
    } else {
      await supabase.from('issue_watchers').insert({ issue_id: issue.id, watcher_name: reporterName })
    }
    setWatching(!watching)
  }

  async function searchLinks(q: string) {
    setLinkSearch(q)
    if (q.length < 2) { setLinkResults([]); return }
    const { data } = await supabase.from('issues').select('*').ilike('comment', `%${q}%`).neq('id', issue.id).limit(5)
    setLinkResults((data ?? []) as Issue[])
  }

  async function addLink(target: Issue) {
    await supabase.from('issue_links').insert({ issue_id: issue.id, linked_issue_id: target.id, link_type: linkType })
    await logActivity(issue.id, reporterName, `linked issue as ${linkType}`)
    setLinkSearch(''); setLinkResults([])
    fetchLinks()
  }

  async function removeLink(linkId: string) {
    await supabase.from('issue_links').delete().eq('id', linkId)
    fetchLinks()
  }

  const imgUrl = local.screenshot_path ? getScreenshotUrl(local.screenshot_path) : null

  const tabs: { key: typeof activeTab; label: string }[] = [
    { key: 'details',  label: 'Details' },
    { key: 'comments', label: `Comments (${comments.length})` },
    { key: 'activity', label: 'Activity' },
    { key: 'links',    label: `Links (${links.length})` },
  ]

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-gray-900 rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-800">
          <div className="flex-1 min-w-0 pr-4">
            <input
              className="w-full bg-transparent text-white font-semibold text-base outline-none border-b border-transparent hover:border-gray-600 focus:border-indigo-500 pb-1 transition-colors"
              value={local.title ?? ''}
              placeholder="Add a title…"
              onChange={e => setLocal(p => ({ ...p, title: e.target.value }))}
              onBlur={e => handleFieldChange('title', e.target.value || null)}
            />
            <a href={local.url} target="_blank" rel="noreferrer" className="text-xs text-indigo-400 hover:text-indigo-300 truncate block mt-1">{local.url}</a>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={toggleWatcher} className={`text-xs px-2.5 py-1 rounded border transition-colors ${watching ? 'border-indigo-500 text-indigo-300 bg-indigo-900/30' : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}>
              {watching ? '👁 Watching' : 'Watch'}
            </button>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-xl leading-none">×</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800 px-5">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`px-3 py-2.5 text-xs font-medium border-b-2 transition-colors ${activeTab === t.key ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 p-5">

          {/* DETAILS TAB */}
          {activeTab === 'details' && (
            <div className="space-y-4">
              {/* Fields grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Status</label>
                  <select value={local.status} onChange={e => handleFieldChange('status', e.target.value as IssueStatus)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-md px-2 py-1.5 text-xs text-gray-200 outline-none">
                    {ALL_STATUSES.map(s => <option key={s} value={s} className="bg-gray-900">{s.replace('_',' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Priority</label>
                  <select value={local.priority} onChange={e => handleFieldChange('priority', e.target.value as IssuePriority)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-md px-2 py-1.5 text-xs text-gray-200 outline-none">
                    {ALL_PRIORITIES.map(p => <option key={p} value={p} className="bg-gray-900">{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Assignee</label>
                  <select value={local.assignee ?? ''} onChange={e => handleFieldChange('assignee', e.target.value || null)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-md px-2 py-1.5 text-xs text-gray-200 outline-none">
                    <option value="">Unassigned</option>
                    {teamMembers.map(m => <option key={m.id} value={m.name} className="bg-gray-900">{m.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Due Date</label>
                  <input type="date" value={local.due_date ?? ''} onChange={e => handleFieldChange('due_date', e.target.value || null)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-md px-2 py-1.5 text-xs text-gray-200 outline-none" />
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="text-xs text-gray-500 block mb-1">Tags</label>
                <TagEditor tags={local.tags ?? []} onChange={tags => handleFieldChange('tags', tags)} />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs text-gray-500 block mb-1">Description</label>
                <textarea
                  className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-200 outline-none focus:border-indigo-500 resize-none"
                  rows={3}
                  value={local.comment}
                  onChange={e => setLocal(p => ({ ...p, comment: e.target.value }))}
                  onBlur={e => handleFieldChange('comment', e.target.value)}
                />
              </div>

              {/* Screenshot */}
              {imgUrl && (
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Screenshot</label>
                  <img src={imgUrl} alt="Screenshot" className="w-full rounded-lg border border-gray-700" />
                  {local.x != null && (
                    <p className="text-xs text-gray-600 mt-1">Selection: {local.width}×{local.height}px at ({local.x}, {local.y})</p>
                  )}
                </div>
              )}

              <div className="text-xs text-gray-600">
                Reported by {local.reporter_name} · {new Date(local.created_at).toLocaleString()}
              </div>
            </div>
          )}

          {/* COMMENTS TAB */}
          {activeTab === 'comments' && (
            <div className="space-y-4">
              {comments.length === 0 && <p className="text-gray-600 text-sm">No comments yet.</p>}
              {comments.map(c => (
                <div key={c.id} className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-indigo-800 flex items-center justify-center text-xs font-bold text-indigo-200 shrink-0">
                    {c.author_name[0].toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-gray-300">{c.author_name}</span>
                      <span className="text-xs text-gray-600">{new Date(c.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-gray-200 bg-gray-800 rounded-lg px-3 py-2">{c.body}</p>
                  </div>
                </div>
              ))}
              <div className="flex gap-2 pt-2 border-t border-gray-800">
                <textarea
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 outline-none focus:border-indigo-500 resize-none"
                  rows={2}
                  placeholder="Add a comment…"
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment() } }}
                />
                <button onClick={submitComment} className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 rounded-lg transition-colors">
                  Post
                </button>
              </div>
            </div>
          )}

          {/* ACTIVITY TAB */}
          {activeTab === 'activity' && (
            <div className="space-y-2">
              {activities.length === 0 && <p className="text-gray-600 text-sm">No activity yet.</p>}
              {activities.map(a => (
                <div key={a.id} className="flex items-start gap-2 text-xs text-gray-400">
                  <span className="text-gray-600 shrink-0">{new Date(a.created_at).toLocaleString()}</span>
                  <span><span className="text-gray-300 font-medium">{a.actor_name}</span> {a.action}
                    {a.field && a.old_value !== null && (
                      <span className="text-gray-500"> · {a.old_value || '—'} → <span className="text-gray-300">{a.new_value || '—'}</span></span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* LINKS TAB */}
          {activeTab === 'links' && (
            <div className="space-y-4">
              {links.length === 0 && <p className="text-gray-600 text-sm">No linked issues.</p>}
              {links.map(l => (
                <div key={l.id} className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2">
                  <div>
                    <span className="text-xs text-indigo-400 mr-2">{l.link_type}</span>
                    <span className="text-sm text-gray-200">{(l.linked_issue as Issue)?.title || (l.linked_issue as Issue)?.comment?.slice(0, 60) || l.linked_issue_id}</span>
                  </div>
                  <button onClick={() => removeLink(l.id)} className="text-xs text-gray-600 hover:text-red-400">Remove</button>
                </div>
              ))}

              <div className="border-t border-gray-800 pt-3">
                <div className="flex gap-2 mb-2">
                  <select value={linkType} onChange={e => setLinkType(e.target.value)}
                    className="bg-gray-800 border border-gray-700 rounded-md px-2 py-1.5 text-xs text-gray-200 outline-none">
                    {LINK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-md px-2 py-1.5 text-xs text-gray-200 outline-none focus:border-indigo-500"
                    placeholder="Search issue to link…"
                    value={linkSearch}
                    onChange={e => searchLinks(e.target.value)}
                  />
                </div>
                {linkResults.map(r => (
                  <button key={r.id} onClick={() => addLink(r)}
                    className="w-full text-left text-xs text-gray-300 bg-gray-800 hover:bg-gray-700 rounded px-3 py-2 mb-1 truncate">
                    {r.title || r.comment?.slice(0, 80)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function TagEditor({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [input, setInput] = useState('')

  function add() {
    const val = input.trim().replace(/^#/, '')
    if (val && !tags.includes(val)) { onChange([...tags, val]) }
    setInput('')
  }

  return (
    <div className="flex flex-wrap gap-1.5 bg-gray-800 border border-gray-700 rounded-md px-2 py-1.5 min-h-[34px]">
      {tags.map(t => (
        <span key={t} className="inline-flex items-center gap-1 bg-indigo-900/60 text-indigo-300 text-xs px-2 py-0.5 rounded-full">
          #{t}
          <button onClick={() => onChange(tags.filter(x => x !== t))} className="hover:text-red-400">×</button>
        </span>
      ))}
      <input
        className="bg-transparent text-xs text-gray-200 outline-none min-w-[80px]"
        placeholder="Add tag…"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add() } }}
        onBlur={add}
      />
    </div>
  )
}
