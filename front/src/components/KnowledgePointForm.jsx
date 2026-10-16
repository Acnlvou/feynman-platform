import { useState } from 'react'
import MarkdownRenderer from './MarkdownRenderer'

export const emptyKnowledgePoint = { title: '', content: '', status: 'not_started', reviewList: false }

// 新建与编辑共用同一份表单，字段与后端 /api/knowledge-points 保持一致
export default function KnowledgePointForm({
  initialValue = emptyKnowledgePoint,
  submitLabel = '保存知识点',
  submitting = false,
  error = '',
  success = '',
  onSubmit,
  onCancel,
}) {
  const [form, setForm] = useState(initialValue)
  const [mode, setMode] = useState('write')

  const handleSubmit = (event) => {
    event.preventDefault()
    onSubmit({
      title: form.title.trim(),
      content: form.content,
      status: form.status,
      reviewList: form.reviewList,
    })
  }

  return (
    <form className="knowledge-form" onSubmit={handleSubmit}>
      {error && (
        <p className="form-alert" role="alert">
          {error}
        </p>
      )}
      {success && <p className="form-success">{success}</p>}

      <label>
        标题
        <input
          value={form.title}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
          placeholder="例如：什么是闭包？"
          maxLength={120}
          required
        />
      </label>

      <div className="editor-field">
        <div className="editor-toolbar">
          <span className="editor-label">用自己的话解释</span>
          <div className="editor-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'write'}
              className={`editor-tab ${mode === 'write' ? 'active' : ''}`}
              onClick={() => setMode('write')}
            >
              编辑
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'preview'}
              className={`editor-tab ${mode === 'preview' ? 'active' : ''}`}
              onClick={() => setMode('preview')}
            >
              预览
            </button>
          </div>
        </div>

        {mode === 'write' ? (
          <textarea
            value={form.content}
            onChange={(event) => setForm({ ...form, content: event.target.value })}
            placeholder={'支持 Markdown、LaTeX 公式（$E=mc^2$）与 Mermaid 图表：\n\n```mermaid\ngraph TD\n  A[输入] --> B[复述]\n```'}
            rows="10"
            required
          />
        ) : (
          <div className="editor-preview">
            {form.content.trim() ? (
              <MarkdownRenderer content={form.content} />
            ) : (
              <p className="empty-state-inline">还没有内容，切回「编辑」写点什么吧。</p>
            )}
          </div>
        )}
      </div>

      <div className="form-row">
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
      </div>

      <div className="form-actions">
        <button className="button button-dark button-wide" disabled={submitting}>
          {submitting ? '正在保存…' : submitLabel} <span>↗</span>
        </button>
        {onCancel && (
          <button type="button" className="button button-ghost button-small" onClick={onCancel} disabled={submitting}>
            取消
          </button>
        )}
      </div>
    </form>
  )
}
