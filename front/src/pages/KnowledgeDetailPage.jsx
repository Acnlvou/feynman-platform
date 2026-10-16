import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import apiClient, { getApiErrorMessage } from '../api/client'
import MarkdownRenderer from '../components/MarkdownRenderer'
import StatusBadge from '../components/StatusBadge'

function describeError(requestError) {
  const status = requestError?.response?.status
  if (status === 404) return '这个知识点不存在，可能已被删除。'
  if (status === 403) return '这个知识点属于其他用户，你无权查看。'
  return getApiErrorMessage(requestError, '知识点加载失败')
}

export default function KnowledgeDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [point, setPoint] = useState(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState(location.state?.message || '')

  const loadPoint = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await apiClient.get(`/knowledge-points/${id}`)
      setPoint(response.data.data)
    } catch (requestError) {
      setPoint(null)
      setError(describeError(requestError))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadPoint()
  }, [loadPoint])

  useEffect(() => {
    if (location.state?.message) {
      setNotice(location.state.message)
      navigate(location.pathname, { replace: true, state: null })
    }
  }, [location.state, location.pathname, navigate])

  const handleDelete = async () => {
    if (!window.confirm('确定要删除这个知识点吗？删除后无法恢复。')) return
    setDeleting(true)
    setError('')
    try {
      await apiClient.delete(`/knowledge-points/${id}`)
      navigate('/knowledge', { replace: true, state: { message: '知识点已删除' } })
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, '删除失败，请稍后重试'))
      setDeleting(false)
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

  if (error && !point) {
    return (
      <section className="knowledge-page">
        <div className="empty-state">
          <span className="empty-icon">◇</span>
          <h3>无法打开这个知识点</h3>
          <p>{error}</p>
          <Link className="button button-primary button-small" to="/knowledge">
            返回知识点列表
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section className="knowledge-page detail-page">
      <div className="page-header">
        <div>
          <span className="eyebrow">KNOWLEDGE DETAIL</span>
          <h1>{point.title}</h1>
          <div className="detail-meta">
            <StatusBadge status={point.status} />
            {point.reviewList && <span className="review-flag">待复习</span>}
            <span className="muted-label">创建于 {new Date(point.createdAt).toLocaleString('zh-CN')}</span>
            {point.updatedAt && point.updatedAt !== point.createdAt && (
              <span className="muted-label">更新于 {new Date(point.updatedAt).toLocaleString('zh-CN')}</span>
            )}
          </div>
        </div>
        <div className="detail-actions">
          <Link className="button button-primary button-small" to={`/knowledge/${point._id}/edit`}>
            编辑 <span>✎</span>
          </Link>
          <button className="button button-ghost button-small" onClick={handleDelete} disabled={deleting}>
            {deleting ? '正在删除…' : '删除'}
          </button>
          <Link className="button button-ghost button-small" to="/knowledge">
            返回列表
          </Link>
        </div>
      </div>

      {notice && <p className="form-success">{notice}</p>}
      {error && (
        <p className="form-alert" role="alert">
          {error}
        </p>
      )}

      <article className="detail-body">
        <MarkdownRenderer content={point.content} />
      </article>
    </section>
  )
}
