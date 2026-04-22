import { saveIssue, IssueStatus } from '../lib/supabase'
import { getReporterName, setReporterName } from '../lib/storage'

interface Rect { x: number; y: number; width: number; height: number }

const STATUS_OPTIONS: { value: IssueStatus; label: string; color: string }[] = [
  { value: 'new',         label: 'New',         color: '#6b7280' },
  { value: 'discussed',   label: 'Discussed',   color: '#3b82f6' },
  { value: 'in_progress', label: 'In Progress', color: '#f59e0b' },
  { value: 'done',        label: 'Done',        color: '#10b981' },
  { value: 'wont_fix',    label: "Won't Fix",   color: '#ef4444' },
]

export function showCommentBox(rect: Rect, screenshotBlob: Blob | null, onDone: () => void) {
  // Draw a persistent highlight rectangle showing the selected area
  const highlight = document.createElement('div')
  highlight.style.cssText = `
    position: fixed; left: ${rect.x}px; top: ${rect.y}px;
    width: ${rect.width}px; height: ${rect.height}px;
    border: 2px solid #6366f1; background: rgba(99,102,241,0.1);
    pointer-events: none; z-index: 2147483645;
  `
  document.body.appendChild(highlight)

  const box = document.createElement('div')
  const boxLeft = Math.min(rect.x, window.innerWidth - 340)
  const boxTop = rect.y + rect.height + 10 > window.innerHeight - 200
    ? rect.y - 210
    : rect.y + rect.height + 10

  box.style.cssText = `
    position: fixed; left: ${Math.max(8, boxLeft)}px; top: ${Math.max(8, boxTop)}px;
    width: 320px; background: #1e1e1e; border-radius: 10px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4); z-index: 2147483647;
    font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    padding: 12px;
  `

  const statusOptions = STATUS_OPTIONS.map(s =>
    `<option value="${s.value}">${s.label}</option>`
  ).join('')

  box.innerHTML = `
    <div style="color:#9ca3af;font-size:11px;margin-bottom:8px;font-weight:500;text-transform:uppercase;letter-spacing:.5px">
      Add Issue
    </div>
    <textarea id="pit-comment" placeholder="Describe the issue…" rows="3" style="
      width:100%;background:#2d2d2d;color:#e5e7eb;border:1px solid #3f3f3f;
      border-radius:6px;padding:8px;font-size:13px;resize:none;outline:none;
      font-family:inherit;line-height:1.4;
    "></textarea>
    <div style="display:flex;gap:8px;margin-top:8px;align-items:center;">
      <select id="pit-status" style="
        flex:1;background:#2d2d2d;color:#e5e7eb;border:1px solid #3f3f3f;
        border-radius:6px;padding:6px 8px;font-size:12px;outline:none;cursor:pointer;
      ">${statusOptions}</select>
      <button id="pit-cancel" style="
        background:transparent;color:#9ca3af;border:1px solid #3f3f3f;
        border-radius:6px;padding:6px 12px;font-size:12px;cursor:pointer;
      ">Cancel</button>
      <button id="pit-save" style="
        background:#6366f1;color:#fff;border:none;
        border-radius:6px;padding:6px 12px;font-size:12px;cursor:pointer;font-weight:500;
      ">Save ↵</button>
    </div>
    <div id="pit-msg" style="font-size:11px;margin-top:6px;color:#10b981;display:none;"></div>
  `

  document.body.appendChild(box)

  const textarea = box.querySelector<HTMLTextAreaElement>('#pit-comment')!
  const statusSelect = box.querySelector<HTMLSelectElement>('#pit-status')!
  const saveBtn = box.querySelector<HTMLButtonElement>('#pit-save')!
  const cancelBtn = box.querySelector<HTMLButtonElement>('#pit-cancel')!
  const msg = box.querySelector<HTMLDivElement>('#pit-msg')!

  textarea.focus()

  function cleanup() {
    box.remove(); highlight.remove()
    onDone()
  }

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

    const { error } = await saveIssue({
      url: window.location.href,
      page_title: document.title,
      comment,
      status: statusSelect.value as IssueStatus,
      reporter_name: reporterName,
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      screenshotBlob: screenshotBlob,
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

  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
    if (e.key === 'Escape') cleanup()
  })
}
