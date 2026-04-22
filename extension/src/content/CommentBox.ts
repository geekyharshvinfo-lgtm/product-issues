import { saveIssue, IssueStatus } from '../lib/supabase'

interface Rect { x: number; y: number; width: number; height: number }

export function showCommentBox(rect: Rect, screenshotBlob: Blob | null, onDone: () => void) {
  const highlight = document.createElement('div')
  highlight.style.cssText = `
    position: fixed; left: ${rect.x}px; top: ${rect.y}px;
    width: ${rect.width}px; height: ${rect.height}px;
    border: 2px solid #6366f1; background: rgba(99,102,241,0.08);
    pointer-events: none; z-index: 2147483645;
  `
  document.body.appendChild(highlight)

  const box = document.createElement('div')
  const boxLeft = Math.min(rect.x, window.innerWidth - 360)
  const boxTop  = rect.y + rect.height + 10 > window.innerHeight - 200
    ? rect.y - 210 : rect.y + rect.height + 10

  box.style.cssText = `
    position: fixed; left: ${Math.max(8, boxLeft)}px; top: ${Math.max(8, boxTop)}px;
    width: 340px; background: #141414; border-radius: 12px;
    box-shadow: 0 0 0 1px rgba(255,255,255,0.08), 0 16px 40px rgba(0,0,0,0.6);
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    padding: 16px;
  `

  box.innerHTML = `
    <div style="font-size:11px;font-weight:600;color:#6b7280;letter-spacing:.06em;text-transform:uppercase;margin-bottom:12px;">
      Capture Issue
    </div>
    <input id="pit-title" placeholder="Title" style="
      width:100%;background:#1f1f1f;color:#f3f4f6;
      border:1px solid rgba(255,255,255,0.08);border-radius:8px;
      padding:9px 12px;font-size:13px;outline:none;
      font-family:inherit;margin-bottom:8px;
      transition: border-color 0.15s;
    " />
    <textarea id="pit-comment" placeholder="Describe the issue..." rows="3" style="
      width:100%;background:#1f1f1f;color:#f3f4f6;
      border:1px solid rgba(255,255,255,0.08);border-radius:8px;
      padding:9px 12px;font-size:13px;resize:none;outline:none;
      font-family:inherit;line-height:1.5;
      transition: border-color 0.15s;
    "></textarea>
    <div style="display:flex;gap:8px;margin-top:10px;">
      <button id="pit-cancel" style="
        flex:1;background:transparent;color:#6b7280;
        border:1px solid rgba(255,255,255,0.08);border-radius:8px;
        padding:8px;font-size:12px;cursor:pointer;font-family:inherit;
        transition: color 0.15s;
      ">Cancel</button>
      <button id="pit-save" style="
        flex:2;background:#6366f1;color:#fff;border:none;border-radius:8px;
        padding:8px;font-size:13px;font-weight:500;cursor:pointer;font-family:inherit;
        transition: background 0.15s;
      ">Save</button>
    </div>
    <div id="pit-msg" style="font-size:11px;margin-top:8px;display:none;text-align:center;"></div>
  `

  document.body.appendChild(box)

  const titleInput = box.querySelector<HTMLInputElement>('#pit-title')!
  const textarea   = box.querySelector<HTMLTextAreaElement>('#pit-comment')!
  const saveBtn    = box.querySelector<HTMLButtonElement>('#pit-save')!
  const cancelBtn  = box.querySelector<HTMLButtonElement>('#pit-cancel')!
  const msg        = box.querySelector<HTMLDivElement>('#pit-msg')!

  titleInput.focus()

  // Focus ring styles
  ;[titleInput, textarea].forEach(el => {
    el.addEventListener('focus', () => { el.style.borderColor = 'rgba(99,102,241,0.6)' })
    el.addEventListener('blur',  () => { el.style.borderColor = 'rgba(255,255,255,0.08)' })
  })

  function cleanup() { box.remove(); highlight.remove(); onDone() }

  cancelBtn.addEventListener('click', cleanup)

  async function submit() {
    const comment = textarea.value.trim()
    if (!comment) { textarea.focus(); textarea.style.borderColor = 'rgba(239,68,68,0.6)'; return }

    saveBtn.disabled = true
    saveBtn.textContent = 'Saving...'
    saveBtn.style.background = '#4f46e5'

    const stored = await chrome.storage.local.get('pit_auth_user')
    const authUser = stored['pit_auth_user'] as { name: string; email: string } | null
    const reporterName = authUser?.name || authUser?.email || 'Anonymous'

    const { error } = await saveIssue({
      url:           window.location.href,
      page_title:    document.title,
      title:         titleInput.value.trim() || null,
      comment,
      status:        'new' as IssueStatus,
      priority:      'medium',
      tags:          [],
      reporter_name: reporterName,
      x:             rect.x,
      y:             rect.y,
      width:         rect.width,
      height:        rect.height,
      screenshotBlob,
    })

    if (error) {
      msg.style.color = '#ef4444'
      msg.textContent = 'Failed to save. Try again.'
      msg.style.display = 'block'
      saveBtn.disabled = false
      saveBtn.textContent = 'Save'
      saveBtn.style.background = '#6366f1'
    } else {
      msg.style.color = '#10b981'
      msg.textContent = 'Issue saved'
      msg.style.display = 'block'
      setTimeout(cleanup, 800)
    }
  }

  saveBtn.addEventListener('click', submit)
  textarea.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } })
  ;[titleInput, textarea].forEach(el => el.addEventListener('keydown', e => { if (e.key === 'Escape') cleanup() }))
}
