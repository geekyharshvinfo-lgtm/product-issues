const AUTH_KEY = 'pit_auth_user'

export interface AuthUser {
  name: string
  email: string
  picture?: string
}

export async function getAuthUser(): Promise<AuthUser | null> {
  const stored = await chrome.storage.local.get(AUTH_KEY)
  return stored[AUTH_KEY] ?? null
}

export async function signInWithGoogle(): Promise<AuthUser | null> {
  return new Promise(resolve => {
    chrome.identity.getAuthToken({ interactive: true }, async token => {
      if (chrome.runtime.lastError || !token) {
        resolve(null)
        return
      }
      try {
        const res = await fetch(
          `https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=${token}`
        )
        const data = await res.json()
        const user: AuthUser = {
          name: data.name || data.email,
          email: data.email,
          picture: data.picture,
        }
        await chrome.storage.local.set({ [AUTH_KEY]: user })
        resolve(user)
      } catch {
        resolve(null)
      }
    })
  })
}

export async function signOut(): Promise<void> {
  const stored = await chrome.storage.local.get(AUTH_KEY)
  const user = stored[AUTH_KEY] as AuthUser | null
  if (!user) return
  await chrome.storage.local.remove(AUTH_KEY)
  // Revoke the token so the next sign-in prompts the account picker
  return new Promise(resolve => {
    chrome.identity.getAuthToken({ interactive: false }, token => {
      if (token) chrome.identity.removeCachedAuthToken({ token }, resolve)
      else resolve()
    })
  })
}
