import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import apiClient, { getApiErrorMessage } from '../api/client'
import KnowledgePointForm from '../components/KnowledgePointForm'
import StatusBadge from '../components/StatusBadge'

function summarize(content = '') {
  const text = content
    .replace(/```[\s\S]*?```/g, ' [ 图表 / 代码 ] ')
    .replace(/[#$>*_`~|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > 110 ? `${text.slice(0, 110)}…` : text
}

export default function KnowledgePage() {
  const [knowledgePoints, setKnowledgePoints] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [listError, setListError] = useState('')
  const [listMessage, setListMessage] = useState('')
  const [formError, setFormError] = useState('')
  const [formMessage, setFormMessage] = useState('')
  const [formKey, setFormKey] = useState(0)
  const location = useLocation()

  const loadKnowledgePoints = useCallback(async () => {
    setLoading(true)
    setListError('')
    try {
      const response = await apiClient.get('/knowledge-points')
      setKnowledgePoints(response.data.data || [])
    } catch (requestError) {
      setListError(getApiErrorMessage(requestError, '知识点加载失败'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadKnowledgePoints()
  }, [loadKnowledgePoints])

  useEffect(() => {
    if (location.state?.message) setListMessage(location.state.message)
  }, [location.state])

  const filteredPoints = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return knowledgePoints
    return knowledgePoints.filter((point) => `${point.title} ${point.content}`.toLowerCase().includes(keyword))
  }, [knowledgePoints, search])

  const handleCreate = async (values) => {
    setSubmitting(true)
    setFormError('')
    setFormMessage('')
    try {
      const response = await apiClient.post('/knowledge-points', values)
      setKnowledgePoints((current) => [response.data.data, ...current])
      setFormKey((current) => current + 1)
      setFormMessage('知识点已加入你的学习空间')
    } catch (requestError) {
      setFormError(getApiErrorMessage(requestError, '创建知识点失败'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('确定要删除这个知识点吗？删除后无法恢复。')) return
    setListError('')
    setListMessage('')
    try {
      await apiClient.delete(`/knowledge-points/${id}`)
      setKnowledgePoints((current) => current.filter((point) => point._id !== id))
      setListMessage('知识点已删除')
    } catch (requestError) {
      setListError(getApiErrorMessage(requestError, '删除失败，请稍后重试'))
    }
  }

  return (
    <section className="knowledge-page">
      <div className="page-header">
        <div>
          <span className="eyebrow">MY KNOWLEDGE BASE</span>
          <h1>我的知识点</h1>
          <p>把零散的输入，整理成可以复述的理解。</p>
        </div>
        <Link className="button button-primary" to="/">
          返回概览 <span>↗</span>
        </Link>
      </div>

      <div className="knowledge-layout">
        <div className="knowledge-list-panel">
          <div className="list-toolbar">
            <div>
              <strong>{knowledgePoints.length}</strong>
              <span> 个知识点</span>
            </div>
            <input
              className="search-input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索知识点…"
              aria-label="搜索知识点"
            />
          </div>

          {listError && (
            <p className="form-alert" role="alert">
              {listError}
            </p>
          )}
          {listMessage && <p className="form-success">{listMessage}</p>}
          {loading ? (
            <div className="empty-state">
              <span className="loader" />
              正在加载知识点…
            </div>
          ) : filteredPoints.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">◇</span>
              <h3>{search ? '没有找到匹配内容' : '知识库还是空的'}</h3>
              <p>{search ? '换一个关键词试试。' : '从右侧添加第一个知识点，开始你的费曼循环。'}</p>
            </div>
          ) : (
            <div className="knowledge-list">
              {filteredPoints.map((point) => (
                <article className="knowledge-item" key={point._id}>
                  <div className="knowledge-item-main">
                    <div className="knowledge-item-heading">
                      <h3>
                        <Link to={`/knowledge/${point._id}`}>{point.title}</Link>
                      </h3>
                      <StatusBadge status={point.status} />
                      {point.reviewList && <span className="review-flag">待复习</span>}
                    </div>
                    <p>{summarize(point.content)}</p>
                    <small>{new Date(point.createdAt).toLocaleDateString('zh-CN')}</small>
                  </div>
                  <div className="knowledge-item-actions">
                    <Link className="icon-button" to={`/knowledge/${point._id}/edit`} aria-label={`编辑${point.title}`}>
                      ✎
                    </Link>
                    <button
                      className="icon-button"
                      onClick={() => handleDelete(point._id)}
                      aria-label={`删除${point.title}`}
                    >
                      ×
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <aside className="create-panel">
          <div className="panel-heading">
            <span className="panel-number">01</span>
            <div>
              <span className="eyebrow">ADD A THOUGHT</span>
              <h2>记录新知识</h2>
            </div>
          </div>
          <KnowledgePointForm
            key={formKey}
            submitting={submitting}
            error={formError}
            success={formMessage}
            submitLabel="保存知识点"
            onSubmit={handleCreate}
          />
        </aside>
      </div>
    </section>
  )
}
