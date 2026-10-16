import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import apiClient, { getApiErrorMessage } from '../api/client'
import KnowledgePointForm from '../components/KnowledgePointForm'

function describeError(requestError) {
  const status = requestError?.response?.status
  if (status === 404) return '这个知识点不存在，可能已被删除。'
  if (status === 403) return '这个知识点属于其他用户，你无权编辑。'
  return getApiErrorMessage(requestError, '知识点加载失败')
}

export default function KnowledgeEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [initialValue, setInitialValue] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const loadPoint = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await apiClient.get(`/knowledge-points/${id}`)
      const point = response.data.data
      setInitialValue({
        title: point.title || '',
        content: point.content || '',
        status: point.status || 'not_started',
        reviewList: Boolean(point.reviewList),
      })
    } catch (requestError) {
      setInitialValue(null)
      setError(describeError(requestError))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadPoint()
  }, [loadPoint])

  const handleSubmit = async (values) => {
    setSubmitting(true)
    setError('')
    try {
      await apiClient.put(`/knowledge-points/${id}`, values)
      navigate(`/knowledge/${id}`, { replace: true, state: { message: '知识点已更新' } })
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, '保存失败，请稍后重试'))
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <section className="knowledge-page">
        <div className="empty-state">
          <span className="loader" />
          正在加载知识点…
        </div>
      </section>
    )
  }

  if (!initialValue) {
    return (
      <section className="knowledge-page">
        <div className="empty-state">
          <span className="empty-icon">◇</span>
          <h3>无法编辑这个知识点</h3>
          <p>{error}</p>
          <Link className="button button-primary button-small" to="/knowledge">
            返回知识点列表
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section className="knowledge-page edit-page">
      <div className="page-header">
        <div>
          <span className="eyebrow">EDIT KNOWLEDGE</span>
          <h1>编辑知识点</h1>
          <p>改完之后切到「预览」，确认公式与图表显示正常再保存。</p>
        </div>
        <Link className="button button-ghost button-small" to={`/knowledge/${id}`}>
          返回详情
        </Link>
      </div>

      <div className="edit-panel">
        <KnowledgePointForm
          key={id}
          initialValue={initialValue}
          submitLabel="保存修改"
          submitting={submitting}
          error={error}
          onSubmit={handleSubmit}
          onCancel={() => navigate(`/knowledge/${id}`)}
        />
      </div>
    </section>
  )
}
