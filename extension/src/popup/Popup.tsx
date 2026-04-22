import React, { useEffect, useState } from 'react'
import { supabase, Issue, IssueStatus } from '../lib/supabase'
import { getAuthUser, signInWithGoogle, signOut, AuthUser } from '../lib/auth'

const STATUS_COLORS: Record<IssueStatus, string> = {
  new: '#6b7280',
  discussed: '#3b82f6',
  in_progress: '#f59e0b',
  done: '#10b981',
  wont_fix: '#ef4444',
}

const s = {
  root: { fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif', background: '#0f0f0f', color: '#e5e7eb', minHeight: '200px', width: '320px' },
  header: { padding: '14px 16px 10px', borderBottom: '1px solid #1f1f1f' },
  title: { fontSize: '14px', fontWeight: 600, color: '#fff' },
  sub: { fontSize: '11px', color: '#6b7280', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  btn: { width: '100%', background: '#6366f1', color: '#fff', border: 'none', borderRadius: '7px', padding: '9px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', marginTop: '10px' },
  googleBtn: { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'rgba(255,255,255,0.06)', color: '#e5e7eb', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '7px', padding: '9px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', marginTop: '10px' },
  issueItem: { padding: '10px 16px', borderBottom: '1px solid #1a1a1a' },
  statusDot: (st: IssueStatus) => ({ display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', background: STATUS_COLORS[st], marginRight: '6px' }),
  comment: { fontSize: '12px', color: '#e5e7eb', lineHeight: 1.4 },
  meta: { fontSize: '10px', color: '#6b7280', marginTop: '3px' },
  dashLink: { display: 'block', textAlign: 'center' as const, padding: '8px', fontSize: '11px', color: '#6366f1', textDecoration: 'none', borderTop: '1px solid #1a1a1a' },
}

export default function Popup() {
  const [user,       setUser]       = useState<AuthUser | null | undefined>(undefined)
  const [issues,     setIssues]     = useState<Issue[]>([])
  const [loading,    setLoading]    = useState(true)
  const [signingIn,  setSigningIn]  = useState(false)
  const [currentUrl, setCurrentUrl] = useState('')

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, async tabs => {
      const url = tabs[0]?.url ?? ''
      setCurrentUrl(url)

      const authUser = await getAuthUser()
      setUser(authUser)

      if (authUser && url) {
        const { data } = await supabase
          .from('issues')
          .select('*')
          .eq('url', url)
          .order('created_at', { ascending: false })
          .limit(5)
        setIssues(data ?? [])
      }
      setLoading(false)
    })
  }, [])

  async function handleSignIn() {
    setSigningIn(true)
    const authUser = await signInWithGoogle()
    setUser(authUser)
    setSigningIn(false)
    if (authUser && currentUrl) {
      const { data } = await supabase.from('issues').select('*').eq('url', currentUrl).order('created_at', { ascending: false }).limit(5)
      setIssues(data ?? [])
    }
  }

  async function handleSignOut() {
    await signOut()
    setUser(null)
    setIssues([])
  }

  function activateSelector() {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'ACTIVATE_SELECTOR' })
        window.close()
      }
    })
  }

  if (user === undefined) {
    return (
      <div style={{ ...s.root, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '160px' }}>
        <div style={{ width: '16px', height: '16px', border: '2px solid rgba(99,102,241,0.3)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  return (
    <div style={s.root}>
      <div style={s.header}>
        <div style={s.title}>Product Issue Tracker</div>
        <div style={s.sub}>{currentUrl || 'No active tab'}</div>

        {!user ? (
          <button style={s.googleBtn} onClick={handleSignIn} disabled={signingIn}>
            {!signingIn && (
              <svg width="14" height="14" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            {signingIn ? 'Signing in...' : 'Sign in with Google'}
          </button>
        ) : (
          <>
            <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Signed in as <span style={{ color: '#a5b4fc' }}>{user.name}</span></span>
              <button onClick={handleSignOut} style={{ background: 'none', border: 'none', fontSize: '10px', color: '#6b7280', cursor: 'pointer', padding: 0 }}>
                Sign out
              </button>
            </div>
            <button style={s.btn} onClick={activateSelector}>
              + Capture Issue (Ctrl+Shift+X)
            </button>
          </>
        )}
      </div>

      {user && (
        <>
          <div style={{ padding: '10px 16px 4px', fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.5px' }}>
            Recent on this page ({issues.length})
          </div>

          {loading ? (
            <div style={{ padding: '12px 16px', fontSize: '12px', color: '#6b7280' }}>Loading…</div>
          ) : issues.length === 0 ? (
            <div style={{ padding: '12px 16px', fontSize: '12px', color: '#4b5563' }}>No issues on this page yet.</div>
          ) : (
            issues.map(issue => (
              <div key={issue.id} style={s.issueItem}>
                <div>
                  <span style={s.statusDot(issue.status)} />
                  <span style={{ fontSize: '11px', color: STATUS_COLORS[issue.status] }}>{issue.status.replace('_', ' ')}</span>
                </div>
                <div style={s.comment}>{issue.title || issue.comment}</div>
                <div style={s.meta}>{issue.reporter_name} · {new Date(issue.created_at).toLocaleDateString()}</div>
              </div>
            ))
          )}

          <a href="https://product-issues.vercel.app" target="_blank" rel="noreferrer" style={s.dashLink}>
            Open Dashboard →
          </a>
        </>
      )}
    </div>
  )
}
