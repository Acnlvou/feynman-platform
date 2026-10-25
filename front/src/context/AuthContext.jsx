import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import apiClient from '../api/client'
import {
  TOKEN_KEY,
  onSessionInvalid,
  parseSessionToken,
  setActiveToken,
} from '../utils/authSession'

const AuthContext = createContext(null)

function initialSession() {
  const token = localStorage.getItem(TOKEN_KEY)
  const parsed = parseSessionToken(token)
  if (parsed && parsed.expiresAt > Date.now()) {
    setActiveToken(token)
    return { ...parsed, token, status: 'authenticated' }
  }
  setActiveToken(null)
  return { token: null, user: null, status: token ? 'expired' : 'anonymous' }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(initialSession)
  const current = useRef(session)
  const drafts = useRef(new Map())
  const [retained, setRetained] = useState(null)

  const registerDraft = useCallback((key, value) => {
    drafts.current.set(key, value)
    return () => {
      if (drafts.current.get(key) === value) drafts.current.delete(key)
    }
  }, [])

  const expire = useCallback((token) => {
    if (
      current.current.status !== 'authenticated' ||
      current.current.token !== token
    ) return
    const pending = [...drafts.current.values()].filter((draft) => draft.dirty)
    const next = { ...current.current, token: null, status: 'expired' }
    current.current = next
    setActiveToken(null)
    if (localStorage.getItem(TOKEN_KEY) === token)
      localStorage.removeItem(TOKEN_KEY)
    if (pending.length) {
      setRetained({
        location: pending[0].location,
        prompt: true,
        discarding: false,
      })
    }
    setSession(next)
    pending.forEach((draft) => draft.onExpire?.())
  }, [])

  useLayoutEffect(() => onSessionInvalid(expire), [expire])
  useEffect(() => {
    if (session.status !== 'authenticated') {
      const stored = localStorage.getItem(TOKEN_KEY)
      const parsed = parseSessionToken(stored)
      if (stored && (!parsed || parsed.expiresAt <= Date.now()))
        localStorage.removeItem(TOKEN_KEY)
      return
    }
    let timer
    const check = () => {
      if (current.current !== session) return
      if (
        localStorage.getItem(TOKEN_KEY) !== session.token ||
        session.expiresAt <= Date.now()
      ) {
        expire(session.token)
      } else {
        clearTimeout(timer)
        timer = setTimeout(
          check,
          Math.min(session.expiresAt - Date.now(), 2147483647),
        )
      }
    }
    const visible = () => {
      if (document.visibilityState === 'visible') check()
    }
    const storage = (event) => {
      if (event.key === TOKEN_KEY || event.key === null) check()
    }
    check()
    window.addEventListener('focus', check)
    document.addEventListener('visibilitychange', visible)
    window.addEventListener('storage', storage)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('focus', check)
      document.removeEventListener('visibilitychange', visible)
      window.removeEventListener('storage', storage)
    }
  }, [session, expire])

  const saveToken = useCallback((token) => {
    const parsed = parseSessionToken(token)
    if (!parsed || parsed.expiresAt <= Date.now())
      throw new Error('服务器返回的登录凭据无效，请重新登录')
    const next = { ...parsed, token, status: 'authenticated' }
    current.current = next
    setActiveToken(token)
    localStorage.setItem(TOKEN_KEY, token)
    setRetained(null)
    setSession(next)
  }, [])
  const logout = useCallback(() => {
    if (localStorage.getItem(TOKEN_KEY) === current.current.token)
      localStorage.removeItem(TOKEN_KEY)
    const next = { token: null, user: null, status: 'anonymous' }
    current.current = next
    setActiveToken(null)
    setRetained(null)
    setSession(next)
  }, [])
  const login = useCallback(async (credentials) => {
    const response = await apiClient.post('/users/login', credentials)
    saveToken(response.data.data.token)
  }, [saveToken])
  const register = useCallback(async (formData) => {
    const response = await apiClient.post('/users/register', formData)
    saveToken(response.data.data.token)
  }, [saveToken])
  const dismissExpiryPrompt = useCallback(() => {
    setRetained((value) => value && { ...value, prompt: false })
  }, [])
  const showExpiryPrompt = useCallback(() => {
    setRetained((value) => value && { ...value, prompt: true })
  }, [])
  const discardExpiredDraft = useCallback(() => {
    setRetained((value) => value && { ...value, discarding: true })
  }, [])
  const value = useMemo(
    () => ({
      token: session.token,
      user: session.user,
      isAuthenticated: session.status === 'authenticated',
      sessionExpired: session.status === 'expired',
      retained,
      discarding: Boolean(retained?.discarding),
      login,
      register,
      logout,
      registerDraft,
      dismissExpiryPrompt,
      showExpiryPrompt,
      discardExpiredDraft,
    }),
    [session, retained, login, register, logout, registerDraft,
      dismissExpiryPrompt, showExpiryPrompt, discardExpiredDraft],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth 必须在 AuthProvider 内使用')
  return context
}
