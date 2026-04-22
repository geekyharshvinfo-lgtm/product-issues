import React, { useEffect, useState } from 'react'
import { getReporterName, setReporterName } from '../lib/storage'

export default function Options() {
  const [name, setName]     = useState('')
  const [saved, setSaved]   = useState(false)

  useEffect(() => {
    getReporterName().then(n => setName(n ?? ''))
  }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    await setReporterName(name.trim())
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const s = {
    h1:    { fontSize:'20px', fontWeight:600, color:'#fff', marginBottom:'4px' } as React.CSSProperties,
    sub:   { fontSize:'13px', color:'#6b7280', marginBottom:'32px' } as React.CSSProperties,
    label: { display:'block', fontSize:'12px', color:'#9ca3af', marginBottom:'6px', textTransform:'uppercase' as const, letterSpacing:'.5px' },
    input: { width:'100%', background:'#1e1e1e', border:'1px solid #3f3f3f', borderRadius:'8px', color:'#e5e7eb', padding:'10px 12px', fontSize:'14px', outline:'none' } as React.CSSProperties,
    btn:   { background:'#6366f1', color:'#fff', border:'none', borderRadius:'8px', padding:'10px 20px', fontSize:'13px', cursor:'pointer', fontWeight:500, marginTop:'12px' } as React.CSSProperties,
    card:  { background:'#1a1a1a', border:'1px solid #2d2d2d', borderRadius:'10px', padding:'20px', marginBottom:'20px' } as React.CSSProperties,
    row:   { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid #2d2d2d' } as React.CSSProperties,
    key:   { background:'#2d2d2d', color:'#a5b4fc', border:'1px solid #4f46e5', borderRadius:'4px', padding:'3px 8px', fontSize:'12px', fontFamily:'monospace' } as React.CSSProperties,
  }

  return (
    <div>
      <h1 style={s.h1}>Product Issue Tracker</h1>
      <p style={s.sub}>Extension Settings</p>

      {/* Identity */}
      <div style={s.card}>
        <label style={s.label}>Your Name</label>
        <form onSubmit={save}>
          <input style={s.input} value={name} onChange={e => setName(e.target.value)} placeholder="Enter your name" />
          <button type="submit" style={s.btn}>{saved ? 'Saved ✓' : 'Save'}</button>
        </form>
      </div>

      {/* Keyboard shortcuts — read-only display (Chrome manages them) */}
      <div style={s.card}>
        <label style={s.label}>Keyboard Shortcuts</label>
        <p style={{ fontSize:'12px', color:'#6b7280', marginBottom:'12px' }}>
          Shortcuts are managed by Chrome. Click below to customise them.
        </p>
        <div style={s.row}>
          <span style={{ fontSize:'13px', color:'#d1d5db' }}>Activate selector</span>
          <span style={s.key}>Ctrl+Shift+X</span>
        </div>
        <a
          href="chrome://extensions/shortcuts"
          onClick={e => { e.preventDefault(); chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }) }}
          style={{ display:'inline-block', marginTop:'12px', fontSize:'12px', color:'#6366f1', cursor:'pointer', textDecoration:'none' }}
        >
          Open Chrome shortcut settings →
        </a>
      </div>

      {/* Dashboard link */}
      <div style={s.card}>
        <label style={s.label}>Dashboard</label>
        <a href="https://product-issues.vercel.app" target="_blank" rel="noreferrer"
          style={{ fontSize:'13px', color:'#6366f1' }}>
          product-issues.vercel.app →
        </a>
      </div>
    </div>
  )
}
