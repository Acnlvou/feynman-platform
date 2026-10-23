import axios from 'axios'

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

apiClient.interceptors.request.use((config) => {
  if (config.data instanceof FormData) {
    // 让浏览器设置 multipart boundary，仅影响本次文件上传。
    config.headers.delete('Content-Type')
  }
  const token = localStorage.getItem('feynman_token')
  if (token) {
    config.headers['x-auth-token'] = token
  }
  return config
})

export function getApiErrorMessage(error, fallback = '请求失败，请稍后重试') {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    fallback
  )
}

export default apiClient
