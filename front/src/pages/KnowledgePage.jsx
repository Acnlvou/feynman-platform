import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import apiClient, { getApiErrorMessage } from '../api/client'
import StatusBadge from '../components/StatusBadge'
import Icon from '../components/Icon'
import PageState from '../components/PageState'
import useKnowledgePoints from '../hooks/useKnowledgePoints'
import { summarize, formatDate } from '../utils/knowledge'
import KnowledgeImport from '../components/KnowledgeImport'
import { downloadFile } from '../utils/knowledgeTransfer'
export default function KnowledgePage() {
  const { points, setPoints, loading, error, reload } = useKnowledgePoints()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [category, setCategory] = useState('all')
  const [tag, setTag] = useState('all')
  const [importOpen, setImportOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const categories = [
    ...new Set(points.map((point) => point.category).filter(Boolean)),
  ]
  const tags = [...new Set(points.flatMap((point) => point.tags || []))]
  const exportAll = async () => {
    setExporting(true)
    setActionError('')
    try {
      const response = await apiClient.get('/knowledge-points/export')
      downloadFile(
        '费曼知识库备份.json',
        JSON.stringify(response.data.data, null, 2),
      )
    } catch (error) {
      setActionError(getApiErrorMessage(error, '导出失败'))
    } finally {
      setExporting(false)
    }
  }
  const [actionError, setActionError] = useState('')
  const location = useLocation()
  const [message, setMessage] = useState(location.state?.message || '')
  const [deleting, setDeleting] = useState(null)
  const filtered = useMemo(
    () =>
      points.filter(
        (point) =>
          (status === 'all' || point.status === status) &&
          (category === 'all' ||
            (category === 'uncategorized'
              ? !point.category
              : point.category === category.slice(6))) &&
          (tag === 'all' || (point.tags || []).includes(tag.slice(6))) &&
          `${point.title} ${point.content} ${point.category || ''} ${(point.tags || []).join(' ')}`
            .toLowerCase()
            .includes(search.trim().toLowerCase()),
      ),
    [points, status, category, tag, search],
  )
  const remove = async (point) => {
    if (!window.confirm(`确定删除「${point.title}」吗？删除后无法恢复。`))
      return
    setDeleting(point._id)
    setActionError('')
    setMessage('')
    try {
      await apiClient.delete(`/knowledge-points/${point._id}`)
      setPoints((current) => current.filter((item) => item._id !== point._id))
      setMessage('知识点已删除')
    } catch (error) {
      setActionError(getApiErrorMessage(error, '删除失败，请稍后重试'))
    } finally {
      setDeleting(null)
    }
  }
  return (
    <section className="knowledge-page compact-page">
      <div className="page-header">
        <div>
          <h1>
            知识库{' '}
            <span className="count">
              {!loading && !error ? points.length : '—'}
            </span>
          </h1>
        </div>
        <div className="library-actions">
          <button className="button" onClick={() => setImportOpen(true)}>
            导入
          </button>
          <button
            className="button"
            disabled={exporting || loading || !!error}
            onClick={exportAll}
          >
            {exporting ? '导出中…' : '导出备份'}
          </button>
          <Link className="button button-primary" to="/knowledge/new">
            <Icon name="plus" />
            新建知识点
          </Link>
        </div>
      </div>
      <div className="library-panel">
        <div className="list-toolbar">
          <label className="search-box">
            <Icon name="search" />
            <input
              aria-label="搜索知识点"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索标题或正文…"
            />
          </label>
          <div className="library-filters">
            <label className="filter-label">
              <span>状态</span>
              <select
                aria-label="筛选状态"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="all">全部状态</option>
                <option value="not_started">未开始</option>
                <option value="in_progress">学习中</option>
                <option value="mastered">已掌握</option>
              </select>
            </label>
            <label className="filter-label">
              <span>分类</span>
              <select
                aria-label="筛选分类"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                <option value="all">全部分类</option>
                <option value="uncategorized">未分类</option>
                {categories.map((value) => (
                  <option key={value} value={'value:' + value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label className="filter-label">
              <span>标签</span>
              <select
                aria-label="筛选标签"
                value={tag}
                onChange={(event) => setTag(event.target.value)}
              >
                <option value="all">全部标签</option>
                {tags.map((value) => (
                  <option key={value} value={'value:' + value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        {message && (
          <p className="form-success" role="status">
            {message}
          </p>
        )}
        {actionError && (
          <p className="form-alert" role="alert">
            {actionError}
          </p>
        )}
        {loading ? (
          <PageState loading />
        ) : error ? (
          <PageState
            title="暂时无法加载知识库"
            message={error}
            retry={reload}
          />
        ) : !filtered.length ? (
          <PageState
            title={
              points.length ? '没有找到匹配的知识点' : '从第一个知识点开始'
            }
            message={
              points.length
                ? '试试其他关键词，或调整状态筛选。'
                : '记下一个概念，再用自己的话解释它。'
            }
          >
            {points.length ? (
              <button
                className="button"
                onClick={() => {
                  setSearch('')
                  setStatus('all')
                  setCategory('all')
                  setTag('all')
                }}
              >
                清除筛选
              </button>
            ) : (
              <Link className="button button-primary" to="/knowledge/new">
                <Icon name="plus" />
                新建知识点
              </Link>
            )}
          </PageState>
        ) : (
          <>
            <div className="list-head">
              <span>知识点</span>
              <span>更新日期 / 操作</span>
            </div>
            <div className="knowledge-list">
              {filtered.map((point) => (
                <article className="knowledge-item" key={point._id}>
                  <span className="document-icon">
                    <Icon name="book" />
                  </span>
                  <div className="knowledge-item-main">
                    <div className="knowledge-item-heading">
                      <Link
                        to={`/knowledge/${point._id}`}
                        className="knowledge-title"
                        state={{ returnTo: '/knowledge' }}
                      >
                        {point.title}
                      </Link>
                      <StatusBadge status={point.status} />
                      {point.reviewList && (
                        <span className="review-flag">待复习</span>
                      )}
                    </div>
                    {(point.category || point.tags?.length > 0) && (
                      <div className="knowledge-taxonomy">
                        {point.category && (
                          <span className="category-chip">
                            {point.category}
                          </span>
                        )}
                        {(point.tags || []).map((value) => (
                          <span className="tag-chip" key={value}>
                            #{value}
                          </span>
                        ))}
                      </div>
                    )}
                    <p>{summarize(point.content)}</p>
                  </div>
                  <div className="knowledge-item-end">
                    <time>
                      {formatDate(point.updatedAt || point.createdAt)}
                    </time>
                    <div className="knowledge-item-actions">
                      <Link
                        className="icon-button"
                        to={`/knowledge/${point._id}/edit`}
                        state={{ returnTo: '/knowledge' }}
                        aria-label={`编辑${point.title}`}
                      >
                        <Icon name="edit" size={18} />
                      </Link>
                      <button
                        className="icon-button danger"
                        disabled={deleting !== null}
                        onClick={() => remove(point)}
                        aria-label={`删除${point.title}`}
                      >
                        <Icon name="trash" size={18} />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <div className="list-footer">显示 {filtered.length} 个知识点</div>
          </>
        )}
      </div>
      {importOpen && (
        <KnowledgeImport
          onClose={() => setImportOpen(false)}
          onImported={reload}
        />
      )}
    </section>
  )
}
