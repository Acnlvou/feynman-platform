import { useRef, useState } from 'react'
import Modal from './Modal'
import apiClient, { getApiErrorMessage } from '../api/client'
import { parseImport, backup, importBatches } from '../utils/knowledgeTransfer'
export default function KnowledgeImport({ onClose, onImported }) {
  const [records, setRecords] = useState([]),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false)
  const fileInput = useRef(null)
  const choose = async (event) => {
    const file = event.target.files?.[0]
    setError('')
    setMessage('')
    setRecords([])
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setError('文件超过5MB，请拆分后导入')
      return
    }
    try {
      setRecords(
        parseImport(await file.text(), file.name).map((record) => ({
          ...record,
          importKey: crypto.randomUUID(),
        })),
      )
    } catch (error) {
      setError(error.message)
    }
  }
  const importNow = async () => {
    setBusy(true)
    setError('')
    setMessage('')
    const batches = importBatches(records),
      remaining = []
    let count = 0
    for (let index = 0; index < batches.length; index++) {
      const batch = batches[index]
      try {
        const response = await apiClient.post('/knowledge-points/import', {
          ...backup(batch),
          importKeys: batch.map((record) => record.importKey),
        })
        count += response.data.data.created.length
        for (const failed of response.data.data.failed)
          remaining.push(batch[failed.index])
      } catch (error) {
        remaining.push(...batch, ...batches.slice(index + 1).flat())
        setError(getApiErrorMessage(error, '导入失败'))
        break
      }
    }
    setRecords(remaining)
    setMessage(
      `已导入 ${count} 条${remaining.length ? `，剩余 ${remaining.length} 条未导入。重试只处理剩余项。` : '，可关闭窗口查看。'}`,
    )
    setBusy(false)
    if (count) onImported()
  }
  return (
    <Modal title="导入知识点" onClose={onClose} busy={busy}>
      <div className="modal-content">
        <p className="muted-copy">
          Markdown 导入正文；JSON
          备份保留分类、标签和状态。所有记录均新增为副本，不覆盖现有知识点。
        </p>
        <input
          ref={fileInput}
          type="file"
          accept=".md,.markdown,.json"
          aria-label="选择导入文件"
          onChange={choose}
          disabled={busy}
        />
        {error && (
          <p className="form-alert" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="form-success" role="status">
            {message}
          </p>
        )}
        {!!records.length && (
          <>
            <p>待导入 {records.length} 条，请确认：</p>
            <ul className="import-preview">
              {records.map((record, index) => (
                <li key={index}>
                  <strong>{record.title}</strong>
                  <small>
                    {record.category || '未分类'} ·{' '}
                    {(record.tags || []).join('、') || '无标签'}
                  </small>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      <div className="modal-footer">
        <button className="button" onClick={onClose} disabled={busy}>
          关闭
        </button>
        <button
          className="button button-primary"
          onClick={importNow}
          disabled={busy || !records.length}
        >
          {busy
            ? '正在导入…'
            : `确认导入${records.length ? ' ' + records.length + ' 条' : ''}`}
        </button>
      </div>
    </Modal>
  )
}
