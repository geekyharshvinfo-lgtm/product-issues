const NAME_KEY = 'reporter_name'

export async function getReporterName(): Promise<string | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get(NAME_KEY, (result) => {
      resolve(result[NAME_KEY] ?? null)
    })
  })
}

export async function setReporterName(name: string): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [NAME_KEY]: name }, resolve)
  })
}
