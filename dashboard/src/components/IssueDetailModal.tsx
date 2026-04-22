import React, { useEffect, useState } from 'react'
import {
  Issue, IssueComment, ActivityLog, IssueLink,
  IssuePriority, IssueStatus, TeamMember,
  supabase, getScreenshotUrl, updateIssueField, logActivity
} from '../lib/supabase'
import StatusBadge from './StatusBadge'
import PriorityBadge from './PriorityBadge'

interface Props {
  issue: Issue
  teamMembers: TeamMember[]
  reporterName: string
  onClose: () => void
  onUpdate: (updated: Issue) => void
}

const ALL_STATUSES:   IssueStatus[]   = ['new','discussed','in_progress','done','wont_fix']
const ALL_PRIORITIES: IssuePriority[] = ['critical','high','medium','low']
const STATUS_LABELS:  Record<IssueStatus,string>   = { new:'New', discussed:'Discussed', in_progress:'In Progress', done:'Done', wont_fix:'Not an Issue' }
const PRIORITY_LABELS:Record<IssuePriority,string> = { critical:'Critical', high:'High', medium:'Medium', low:'Low' }
const LINK_TYPES = ['duplicate','blocks','blocked_by','related']

type Tab = 'details' | 'comments' | 'activity' | 'links'

export default function IssueDetailModal({ issue, teamMembers, reporterName, onClose, onUpdate }: Props) {
  const [comments,   setComments]   = useState<IssueComment[]>([])
  const [activities, setActivities] = useState<ActivityLog[]>([])
  const [links,      setLinks]      = useState<IssueLink[]>([])
  const [newComment, setNewComment] = useState('')
  const [watching,   setWatching]   = useState(false)
  const [linkSearch, setLinkSearch] = useState('')
  const [linkResults,setLinkResults]= useState<Issue[]>([])
  const [linkType,   setLinkType]   = useState('related')
  const [tab,        setTab]        = useState<Tab>('details')
  const [local,      setLocal]      = useState<Issue>(issue)

  useEffect(() => {
    fetchComments(); fetchActivity(); fetchLinks(); checkWatcher()
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
    const { data } = await supabase.from('issue_links')
      .select('*, linked_issue:issues!issue_links_linked_issue_id_fkey(*)')
      .eq('issue_id', issue.id)
    setLinks(data ?? [])
  }
  async function checkWatcher() {
    const { data } = await supabase.from('issue_watchers').select('id').eq('issue_id', issue.id).eq('watcher_name', reporterName).single()
    setWatching(!!data)
  }

  async function handleField<K extends keyof Issue>(field: K, value: Issue[K]) {
    const old = local[field]
    setLocal(p => ({ ...p, [field]: value }))
    await updateIssueField(local.id, { [field]: value } as Partial<Issue>)
    await logActivity(local.id, reporterName, `changed ${field}`, field as string, String(old ?? ''), String(value ?? ''))
    onUpdate({ ...local, [field]: value })
    fetchActivity()
  }

  async function submitComment() {
    if (!newComment.trim()) return
    await supabase.from('issue_comments').insert({ issue_id: issue.id, author_name: reporterName, body: newComment.trim() })
    await logActivity(issue.id, reporterName, 'added a comment')
    setNewComment(''); fetchComments(); fetchActivity()
  }

  async function toggleWatcher() {
    if (watching) await supabase.from('issue_watchers').delete().eq('issue_id', issue.id).eq('watcher_name', reporterName)
    else await supabase.from('issue_watchers').insert({ issue_id: issue.id, watcher_name: reporterName })
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
    setLinkSearch(''); setLinkResults([]); fetchLinks()
  }

  const imgUrl = local.screenshot_path ? getScreenshotUrl(local.screenshot_path) : null

  const tabs: { key: Tab; label: string }[] = [
    { key: 'details',  label: 'Details' },
    { key: 'comments', label: `Comments${comments.length ? ` (${comments.length})` : ''}` },
    { key: 'activity', label: 'Activity' },
    { key: 'links',    label: `Links${links.length ? ` (${links.length})` : ''}` },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-2xl max-h-[88vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: '#111113', border: '1px solid rgba(255,255,255,0.08)' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-6 pt-5 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <input
                className="w-full bg-transparent text-white font-semibold text-[15px] outline-none placeholder-white/20 pb-0.5"
                style={{ borderBottom: '1px solid transparent' }}
                onFocus={e => { e.target.style.borderBottomColor = 'rgba(99,102,241,0.5)' }}
                onBlur={e => { e.target.style.borderBottomColor = 'transparent'; handleField('title', e.target.value || null) }}
                value={local.title ?? ''}
                placeholder="Add a title..."
                onChange={e => setLocal(p => ({ ...p, title: e.target.value }))}
              />
              <a href={local.url} target="_blank" rel="noreferrer"
                className="text-xs mt-1.5 block truncate"
                style={{ color: 'rgba(255,255,255,0.3)' }}>
                {local.url}
              </a>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={toggleWatcher}
                className="text-xs px-3 py-1.5 rounded-lg transition-all font-medium"
                style={{
                  background: watching ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.05)',
                  border: watching ? '1px solid rgba(99,102,241,0.4)' : '1px solid rgba(255,255,255,0.08)',
                  color: watching ? '#a5b4fc' : 'rgba(255,255,255,0.4)'
                }}>
                {watching ? 'Watching' : 'Watch'}
              </button>
              <button onClick={onClose}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors text-sm font-light"
                style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)' }}>
                ✕
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex px-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="px-1 py-3 mr-5 text-xs font-medium transition-colors"
              style={{
                borderBottom: tab === t.key ? '2px solid #6366f1' : '2px solid transparent',
                color: tab === t.key ? '#a5b4fc' : 'rgba(255,255,255,0.35)',
                marginBottom: '-1px'
              }}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">

          {/* DETAILS */}
          {tab === 'details' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Status', field: 'status' as keyof Issue, options: ALL_STATUSES, labels: STATUS_LABELS },
                  { label: 'Priority', field: 'priority' as keyof Issue, options: ALL_PRIORITIES, labels: PRIORITY_LABELS },
                ].map(({ label, field, options, labels }) => (
                  <div key={field}>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{label}</label>
                    <select value={String(local[field] ?? '')} onChange={e => handleField(field, e.target.value as Issue[typeof field])}
                      className="w-full rounded-lg px-3 py-2 text-xs font-medium outline-none transition-colors cursor-pointer"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#e5e7eb' }}>
                      {options.map(o => <option key={o} value={o} style={{ background: '#1a1a1c' }}>{(labels as Record<string,string>)[o]}</option>)}
                    </select>
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Assignee</label>
                  <select value={local.assignee ?? ''} onChange={e => handleField('assignee', e.target.value || null)}
                    className="w-full rounded-lg px-3 py-2 text-xs outline-none cursor-pointer"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#e5e7eb' }}>
                    <option value="" style={{ background: '#1a1a1c' }}>Unassigned</option>
                    {teamMembers.map(m => <option key={m.id} value={m.name} style={{ background: '#1a1a1c' }}>{m.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Due Date</label>
                  <input type="date" value={local.due_date ?? ''} onChange={e => handleField('due_date', e.target.value || null)}
                    className="w-full rounded-lg px-3 py-2 text-xs outline-none"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#e5e7eb' }} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Description</label>
                <textarea rows={4}
                  className="w-full rounded-lg px-3 py-2.5 text-sm outline-none resize-none transition-colors"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#e5e7eb', lineHeight: '1.6' }}
                  value={local.comment}
                  onChange={e => setLocal(p => ({ ...p, comment: e.target.value }))}
                  onBlur={e => handleField('comment', e.target.value)}
                  onFocus={e => { (e.target as HTMLTextAreaElement).style.borderColor = 'rgba(99,102,241,0.4)' }}
                />
              </div>

              {imgUrl && (
                <div>
                  <label className="block text-xs font-medium mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>Screenshot</label>
                  <img src={imgUrl} alt="Screenshot" className="w-full rounded-xl" style={{ border: '1px solid rgba(255,255,255,0.08)' }} />
                </div>
              )}

              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
                Reported by {local.reporter_name} · {new Date(local.created_at).toLocaleString()}
              </p>
            </>
          )}

          {/* COMMENTS */}
          {tab === 'comments' && (
            <div className="space-y-4">
              {comments.length === 0 && <p className="text-sm" style={{ color: 'rgba(255,255,255,0.25)' }}>No comments yet.</p>}
              {comments.map(c => (
                <div key={c.id} className="flex gap-3">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
                    style={{ background: 'rgba(99,102,241,0.2)', color: '#a5b4fc' }}>
                    {c.author_name[0].toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-medium text-white/70">{c.author_name}</span>
                      <span className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>{new Date(c.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-sm rounded-xl px-3.5 py-2.5" style={{ background: 'rgba(255,255,255,0.05)', color: '#d1d5db', lineHeight: '1.6' }}>{c.body}</p>
                  </div>
                </div>
              ))}
              <div className="flex gap-2 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <textarea rows={2} placeholder="Write a comment..."
                  className="flex-1 rounded-xl px-3 py-2.5 text-sm outline-none resize-none"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#e5e7eb' }}
                  value={newComment} onChange={e => setNewComment(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment() } }} />
                <button onClick={submitComment}
                  className="px-4 rounded-xl text-xs font-medium transition-colors self-end pb-2.5 pt-2.5"
                  style={{ background: '#6366f1', color: '#fff' }}>
                  Post
                </button>
              </div>
            </div>
          )}

          {/* ACTIVITY */}
          {tab === 'activity' && (
            <div className="space-y-1">
              {activities.length === 0 && <p className="text-sm" style={{ color: 'rgba(255,255,255,0.25)' }}>No activity yet.</p>}
              {activities.map(a => (
                <div key={a.id} className="flex items-start gap-3 py-1.5">
                  <span className="text-xs shrink-0 tabular-nums" style={{ color: 'rgba(255,255,255,0.2)', paddingTop: '1px' }}>
                    {new Date(a.created_at).toLocaleString()}
                  </span>
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
                    <span className="text-white/70 font-medium">{a.actor_name}</span> {a.action}
                    {a.field && a.old_value !== null && (
                      <span style={{ color: 'rgba(255,255,255,0.25)' }}> · {a.old_value || '—'} <span style={{ color: 'rgba(255,255,255,0.15)' }}>→</span> <span className="text-white/50">{a.new_value || '—'}</span></span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* LINKS */}
          {tab === 'links' && (
            <div className="space-y-3">
              {links.length === 0 && <p className="text-sm" style={{ color: 'rgba(255,255,255,0.25)' }}>No linked issues.</p>}
              {links.map(l => (
                <div key={l.id} className="flex items-center justify-between rounded-xl px-4 py-3"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-md shrink-0"
                      style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc' }}>{l.link_type}</span>
                    <span className="text-sm truncate" style={{ color: '#d1d5db' }}>
                      {(l.linked_issue as Issue)?.title || (l.linked_issue as Issue)?.comment?.slice(0, 60)}
                    </span>
                  </div>
                  <button onClick={async () => { await supabase.from('issue_links').delete().eq('id', l.id); fetchLinks() }}
                    className="text-xs ml-3 shrink-0 transition-colors" style={{ color: 'rgba(255,255,255,0.2)' }}
                    onMouseEnter={e => { (e.target as HTMLButtonElement).style.color = '#f87171' }}
                    onMouseLeave={e => { (e.target as HTMLButtonElement).style.color = 'rgba(255,255,255,0.2)' }}>
                    Remove
                  </button>
                </div>
              ))}

              <div className="pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex gap-2 mb-2">
                  <select value={linkType} onChange={e => setLinkType(e.target.value)}
                    className="rounded-lg px-2.5 py-2 text-xs outline-none cursor-pointer"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#e5e7eb' }}>
                    {LINK_TYPES.map(t => <option key={t} value={t} style={{ background: '#1a1a1c' }}>{t}</option>)}
                  </select>
                  <input placeholder="Search issue to link..."
                    className="flex-1 rounded-lg px-3 py-2 text-xs outline-none"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#e5e7eb' }}
                    value={linkSearch} onChange={e => searchLinks(e.target.value)} />
                </div>
                {linkResults.map(r => (
                  <button key={r.id} onClick={() => addLink(r)}
                    className="w-full text-left text-xs rounded-lg px-3 py-2.5 mb-1 truncate transition-colors"
                    style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.06)' }}>
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
