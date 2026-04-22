import { startSelector } from './Selector'

let active = false

function activate() {
  if (active) return
  active = true
  startSelector(() => { active = false })
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'ACTIVATE_SELECTOR') activate()
})

document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && e.key === 'X') {
    e.preventDefault()
    activate()
  }
})
