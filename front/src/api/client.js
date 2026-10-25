import axios from 'axios'
import {
  getActiveToken, getSessionEpoch, invalidateSession, parseSessionToken,
} from '../utils/authSession'

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

const isPublicRequest = (config) =>
  /^\/?users\/(login|register)(?:[?#]|$)/.test(config.url || '')
const expiredError = () =>
  Object.assign(new Error('登录已过期，请重新登录'), { sessionExpired: true })

apiClient.interceptors.request.use((config) => {
  if (config.data instanceof FormData) {
    // 让浏览器设置 multipart boundary，仅影响本次文件上传。
    config.headers.delete('Content-Type')
  }
  if (isPublicRequest(config)) {
    config.headers.delete('x-auth-token')
    return config
  }
  const token = getActiveToken()
  const epoch = getSessionEpoch()
  const session = parseSessionToken(token)
  if (!session || session.expiresAt <= Date.now()) {
    invalidateSession(token, epoch)
    throw expiredError()
  }
  config._sessionToken = token
  config._sessionEpoch = epoch
  config.headers['x-auth-token'] = token
  return config
})

apiClient.interceptors.response.use(
  (response) => {
    const token = response.config._sessionToken
    if (token) {
      const session = parseSessionToken(token)
      if (
        token !== getActiveToken() ||
        response.config._sessionEpoch !== getSessionEpoch() ||
        !session ||
        session.expiresAt <= Date.now()
      ) {
        invalidateSession(token, response.config._sessionEpoch)
        throw expiredError()
      }
    }
    return response
  },
  (error) => {
    const token = error.config?._sessionToken
    if (error.response?.status === 401 && token) {
      invalidateSession(token, error.config._sessionEpoch)
      error.sessionExpired = true
    }
    return Promise.reject(error)
  },
)

export function getApiErrorMessage(error, fallback = '请求失败，请稍后重试') {
  if (error?.sessionExpired) return '登录已过期，请重新登录'
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    fallback
  )
}

export default apiClient
