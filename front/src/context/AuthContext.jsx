import { createContext, useContext, useMemo, useState } from 'react'
import apiClient from '../api/client'

const AuthContext = createContext(null)

function decodeToken(token) {
  try {
    const payload = token.split('.')[1]
    return JSON.parse(window.atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('feynman_token'))

  const user = useMemo(() => {
    if (!token) return null
    return decodeToken(token)?.user || null
  }, [token])

  const saveToken = (newToken) => {
    localStorage.setItem('feynman_token', newToken)
    setToken(newToken)
  }

  const logout = () => {
    localStorage.removeItem('feynman_token')
    setToken(null)
  }

  const login = async (credentials) => {
    const response = await apiClient.post('/users/login', credentials)
    saveToken(response.data.data.token)
  }

  const register = async (formData) => {
    const response = await apiClient.post('/users/register', formData)
    saveToken(response.data.data.token)
  }

  const value = useMemo(
    () => ({ token, user, isAuthenticated: Boolean(token), login, register, logout }),
    [token, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth 必须在 AuthProvider 内使用')
  }
  return context
}
