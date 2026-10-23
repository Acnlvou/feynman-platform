import { useCallback, useEffect, useState } from 'react'
import apiClient, { getApiErrorMessage } from '../api/client'
export default function useKnowledgePoints() {
  const [points, setPoints] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const reload = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await apiClient.get('/knowledge-points')
      setPoints(response.data.data || [])
    } catch (error) {
      setError(getApiErrorMessage(error, '知识点加载失败'))
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    reload()
  }, [reload])
  return { points, setPoints, loading, error, reload }
}
