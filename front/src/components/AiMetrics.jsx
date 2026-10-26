import { useEffect, useRef, useState } from 'react'
import apiClient, { getApiErrorMessage } from '../api/client'
export default function AiMetrics() {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const controller = useRef(null)
  useEffect(() => () => controller.current?.abort(), [])
  const load = async () => {
    controller.current?.abort()
    const request = new AbortController()
    controller.current = request
    setLoading(true)
    setError('')
    try {
      const response = await apiClient.get('/ai/metrics', {
        signal: request.signal,
      })
      if (!request.signal.aborted) setRows(response.data.data)
    } catch (error) {
      if (!request.signal.aborted)
        setError(getApiErrorMessage(error, '服务记录暂不可用'))
    } finally {
      if (!request.signal.aborted) setLoading(false)
    }
  }
  return (
    <details
      className="surface ai-metrics"
      open={open}
      onToggle={(event) => {
        const next = event.currentTarget.open
        setOpen(next)
        if (next && rows === null && !loading && !error) load()
      }}
    >
      <summary>AI服务记录</summary>
      <div className="ai-metrics-content">
        <p className="muted-copy">
          仅统计你的 DeepSeek 调用，包括复述评价、出题和简答评分；单选判分不调用模型。成功率与平均耗时不含取消请求，模型结果校验失败也计为失败；缺少的历史统计无法补录。
        </p>
        <button
          className="button button-small"
          disabled={loading}
          onClick={load}
        >
          {loading ? '读取中…' : '刷新记录'}
        </button>
        {error && (
          <p className="form-alert" role="alert">
            {error}
          </p>
        )}
        {rows && (
          <div className="ai-metrics-table">
            <table>
              <thead>
                <tr>
                  <th>服务</th>
                  <th>配置</th>
                  <th>调用</th>
                  <th>成功率</th>
                  <th>平均耗时</th>
                  <th>取消</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.provider}>
                    <th>{row.name}</th>
                    <td>{row.configured ? '已配置' : '未配置'}</td>
                    <td>{row.calls}</td>
                    <td>
                      {row.successRate === null
                        ? '—'
                        : `${(row.successRate * 100).toFixed(1)}%`}
                    </td>
                    <td>
                      {row.averageDurationMs === null
                        ? '—'
                        : `${(row.averageDurationMs / 1000).toFixed(1)}秒`}
                    </td>
                    <td>{row.cancelled}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </details>
  )
}
