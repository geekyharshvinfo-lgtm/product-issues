chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'activate-selector') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'ACTIVATE_SELECTOR' })
    }
  }
})

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'CAPTURE_SCREENSHOT') {
    const windowId = sender.tab?.windowId
    chrome.tabs.captureVisibleTab(windowId!, { format: 'png' }, (dataUrl) => {
      sendResponse({ dataUrl })
    })
    return true // keep channel open for async response
  }
})
