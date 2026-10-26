import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import apiClient, { getApiErrorMessage } from '../api/client'
import MarkdownRenderer from '../components/MarkdownRenderer'
import StatusBadge from '../components/StatusBadge'
import Icon from '../components/Icon'
import PageState from '../components/PageState'
import KnowledgeHistory from '../components/KnowledgeHistory'
import { exportMarkdown } from '../utils/knowledgeTransfer'
import { getKnowledgeReturn } from '../utils/knowledgeNavigation'

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
  const { returnTo, returnLabel } = getKnowledgeReturn(location.state)
  const [point, setPoint] = useState(null)
  const [historyOpen, setHistoryOpen] = useState(false)
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
      const nextState = { ...location.state }
      delete nextState.message
      navigate(
        {
          pathname: location.pathname,
          search: location.search,
          hash: location.hash,
        },
        { replace: true, state: nextState },
      )
    }
  }, [location.state, location.pathname, location.search, location.hash, navigate])

  const handleDelete = async () => {
    if (!window.confirm('确定要删除这个知识点吗？删除后无法恢复。')) return
    setDeleting(true)
    setError('')
    try {
      await apiClient.delete(`/knowledge-points/${id}`)
      navigate(returnTo, {
        replace: true,
        state: { message: '知识点已删除' },
      })
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, '删除失败，请稍后重试'))
      setDeleting(false)
    }
  }

  if (loading) return <PageState loading fullPage />
  if (error && !point)
    return (
      <PageState fullPage title="无法打开这个知识点" message={error} retry={loadPoint}>
        <Link className="button" to={returnTo}>
          {returnLabel}
        </Link>
      </PageState>
    )

  return (
    <section className="knowledge-page detail-page reader-page">
      <header className="detail-header">
        <div className="detail-title-row">
          <Link className="back-link" to={returnTo} aria-label={returnLabel}>
            <Icon name="arrow" size={18} />
            <span>{returnLabel}</span>
          </Link>
          <h1 title={point.title}>{point.title}</h1>
          <div className="detail-actions">
            <Link
              className="button button-small"
              to={`/knowledge/${point._id}/quiz`}
              state={{ returnTo }}
            >
              开始测评
            </Link>
            <Link
              className="button button-small"
              to={`/knowledge/${point._id}/record`}
              state={{ returnTo }}
            >
              录音复述
            </Link>
            <button className="button" onClick={() => setHistoryOpen(true)}>
              历史
            </button>
            <button className="button" onClick={() => exportMarkdown(point)}>
              导出 MD
            </button>
            <Link
              className="button button-primary button-small"
              to={`/knowledge/${point._id}/edit`}
              state={{ returnTo }}
            >
              <Icon name="edit" size={18} />
              编辑
            </Link>
            <button
              className="button button-ghost button-small danger"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? '正在删除…' : '删除'}
            </button>
          </div>
        </div>
        <div className="detail-meta">
          {point.category && (
            <span className="category-chip">{point.category}</span>
          )}
          {(point.tags || []).map((tag) => (
            <span className="tag-chip" key={tag}>
              #{tag}
            </span>
          ))}
          <StatusBadge status={point.status} />
          {point.reviewList && <span className="review-flag">待复习</span>}
          <span
            className="muted-label"
            title={`创建于 ${new Date(point.createdAt).toLocaleString('zh-CN')}`}
          >
            {point.updatedAt && point.updatedAt !== point.createdAt
              ? '更新于 ' + new Date(point.updatedAt).toLocaleString('zh-CN')
              : '创建于 ' + new Date(point.createdAt).toLocaleString('zh-CN')}
          </span>
        </div>
      </header>

      {notice && <p className="form-success">{notice}</p>}
      {error && (
        <p className="form-alert" role="alert">
          {error}
        </p>
      )}

      <article className="detail-body" tabIndex={0} aria-label="知识点正文">
        <MarkdownRenderer content={point.content} />
      </article>
      {historyOpen && (
        <KnowledgeHistory
          point={point}
          onClose={() => setHistoryOpen(false)}
          onRestored={(updated) => {
            setPoint(updated)
            setHistoryOpen(false)
            setNotice('已恢复为新版本，原内容保留在历史中')
          }}
        />
      )}
    </section>
  )
}
