import { showCommentBox } from './CommentBox'

interface Rect { x: number; y: number; width: number; height: number }

export function startSelector(onDone: () => void) {
  const overlay = document.createElement('div')
  overlay.id = 'pit-overlay'
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 2147483646;
    cursor: crosshair; background: rgba(0,0,0,0.25);
  `

  const hint = document.createElement('div')
  hint.style.cssText = `
    position: fixed; top: 12px; left: 50%; transform: translateX(-50%);
    background: #1e1e1e; color: #fff; padding: 6px 14px; border-radius: 6px;
    font: 13px/1.4 -apple-system,sans-serif; pointer-events: none; z-index: 2147483647;
  `
  hint.textContent = 'Drag to select area — Esc to cancel'
  document.body.appendChild(overlay)
  document.body.appendChild(hint)

  const box = document.createElement('div')
  box.style.cssText = `
    position: fixed; border: 2px solid #6366f1; background: rgba(99,102,241,0.15);
    pointer-events: none; z-index: 2147483647; display: none;
  `
  document.body.appendChild(box)

  let startX = 0, startY = 0
  let dragging = false

  function cleanup() {
    overlay.remove(); hint.remove(); box.remove()
    document.removeEventListener('keydown', onEsc)
  }

  function onEsc(e: KeyboardEvent) {
    if (e.key === 'Escape') { cleanup(); onDone() }
  }
  document.addEventListener('keydown', onEsc)

  overlay.addEventListener('mousedown', (e) => {
    dragging = true
    startX = e.clientX; startY = e.clientY
    box.style.display = 'block'
    updateBox(e.clientX, e.clientY)
  })

  overlay.addEventListener('mousemove', (e) => {
    if (!dragging) return
    updateBox(e.clientX, e.clientY)
  })

  overlay.addEventListener('mouseup', (e) => {
    if (!dragging) return
    dragging = false
    const rect = getRect(startX, startY, e.clientX, e.clientY)
    if (rect.width < 10 || rect.height < 10) {
      cleanup(); onDone(); return
    }
    cleanup()
    // Small delay so screenshot doesn't capture the overlay
    setTimeout(() => {
      captureAndShow(rect, onDone)
    }, 80)
  })

  function updateBox(cx: number, cy: number) {
    const r = getRect(startX, startY, cx, cy)
    box.style.left = r.x + 'px'
    box.style.top = r.y + 'px'
    box.style.width = r.width + 'px'
    box.style.height = r.height + 'px'
  }
}

function getRect(x1: number, y1: number, x2: number, y2: number): Rect {
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  }
}

function captureAndShow(rect: Rect, onDone: () => void) {
  chrome.runtime.sendMessage({ type: 'CAPTURE_SCREENSHOT' }, (response: { dataUrl?: string }) => {
    let croppedBlob: Blob | null = null

    const finish = (blob: Blob | null) => {
      showCommentBox(rect, blob, onDone)
    }

    if (response?.dataUrl) {
      cropScreenshot(response.dataUrl, rect).then(blob => {
        if (!blob) { finish(null); return }
        import('./Annotator').then(({ openAnnotator }) => {
          openAnnotator(blob, finish, () => finish(blob))
        }).catch(() => finish(blob))
      }).catch(() => finish(null))
    } else {
      finish(null)
    }
  })
}

async function cropScreenshot(dataUrl: string, rect: Rect): Promise<Blob | null> {
  const dpr = window.devicePixelRatio || 1
  const img = new Image()
  await new Promise<void>((res, rej) => {
    img.onload = () => res()
    img.onerror = rej
    img.src = dataUrl
  })
  const canvas = document.createElement('canvas')
  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, rect.x * dpr, rect.y * dpr, rect.width * dpr, rect.height * dpr, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
}
