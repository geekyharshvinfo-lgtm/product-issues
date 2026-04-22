import { saveIssue, IssueStatus } from '../lib/supabase'
import { getReporterName, setReporterName } from '../lib/storage'

interface Rect { x: number; y: number; width: number; height: number }

const STATUS_OPTIONS: { value: IssueStatus; label: string }[] = [
  { value: 'new',         label: 'New' },
  { value: 'discussed',   label: 'Discussed' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'done',        label: 'Done' },
  { value: 'wont_fix',    label: "Won't Fix" },
]

const PRIORITY_OPTIONS = [
  { value: 'critical', label: '🔴 Critical' },
  { value: 'high',     label: '🟠 High' },
  { value: 'medium',   label: '🟡 Medium' },
  { value: 'low',      label: '⚪ Low' },
]

export function showCommentBox(rect: Rect, screenshotBlob: Blob | null, onDone: () => void) {
  const highlight = document.createElement('div')
  highlight.style.cssText = `
    position: fixed; left: ${rect.x}px; top: ${rect.y}px;
    width: ${rect.width}px; height: ${rect.height}px;
    border: 2px solid #6366f1; background: rgba(99,102,241,0.1);
    pointer-events: none; z-index: 2147483645;
  `
  document.body.appendChild(highlight)

  const box = document.createElement('div')
  const boxLeft = Math.min(rect.x, window.innerWidth - 360)
  const boxTop  = rect.y + rect.height + 10 > window.innerHeight - 260
    ? rect.y - 270 : rect.y + rect.height + 10

  box.style.cssText = `
    position: fixed; left: ${Math.max(8, boxLeft)}px; top: ${Math.max(8, boxTop)}px;
    width: 340px; background: #1e1e1e; border-radius: 10px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4); z-index: 2147483647;
    font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    padding: 12px;
  `

  const statusOpts  = STATUS_OPTIONS.map(s  => `<option value="${s.value}">${s.label}</option>`).join('')
  const priorityOpts = PRIORITY_OPTIONS.map(p => `<option value="${p.value}">${p.label}</option>`).join('')

  box.innerHTML = `
    <div style="color:#9ca3af;font-size:11px;margin-bottom:8px;font-weight:500;text-transform:uppercase;letter-spacing:.5px">
      Capture Issue
    </div>
    <input id="pit-title" placeholder="Title (optional)" style="
      width:100%;background:#2d2d2d;color:#e5e7eb;border:1px solid #3f3f3f;
      border-radius:6px;padding:7px 9px;font-size:13px;outline:none;
      font-family:inherit;margin-bottom:7px;
    " />
    <textarea id="pit-comment" placeholder="Describe the issue…" rows="3" style="
      width:100%;background:#2d2d2d;color:#e5e7eb;border:1px solid #3f3f3f;
      border-radius:6px;padding:8px;font-size:13px;resize:none;outline:none;
      font-family:inherit;line-height:1.4;
    "></textarea>
    <div style="display:flex;gap:7px;margin-top:8px;">
      <select id="pit-priority" style="
        flex:1;background:#2d2d2d;color:#e5e7eb;border:1px solid #3f3f3f;
        border-radius:6px;padding:6px 8px;font-size:12px;outline:none;cursor:pointer;
      ">${priorityOpts}</select>
      <select id="pit-status" style="
        flex:1;background:#2d2d2d;color:#e5e7eb;border:1px solid #3f3f3f;
        border-radius:6px;padding:6px 8px;font-size:12px;outline:none;cursor:pointer;
      ">${statusOpts}</select>
    </div>
    <input id="pit-tags" placeholder="Tags (comma separated)" style="
      width:100%;background:#2d2d2d;color:#e5e7eb;border:1px solid #3f3f3f;
      border-radius:6px;padding:7px 9px;font-size:12px;outline:none;
      font-family:inherit;margin-top:7px;
    " />
    <div style="display:flex;gap:8px;margin-top:8px;align-items:center;">
      <button id="pit-cancel" style="
        background:transparent;color:#9ca3af;border:1px solid #3f3f3f;
        border-radius:6px;padding:6px 12px;font-size:12px;cursor:pointer;
      ">Cancel</button>
      <button id="pit-save" style="
        flex:1;background:#6366f1;color:#fff;border:none;
        border-radius:6px;padding:6px 12px;font-size:12px;cursor:pointer;font-weight:500;
      ">Save  ↵</button>
    </div>
    <div id="pit-msg" style="font-size:11px;margin-top:6px;color:#10b981;display:none;"></div>
  `

  document.body.appendChild(box)

  const titleInput   = box.querySelector<HTMLInputElement>('#pit-title')!
  const textarea     = box.querySelector<HTMLTextAreaElement>('#pit-comment')!
  const statusSelect = box.querySelector<HTMLSelectElement>('#pit-status')!
  const prioritySelect = box.querySelector<HTMLSelectElement>('#pit-priority')!
  const tagsInput    = box.querySelector<HTMLInputElement>('#pit-tags')!
  const saveBtn      = box.querySelector<HTMLButtonElement>('#pit-save')!
  const cancelBtn    = box.querySelector<HTMLButtonElement>('#pit-cancel')!
  const msg          = box.querySelector<HTMLDivElement>('#pit-msg')!

  // Default priority to medium
  prioritySelect.value = 'medium'

  titleInput.focus()

  function cleanup() { box.remove(); highlight.remove(); onDone() }

  cancelBtn.addEventListener('click', cleanup)

  async function submit() {
    const comment = textarea.value.trim()
    if (!comment) { textarea.focus(); return }

    saveBtn.disabled = true
    saveBtn.textContent = 'Saving…'

    let reporterName = await getReporterName()
    if (!reporterName) {
      reporterName = prompt('Your name (shown on issues):')?.trim() || 'Anonymous'
      await setReporterName(reporterName)
    }

    const rawTags = tagsInput.value.split(',').map(t => t.trim().replace(/^#/, '')).filter(Boolean)

    const { error } = await saveIssue({
      url:          window.location.href,
      page_title:   document.title,
      title:        titleInput.value.trim() || null,
      comment,
      status:       statusSelect.value as IssueStatus,
      priority:     prioritySelect.value as 'critical'|'high'|'medium'|'low',
      tags:         rawTags,
      reporter_name: reporterName,
      x:            rect.x,
      y:            rect.y,
      width:        rect.width,
      height:       rect.height,
      screenshotBlob,
    })

    if (error) {
      msg.style.color = '#ef4444'
      msg.textContent = 'Failed to save: ' + error.message
      msg.style.display = 'block'
      saveBtn.disabled = false
      saveBtn.textContent = 'Save ↵'
    } else {
      msg.style.color = '#10b981'
      msg.textContent = 'Issue saved ✓'
      msg.style.display = 'block'
      setTimeout(cleanup, 900)
    }
  }

  saveBtn.addEventListener('click', submit)
  textarea.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } })
  titleInput.addEventListener('keydown', e => { if (e.key === 'Escape') cleanup() })
  textarea.addEventListener('keydown',   e => { if (e.key === 'Escape') cleanup() })
}
