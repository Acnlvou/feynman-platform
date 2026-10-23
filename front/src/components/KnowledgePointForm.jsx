import { useEffect, useState } from 'react'
import { useBlocker } from 'react-router-dom'
import MarkdownRenderer from './MarkdownRenderer'
import Icon from './Icon'
export const emptyKnowledgePoint = {
  title: '',
  content: '',
  status: 'not_started',
  reviewList: false,
  category: '',
  tags: [],
}
export default function KnowledgePointForm({
  initialValue = emptyKnowledgePoint,
  submitLabel = '保存知识点',
  submitting = false,
  error = '',
  onSubmit,
  onCancel,
}) {
  const baseline = { ...emptyKnowledgePoint, ...initialValue }
  const [form, setForm] = useState(baseline)
  const [tagText, setTagText] = useState((baseline.tags || []).join('、'))
  const tags = [
    ...new Set(
      tagText
        .split(/[,，、]/)
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  ]
  const tagError = tags.length > 10 || tags.some((tag) => tag.length > 20)
  const comparable = { ...form, tags }
  const [mode, setMode] = useState('write')
  const dirty = JSON.stringify(comparable) !== JSON.stringify(baseline)
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty &&
      !submitting &&
      (currentLocation.pathname !== nextLocation.pathname ||
        currentLocation.search !== nextLocation.search),
  )
  useEffect(() => {
    if (blocker.state === 'blocked') {
      if (window.confirm('内容尚未保存，确定离开并放弃修改吗？'))
        blocker.proceed()
      else blocker.reset()
    }
  }, [blocker])
  useEffect(() => {
    if (!dirty) return
    const prevent = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', prevent)
    return () => window.removeEventListener('beforeunload', prevent)
  }, [dirty])
  const submit = (event) => {
    event.preventDefault()
    if (!form.title.trim() || !form.content.trim()) return
    if (tagError) return
    onSubmit({
      ...form,
      tags,
      title: form.title.trim(),
      category: form.category.trim(),
    })
  }
  return (
    <form className="knowledge-form" onSubmit={submit}>
      {error && (
        <p className="form-alert" role="alert">
          {error}
        </p>
      )}
      <div className="editor-top">
        <label className="title-field">
          知识点标题
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="给这个知识点起个名字"
            maxLength={120}
            required
            disabled={submitting}
          />
        </label>
        <details className="editor-classification">
          <summary>
            分类与标签{form.category || tags.length ? ' · 已设置' : ''}
          </summary>
          <div className="metadata-popover">
            <label>
              分类
              <input
                value={form.category}
                maxLength={40}
                placeholder="例如：数学"
                disabled={submitting}
                onChange={(event) =>
                  setForm({ ...form, category: event.target.value })
                }
              />
            </label>
            <label>
              标签
              <input
                value={tagText}
                placeholder="用逗号或顿号分隔"
                disabled={submitting}
                onChange={(event) => setTagText(event.target.value)}
              />
            </label>
            <small role={tagError ? 'alert' : undefined}>
              {tagError
                ? '最多10个标签，每个不超过20字符'
                : '最多10个标签，每个20字符；分类最多40字符。'}
            </small>
          </div>
        </details>
        <span className="draft-label">
          {dirty ? '有未保存的修改' : '尚无修改'}
        </span>
      </div>
      <div className="editor-mobile-tabs" role="tablist" aria-label="内容视图">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'write'}
          aria-controls="write-panel"
          onClick={() => setMode('write')}
        >
          编辑
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'preview'}
          aria-controls="preview-panel"
          onClick={() => setMode('preview')}
        >
          预览
        </button>
      </div>
      <div className={`editor-grid mode-${mode}`}>
        <section id="write-panel" className="write-panel">
          <div className="editor-panel-label">
            <label htmlFor="knowledge-content">用自己的话解释</label>
            <span>支持 Markdown</span>
          </div>
          <textarea
            id="knowledge-content"
            aria-label="知识点正文"
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            placeholder="从一个概念、一段思考开始…"
            required
            maxLength={20000}
            disabled={submitting}
          />
          <p className="editor-help">
            支持列表、表格、代码、数学公式和 Mermaid 图表。
          </p>
        </section>
        <section
          id="preview-panel"
          className="preview-panel"
          aria-label="实时预览"
        >
          <div className="editor-panel-label">
            <span>实时预览</span>
            <span>阅读效果</span>
          </div>
          <div className="editor-preview">
            {form.content.trim() ? (
              <MarkdownRenderer content={form.content} />
            ) : (
              <div className="preview-placeholder">
                <Icon name="book" size={28} />
                <p>你的理解，会在这里呈现</p>
                <small>在编辑区输入内容，即可预览。</small>
              </div>
            )}
          </div>
        </section>
      </div>
      <div className="editor-footer">
        <div className="editor-bottom">
          <div className="form-options">
            <label>
              当前状态
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                disabled={submitting}
              >
                <option value="not_started">未开始</option>
                <option value="in_progress">学习中</option>
                <option value="mastered">已掌握</option>
              </select>
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={form.reviewList}
                onChange={(e) =>
                  setForm({ ...form, reviewList: e.target.checked })
                }
                disabled={submitting}
              />
              加入复习列表
            </label>
          </div>
        </div>
        <div className="editor-actions-bar" role="region" aria-label="保存操作">
          <div className="editor-actions-inner">
            <span className="editor-save-hint" role="status">
              {submitting
                ? '正在保存，请稍候…'
                : !form.title.trim()
                  ? '请先填写知识点标题'
                  : !form.content.trim()
                    ? '请先填写正文内容'
                    : dirty
                      ? '修改尚未保存'
                      : '内容已就绪'}
            </span>
            <div className="form-actions">
              {onCancel && (
                <button
                  type="button"
                  className="button"
                  onClick={onCancel}
                  disabled={submitting}
                >
                  取消
                </button>
              )}
              <button
                className="button button-primary"
                disabled={
                  submitting ||
                  tagError ||
                  !form.title.trim() ||
                  !form.content.trim()
                }
              >
                <Icon name="check" size={18} />
                {submitting ? '正在保存…' : submitLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </form>
  )
}
