export function openAnnotator(blob: Blob, onSave: (annotated: Blob) => void, onSkip: () => void) {
  const url = URL.createObjectURL(blob)
  const img = new Image()
  img.onload = () => {
    const overlay = document.createElement('div')
    overlay.style.cssText = `
      position:fixed;inset:0;z-index:2147483647;background:#000;
      display:flex;flex-direction:column;align-items:center;justify-content:center;
    `

    const toolbar = document.createElement('div')
    toolbar.style.cssText = `
      display:flex;gap:8px;margin-bottom:10px;align-items:center;
      font-family:-apple-system,sans-serif;
    `
    toolbar.innerHTML = `
      <button id="ann-arrow"  style="background:#6366f1;color:#fff;border:none;border-radius:6px;padding:6px 12px;font-size:12px;cursor:pointer;">→ Arrow</button>
      <button id="ann-rect"   style="background:#374151;color:#fff;border:none;border-radius:6px;padding:6px 12px;font-size:12px;cursor:pointer;">□ Box</button>
      <button id="ann-circle" style="background:#374151;color:#fff;border:none;border-radius:6px;padding:6px 12px;font-size:12px;cursor:pointer;">○ Circle</button>
      <button id="ann-text"   style="background:#374151;color:#fff;border:none;border-radius:6px;padding:6px 12px;font-size:12px;cursor:pointer;">T Text</button>
      <input  id="ann-color"  type="color" value="#ef4444" style="width:32px;height:32px;border:none;border-radius:4px;cursor:pointer;background:transparent;" />
      <button id="ann-undo"   style="background:#374151;color:#fff;border:none;border-radius:6px;padding:6px 12px;font-size:12px;cursor:pointer;">↩ Undo</button>
      <button id="ann-skip"   style="background:#374151;color:#9ca3af;border:none;border-radius:6px;padding:6px 12px;font-size:12px;cursor:pointer;">Skip</button>
      <button id="ann-save"   style="background:#10b981;color:#fff;border:none;border-radius:6px;padding:6px 14px;font-size:12px;cursor:pointer;font-weight:500;">Save →</button>
    `

    const canvas = document.createElement('canvas')
    const scale = Math.min(1, (window.innerWidth - 40) / img.width, (window.innerHeight - 120) / img.height)
    canvas.width  = img.width
    canvas.height = img.height
    canvas.style.cssText = `max-width:${window.innerWidth - 40}px;max-height:${window.innerHeight - 120}px;cursor:crosshair;`

    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0)

    overlay.appendChild(toolbar)
    overlay.appendChild(canvas)
    document.body.appendChild(overlay)

    type Tool = 'arrow' | 'rect' | 'circle' | 'text'
    let tool: Tool = 'arrow'
    let color = '#ef4444'
    let drawing = false
    let startX = 0, startY = 0
    const history: ImageData[] = [ctx.getImageData(0, 0, canvas.width, canvas.height)]

    function setTool(t: Tool) {
      tool = t
      overlay.querySelectorAll<HTMLButtonElement>('[id^="ann-"]').forEach(b => {
        b.style.background = '#374151'
      })
      const el = overlay.querySelector<HTMLButtonElement>(`#ann-${t}`)
      if (el) el.style.background = '#6366f1'
    }

    toolbar.querySelector('#ann-arrow')!.addEventListener('click', () => setTool('arrow'))
    toolbar.querySelector('#ann-rect')!.addEventListener('click',  () => setTool('rect'))
    toolbar.querySelector('#ann-circle')!.addEventListener('click',() => setTool('circle'))
    toolbar.querySelector('#ann-text')!.addEventListener('click',  () => setTool('text'))
    toolbar.querySelector('#ann-color')!.addEventListener('input', e => { color = (e.target as HTMLInputElement).value })
    toolbar.querySelector('#ann-undo')!.addEventListener('click', () => {
      if (history.length > 1) { history.pop(); ctx.putImageData(history[history.length - 1], 0, 0) }
    })
    toolbar.querySelector('#ann-skip')!.addEventListener('click', () => { overlay.remove(); URL.revokeObjectURL(url); onSkip() })
    toolbar.querySelector('#ann-save')!.addEventListener('click', () => {
      canvas.toBlob(b => { overlay.remove(); URL.revokeObjectURL(url); if (b) onSave(b) }, 'image/png')
    })

    function canvasCoords(e: MouseEvent) {
      const r = canvas.getBoundingClientRect()
      return {
        x: (e.clientX - r.left) / scale,
        y: (e.clientY - r.top)  / scale,
      }
    }

    canvas.addEventListener('mousedown', e => {
      if (tool === 'text') {
        const { x, y } = canvasCoords(e)
        const text = prompt('Enter text:')
        if (text) {
          history.push(ctx.getImageData(0, 0, canvas.width, canvas.height))
          ctx.fillStyle = color
          ctx.font = 'bold 20px sans-serif'
          ctx.fillText(text, x, y)
        }
        return
      }
      drawing = true
      const c = canvasCoords(e)
      startX = c.x; startY = c.y
    })

    canvas.addEventListener('mousemove', e => {
      if (!drawing) return
      const snap = history[history.length - 1]
      ctx.putImageData(snap, 0, 0)
      const { x, y } = canvasCoords(e)
      ctx.strokeStyle = color
      ctx.fillStyle   = color
      ctx.lineWidth   = 2.5

      if (tool === 'arrow') drawArrow(ctx, startX, startY, x, y)
      else if (tool === 'rect') {
        ctx.beginPath()
        ctx.strokeRect(startX, startY, x - startX, y - startY)
      } else if (tool === 'circle') {
        const rx = Math.abs(x - startX) / 2
        const ry = Math.abs(y - startY) / 2
        ctx.beginPath()
        ctx.ellipse(startX + (x - startX) / 2, startY + (y - startY) / 2, rx, ry, 0, 0, Math.PI * 2)
        ctx.stroke()
      }
    })

    canvas.addEventListener('mouseup', () => {
      if (!drawing) return
      drawing = false
      history.push(ctx.getImageData(0, 0, canvas.width, canvas.height))
    })
  }
  img.src = url
}

function drawArrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  const angle = Math.atan2(y2 - y1, x2 - x1)
  const headLen = 16
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x2, y2)
  ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6))
  ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6))
  ctx.closePath()
  ctx.fill()
}
