import { useEffect, useRef, useState } from 'react'
import Modal from './Modal'
import apiClient, { getApiErrorMessage } from '../api/client'

export default function AiEvaluation({
  pointId,
  attempt,
  needsEvaluation = false,
  onClose,
  onSaved,
  onBusy,
}) {
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const request = useRef(null)
  const mounted = useRef(false)
  const saved = useRef(onSaved)
  saved.current = onSaved
  const run = async (evaluate) => {
    if (request.current) return
    const controller = new AbortController()
    request.current = controller
    setBusy(true)
    setError('')
    onBusy(true)
    try {
      const base = `/knowledge-points/${pointId}/attempts/${attempt._id}`
      const response = evaluate
        ? await apiClient.post(
            `${base}/evaluate`,
            {},
            { signal: controller.signal, timeout: 105000 },
          )
        : await apiClient.get(`${base}/evaluation`, {
            signal: controller.signal,
          })
      if (!mounted.current || controller.signal.aborted) return
      setData(response.data.data)
      saved.current(attempt._id)
    } catch (error) {
      if (mounted.current && !controller.signal.aborted)
        setError(getApiErrorMessage(error, 'AI评价暂不可用，请手动重试'))
    } finally {
      if (request.current === controller) {
        request.current = null
        if (mounted.current) {
          setBusy(false)
          onBusy(false)
        }
      }
    }
  }
  useEffect(() => {
    mounted.current = true
    // 只有用户明确点击评价时才POST，挂载只GET，避免开发模式重复挂载产生付费调用。
    if (!needsEvaluation) run(false)
    return () => {
      mounted.current = false
      request.current?.abort()
      request.current = null
    }
  }, [pointId, attempt._id])
  const evaluation = data?.evaluation
  const retryReview =
    evaluation && ['pending', 'failed'].includes(evaluation.reviewStatus)
  return (
    <Modal title="AI学习评价" onClose={onClose} wide>
      <div className="ai-evaluation-body">
        <p className="muted-copy">
          评价会将知识点原文和复述文字发送至已配置的 DeepSeek 服务。润色不会覆盖原始复述；AI 评分仅供学习参考。
        </p>
        {busy && <p role="status">AI教练正在批阅或读取结果，请稍候…</p>}
        {error && (
          <p className="form-alert" role="alert">
            {error}
          </p>
        )}
        {data?.sourceChanged && (
          <p className="form-alert">
            知识点原文已改变，本评价基于保存的旧版原文。
          </p>
        )}
        {evaluation && (
          <>
            <div className="ai-result-summary">
              <strong>
                {evaluation.score}
                <small> / 100</small>
              </strong>
              <span>
                {evaluation.providerName} · {evaluation.model}
                <br />
                {new Date(evaluation.evaluatedAt).toLocaleString(
                  'zh-CN',
                )} · {(evaluation.durationMs / 1000).toFixed(1)}秒
              </span>
            </div>
            {evaluation.metricsIncomplete && (
              <p className="form-alert">
                本轮部分服务统计未写入，累计记录可能不完整；评价已保存。
              </p>
            )}
            {evaluation.reviewStatus === 'applied' && (
              <p className="form-success">
                本次低分评价已完成待复习标记，不会因重复查看再次强制设置。
              </p>
            )}
            {evaluation.reviewStatus === 'source_changed' && (
              <p className="form-alert">
                原文已变化，未自动加入复习，请根据当前内容手动决定。
              </p>
            )}
            {retryReview && (
              <p className="form-alert">
                评价已保存，但复习标记尚未完成，可点击下方补做，不会重复调用模型。
              </p>
            )}
          </>
        )}
        <section>
          <h3>原始复述</h3>
          <p className="ai-plain-text">{data?.originalText ?? attempt.text}</p>
        </section>
        {evaluation && (
          <>
            <section>
              <h3>润色文本</h3>
              <p className="ai-plain-text">{evaluation.polishedText}</p>
            </section>
            {[
              ['strengths', '优点'],
              ['issues', '问题与遗漏'],
              ['suggestions', '改进建议'],
            ].map(([field, title]) => (
              <section key={field}>
                <h3>{title}</h3>
                {evaluation[field].length ? (
                  <ul>
                    {evaluation[field].map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted-copy">模型未列出此类条目。</p>
                )}
              </section>
            ))}
          </>
        )}
      </div>
      <div className="modal-footer">
        <span className="muted-copy">
          关闭窗口会取消尚在等待的请求；已发送的调用可能已计费。
        </span>
        <button className="button" onClick={onClose}>
          {busy ? '取消并关闭' : '关闭'}
        </button>
        {(!evaluation || retryReview) && (
          <button
            className="button button-primary"
            disabled={busy}
            onClick={() => run(true)}
          >
            {retryReview
              ? '补做复习标记'
              : error
                ? '重试评价／保存'
                : '开始AI评价'}
          </button>
        )}
      </div>
    </Modal>
  )
}
