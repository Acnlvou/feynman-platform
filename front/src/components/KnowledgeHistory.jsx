import { useEffect, useState } from 'react'
import Modal from './Modal'
import MarkdownRenderer from './MarkdownRenderer'
import apiClient, { getApiErrorMessage } from '../api/client'
export default function KnowledgeHistory({ point, onClose, onRestored }) {
  const [confirmRestore, setConfirmRestore] = useState(false)
  const [entries, setEntries] = useState([]),
    [selected, setSelected] = useState(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true)
  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await apiClient.get(
        `/knowledge-points/${point._id}/history`,
      )
      setEntries(response.data.data)
      setSelected(response.data.data[0])
    } catch (error) {
      setError(getApiErrorMessage(error, '无法加载历史'))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    load()
  }, [point._id])
  const restore = async () => {
    setBusy(true)
    setError('')
    try {
      const response = await apiClient.post(
        `/knowledge-points/${point._id}/restore`,
        { version: selected.version, revision: point.revision || 1 },
      )
      onRestored(response.data.data)
    } catch (error) {
      setError(getApiErrorMessage(error, '恢复失败'))
      setBusy(false)
    }
  }
  return (
    <Modal title="版本历史" onClose={onClose} busy={busy} wide>
      {error && (
        <p className="form-alert" role="alert">
          {error}
          <button className="button" onClick={load} disabled={busy}>
            重新加载
          </button>
        </p>
      )}
      {loading ? (
        <p className="modal-content">正在加载版本…</p>
      ) : (
        <div className="history-layout">
          <nav className="history-list" aria-label="选择历史版本">
            {entries.map((entry, index) => (
              <button
                key={entry.version}
                className={
                  selected?.version === entry.version ? 'selected' : ''
                }
                onClick={() => {
                  setSelected(entry)
                  setConfirmRestore(false)
                }}
                disabled={busy}
              >
                <strong>
                  版本 {entry.version}
                  {index === 0 ? '（当前）' : ''}
                </strong>
                <small>{new Date(entry.savedAt).toLocaleString('zh-CN')}</small>
              </button>
            ))}
          </nav>
          <div className="history-preview">
            {selected && (
              <>
                <h3>{selected.title}</h3>
                <p className="muted-copy">
                  {selected.category || '未分类'} ·{' '}
                  {(selected.tags || []).join('、') || '无标签'} ·{' '}
                  {
                    {
                      not_started: '未开始',
                      in_progress: '学习中',
                      mastered: '已掌握',
                    }[selected.status]
                  }
                  {selected.reviewList ? ' · 待复习' : ''}
                </p>
                <MarkdownRenderer content={selected.content} />
              </>
            )}
          </div>
        </div>
      )}
      <div className="modal-footer">
        <span className="muted-copy">
          {confirmRestore
            ? `确定恢复版本 ${selected.version}？当前内容会保留为历史版本。`
            : '最多保留10个旧版本，总大小受限；恢复会生成新版本。'}
        </span>
        {confirmRestore && (
          <button
            className="button"
            disabled={busy}
            onClick={() => setConfirmRestore(false)}
          >
            取消恢复
          </button>
        )}
        <button
          className="button button-primary"
          disabled={
            loading ||
            busy ||
            !selected ||
            selected.version === entries[0]?.version
          }
          onClick={() => (confirmRestore ? restore() : setConfirmRestore(true))}
        >
          {busy ? '正在恢复…' : confirmRestore ? '确认恢复' : '恢复此版本'}
        </button>
      </div>
    </Modal>
  )
}
