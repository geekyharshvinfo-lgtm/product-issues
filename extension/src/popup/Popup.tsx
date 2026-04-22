import React, { useEffect, useState } from 'react'
import { supabase, Issue, IssueStatus } from '../lib/supabase'
import { getReporterName, setReporterName } from '../lib/storage'

const STATUS_COLORS: Record<IssueStatus, string> = {
  new: '#6b7280',
  discussed: '#3b82f6',
  in_progress: '#f59e0b',
  done: '#10b981',
  wont_fix: '#ef4444',
}

export default function Popup() {
  const [issues, setIssues] = useState<Issue[]>([])
  const [name, setName] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [loading, setLoading] = useState(true)
  const [currentUrl, setCurrentUrl] = useState('')

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const url = tabs[0]?.url ?? ''
      setCurrentUrl(url)

      const reporterName = await getReporterName()
      if (reporterName) {
        setName(reporterName)
      } else {
        setEditingName(true)
      }

      const { data } = await supabase
        .from('issues')
        .select('*')
        .eq('url', url)
        .order('created_at', { ascending: false })
        .limit(5)

      setIssues(data ?? [])
      setLoading(false)
    })
  }, [])

  async function saveName(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    await setReporterName(name.trim())
    setEditingName(false)
  }

  function activateSelector() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'ACTIVATE_SELECTOR' })
        window.close()
      }
    })
  }

  const styles = {
    root: { fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif', background: '#0f0f0f', color: '#e5e7eb', minHeight: '200px' },
    header: { padding: '14px 16px 10px', borderBottom: '1px solid #1f1f1f' },
    title: { fontSize: '14px', fontWeight: 600, color: '#fff' },
    sub: { fontSize: '11px', color: '#6b7280', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
    btn: { width: '100%', background: '#6366f1', color: '#fff', border: 'none', borderRadius: '7px', padding: '9px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', marginTop: '10px' },
    nameRow: { display: 'flex', gap: '6px', alignItems: 'center' },
    input: { flex: 1, background: '#1e1e1e', border: '1px solid #3f3f3f', borderRadius: '6px', color: '#e5e7eb', padding: '6px 8px', fontSize: '12px', outline: 'none' },
    smBtn: { background: '#6366f1', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 10px', fontSize: '12px', cursor: 'pointer' },
    issueItem: { padding: '10px 16px', borderBottom: '1px solid #1a1a1a' },
    statusDot: (s: IssueStatus) => ({ display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', background: STATUS_COLORS[s], marginRight: '6px' }),
    comment: { fontSize: '12px', color: '#e5e7eb', lineHeight: 1.4 },
    meta: { fontSize: '10px', color: '#6b7280', marginTop: '3px' },
    dashLink: { display: 'block', textAlign: 'center' as const, padding: '8px', fontSize: '11px', color: '#6366f1', textDecoration: 'none', borderTop: '1px solid #1a1a1a' },
  }

  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <div style={styles.title}>Product Issue Tracker</div>
        <div style={styles.sub}>{currentUrl || 'No active tab'}</div>

        {editingName ? (
          <form onSubmit={saveName} style={{ marginTop: '10px' }}>
            <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '4px' }}>Enter your name to get started</div>
            <div style={styles.nameRow}>
              <input style={styles.input} value={name} onChange={e => setName(e.target.value)} placeholder="Your name" autoFocus />
              <button type="submit" style={styles.smBtn}>Set</button>
            </div>
          </form>
        ) : (
          <>
            <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
              Reporting as <span style={{ color: '#a5b4fc', cursor: 'pointer' }} onClick={() => setEditingName(true)}>{name}</span>
            </div>
            <button style={styles.btn} onClick={activateSelector}>
              + Capture Issue (Ctrl+Shift+X)
            </button>
          </>
        )}
      </div>

      {!editingName && (
        <>
          <div style={{ padding: '10px 16px 4px', fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.5px' }}>
            Recent on this page ({issues.length})
          </div>

          {loading ? (
            <div style={{ padding: '12px 16px', fontSize: '12px', color: '#6b7280' }}>Loading…</div>
          ) : issues.length === 0 ? (
            <div style={{ padding: '12px 16px', fontSize: '12px', color: '#4b5563' }}>No issues captured on this page yet.</div>
          ) : (
            issues.map(issue => (
              <div key={issue.id} style={styles.issueItem}>
                <div>
                  <span style={styles.statusDot(issue.status)} />
                  <span style={{ fontSize: '11px', color: STATUS_COLORS[issue.status] }}>{issue.status.replace('_', ' ')}</span>
                </div>
                <div style={styles.comment}>{issue.comment}</div>
                <div style={styles.meta}>{issue.reporter_name} · {new Date(issue.created_at).toLocaleDateString()}</div>
              </div>
            ))
          )}

          <a href="https://product-issues.vercel.app" target="_blank" rel="noreferrer" style={styles.dashLink}>
            Open Dashboard →
          </a>
        </>
      )}
    </div>
  )
}
