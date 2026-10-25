import { getKnowledgeReturn } from './knowledgeNavigation'

export const TOKEN_KEY = 'feynman_token'

// 这里只校验前端会话所需字段；Token 签名仍由后端验证。
export function parseSessionToken(token) {
  try {
    if (typeof token !== 'string') return null
    const parts = token.split('.')
    if (parts.length !== 3 || parts.some((part) => !/^[A-Za-z0-9_-]+$/.test(part)))
      return null
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const bytes = Uint8Array.from(
      window.atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '=')),
      (character) => character.charCodeAt(0),
    )
    const decoded = JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(bytes),
    )
    if (
      !Number.isSafeInteger(decoded.exp) ||
      decoded.exp <= 0 ||
      !Number.isSafeInteger(decoded.exp * 1000) ||
      typeof decoded.user?.id !== 'string' ||
      !decoded.user.id.trim() ||
      typeof decoded.user.username !== 'string' ||
      !decoded.user.username.trim()
    ) return null
    return { user: decoded.user, expiresAt: decoded.exp * 1000 }
  } catch {
    return null
  }
}

// 请求使用本标签页确认过的会话，防止另一标签页登录后把旧草稿发给新账号。
let activeToken = null
let sessionEpoch = 0
const listeners = new Set()
export const getActiveToken = () => activeToken
export const getSessionEpoch = () => sessionEpoch
export const setActiveToken = (token) => {
  activeToken = token
  sessionEpoch++
}
export function onSessionInvalid(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
export function invalidateSession(token, epoch) {
  if (token && token === activeToken && epoch === sessionEpoch)
    listeners.forEach((listener) => listener(token))
}

export function getLoginDestination(from) {
  const pathname = from?.pathname
  if (
    typeof pathname !== 'string' ||
    !/^\/(?:overview|knowledge(?:\/[^/]+(?:\/(?:edit|record))?)?)\/?$/.test(pathname)
  ) return { to: '/knowledge', state: null }
  return {
    to: {
      pathname,
      search: typeof from.search === 'string' ? from.search : '',
      hash: typeof from.hash === 'string' ? from.hash : '',
    },
    state: {
      returnTo: getKnowledgeReturn(from.state).returnTo,
    },
  }
}
