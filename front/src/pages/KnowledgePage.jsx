import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import apiClient, { getApiErrorMessage } from '../api/client'
import StatusBadge from '../components/StatusBadge'

const initialForm = { title: '', content: '', status: 'not_started', reviewList: false }

export default function KnowledgePage() {
  const [knowledgePoints, setKnowledgePoints] = useState([])
  const [form, setForm] = useState(initialForm)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const loadKnowledgePoints = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await apiClient.get('/knowledge-points')
      setKnowledgePoints(response.data.data || [])
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, '知识点加载失败'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadKnowledgePoints()
  }, [loadKnowledgePoints])

  const filteredPoints = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return knowledgePoints
    return knowledgePoints.filter((point) => `${point.title} ${point.content}`.toLowerCase().includes(keyword))
  }, [knowledgePoints, search])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    setSuccess('')
    try {
      const response = await apiClient.post('/knowledge-points', form)
      setKnowledgePoints((current) => [response.data.data, ...current])
      setForm(initialForm)
      setSuccess('知识点已加入你的学习空间')
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, '创建知识点失败'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('确定要删除这个知识点吗？')) return
    try {
      await apiClient.delete(`/knowledge-points/${id}`)
      setKnowledgePoints((current) => current.filter((point) => point._id !== id))
      setSuccess('知识点已删除')
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, '删除失败'))
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

          {error && <p className="form-alert">{error}</p>}
          {success && <p className="form-success">{success}</p>}
          {loading ? (
            <div className="empty-state"><span className="loader" />正在加载知识点…</div>
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
                      <h3>{point.title}</h3>
                      <StatusBadge status={point.status} />
                    </div>
                    <p>{point.content}</p>
                    <small>{new Date(point.createdAt).toLocaleDateString('zh-CN')}</small>
                  </div>
                  <button className="icon-button" onClick={() => handleDelete(point._id)} aria-label={`删除${point.title}`}>
                    ×
                  </button>
                </article>
              ))}
            </div>
          )}
        </div>

        <aside className="create-panel">
          <div className="panel-heading">
            <span className="panel-number">01</span>
            <div><span className="eyebrow">ADD A THOUGHT</span><h2>记录新知识</h2></div>
          </div>
          <form className="knowledge-form" onSubmit={handleSubmit}>
            <label>
              标题
              <input
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder="例如：什么是闭包？"
                required
              />
            </label>
            <label>
              用自己的话解释
              <textarea
                value={form.content}
                onChange={(event) => setForm({ ...form, content: event.target.value })}
                placeholder="试着像讲给完全不了解的人一样解释它…"
                rows="7"
                required
              />
            </label>
            <label>
              当前状态
              <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                <option value="not_started">未开始</option>
                <option value="in_progress">学习中</option>
                <option value="mastered">已掌握</option>
              </select>
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={form.reviewList}
                onChange={(event) => setForm({ ...form, reviewList: event.target.checked })}
              />
              加入我的复习列表
            </label>
            <button className="button button-dark button-wide" disabled={submitting}>
              {submitting ? '正在保存…' : '保存知识点'} <span>↗</span>
            </button>
          </form>
        </aside>
      </div>
    </section>
  )
}
