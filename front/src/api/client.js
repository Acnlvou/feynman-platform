import axios from 'axios'

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('feynman_token')
  if (token) {
    config.headers['x-auth-token'] = token
  }
  return config
})

export function getApiErrorMessage(error, fallback = '请求失败，请稍后重试') {
  return error?.response?.data?.message || error?.response?.data?.error || error?.message || fallback
}

export default apiClient
