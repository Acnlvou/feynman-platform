import { useEffect, useRef, useState } from 'react'
import { Link, useBlocker, useLocation, useParams } from 'react-router-dom'
import apiClient, { getApiErrorMessage } from '../api/client'
import MarkdownRenderer from '../components/MarkdownRenderer'
import PageState from '../components/PageState'
import Icon from '../components/Icon'
import useSpeechRecorder from '../hooks/useSpeechRecorder'
import AiEvaluation from '../components/AiEvaluation'
import { getKnowledgeReturn } from '../utils/knowledgeNavigation'
import { useAuth } from '../context/AuthContext'
import useSessionDraft from '../hooks/useSessionDraft'

const labels = {
  idle: '准备录音',
  requesting: '正在请求麦克风…',
  recording: '正在录音',
  paused: '录音已暂停',
  processing: '正在转换音频…',
  ready: '录音已就绪',
}
const formatTime = (value) => {
  const seconds = Math.max(0, Math.floor(value))
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

export default function FeynmanRecordPage() {
  const { id } = useParams()
  return <RecordSession key={id} id={id} />
}
function RecordSession({ id }) {
  const { isAuthenticated, discarding } = useAuth()
  const location = useLocation()
  const { returnTo } = getKnowledgeReturn(location.state)
  const recorder = useSpeechRecorder()
  const [point, setPoint] = useState(null)
  const [evaluationTarget, setEvaluationTarget] = useState(null)
  const [evaluating, setEvaluating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [pointError, setPointError] = useState('')
  const [attempts, setAttempts] = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState('')
  const [text, setText] = useState('')
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [tab, setTab] = useState('attempt')
  const [recognizedDuration, setRecognizedDuration] = useState(null)
  const saveKey = useRef(null)
  const alive = useRef(true)
  const requests = useRef(new Set())
  const operation = useRef(false)
  const phaseBusy = [
    'requesting',
    'recording',
    'paused',
    'processing',
  ].includes(recorder.status)
  const hasUnsaved = dirty || phaseBusy || Boolean(busy) || evaluating
  useSessionDraft(hasUnsaved, () => {
    recorder.stopForSession()
    requests.current.forEach((request) => request.abort())
    operation.current = false
    setBusy('')
    setEvaluationTarget(null)
    setEvaluating(false)
  })
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      hasUnsaved &&
      !discarding &&
      (currentLocation.pathname !== nextLocation.pathname ||
        currentLocation.search !== nextLocation.search),
  )
  useEffect(() => {
    if (blocker.state !== 'blocked') return
    if (
      window.confirm('录音或复述尚未保存，确定离开吗？正在进行的请求将取消。')
    )
      blocker.proceed()
    else blocker.reset()
  }, [blocker])
  useEffect(() => {
    if (!hasUnsaved || discarding) return
    const prevent = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', prevent)
    return () => window.removeEventListener('beforeunload', prevent)
  }, [hasUnsaved, discarding])
  const controller = () => {
    const value = new AbortController()
    requests.current.add(value)
    return value
  }
  const loadPoint = async (signal) => {
    setLoading(true)
    setPointError('')
    try {
      const response = await apiClient.get(`/knowledge-points/${id}`, {
        signal,
      })
      if (!signal.aborted) setPoint(response.data.data)
    } catch (error) {
      if (!signal.aborted)
        setPointError(getApiErrorMessage(error, '知识点加载失败'))
    } finally {
      if (!signal.aborted) setLoading(false)
    }
  }
  const loadHistory = async (signal) => {
    setHistoryLoading(true)
    setHistoryError('')
    try {
      const response = await apiClient.get(`/knowledge-points/${id}/attempts`, {
        signal,
      })
      if (!signal.aborted) setAttempts(response.data.data)
    } catch (error) {
      if (!signal.aborted)
        setHistoryError(getApiErrorMessage(error, '无法加载历史复述'))
    } finally {
      if (!signal.aborted) setHistoryLoading(false)
    }
  }
  const reload = async (loader) => {
    const request = controller()
    try {
      await loader(request.signal)
    } finally {
      requests.current.delete(request)
    }
  }
  useEffect(() => {
    alive.current = true
    reload(loadPoint)
    reload(loadHistory)
    return () => {
      alive.current = false
      requests.current.forEach((request) => request.abort())
      requests.current.clear()
    }
  }, [id])

  const start = async () => {
    if (!isAuthenticated || busy || phaseBusy) return
    if (
      hasUnsaved &&
      !window.confirm('重新录制会丢弃本次未保存的录音和文字，确定继续吗？')
    )
      return
    setError('')
    setNotice('')
    setText('')
    setDirty(false)
    setRecognizedDuration(null)
    saveKey.current = null
    const started = await recorder.start()
    if (alive.current && started) setDirty(true)
  }
  const transcribe = async () => {
    if (!isAuthenticated || !recorder.audio || operation.current || phaseBusy) return
    if (text.trim() && !window.confirm('重新识别将替换当前文字，确定继续吗？'))
      return
    operation.current = true
    setBusy('transcribe')
    setError('')
    setNotice('')
    const request = controller()
    try {
      const form = new FormData()
      form.append(
        'audio',
        new File([recorder.audio.blob], 'retelling.wav', { type: 'audio/wav' }),
      )
      form.append('knowledgePointId', id)
      const response = await apiClient.post('/audio/transcribe', form, {
        signal: request.signal,
        timeout: 45000,
      })
      if (!alive.current) return
      setText(response.data.data.text)
      setRecognizedDuration(response.data.data.duration)
      saveKey.current = null
      setDirty(true)
      setNotice('识别完成，可修改文字后保存')
    } catch (error) {
      if (alive.current && !request.signal.aborted)
        setError(getApiErrorMessage(error, '识别失败，录音已保留，可手动重试'))
    } finally {
      requests.current.delete(request)
      operation.current = false
      if (alive.current) setBusy('')
    }
  }
  const save = async (withEvaluation = false) => {
    if (
      !isAuthenticated ||
      operation.current ||
      phaseBusy ||
      !recorder.audio ||
      !text.trim() ||
      text.trim().length > 5000
    )
      return
    operation.current = true
    setBusy('save')
    setError('')
    setNotice('')
    const request = controller()
    try {
      // 失败重试复用同一标识；文字变化或重新录制才开启一次新保存。
      saveKey.current ||= crypto.randomUUID()
      const response = await apiClient.post(
        `/knowledge-points/${id}/attempts`,
        {
          text: text.trim(),
          duration: recognizedDuration ?? recorder.audio.duration,
          saveKey: saveKey.current,
        },
        { signal: request.signal, timeout: 20000 },
      )
      if (!alive.current) return
      setText(response.data.data.text)
      setDirty(false)
      setNotice('复述已保存')
      if (withEvaluation)
        setEvaluationTarget({
          attempt: response.data.data,
          needsEvaluation: true,
        })
      // 即使历史刷新失败，已确认的保存结果也立即可见。
      setAttempts((current) =>
        [
          response.data.data,
          ...current.filter((item) => item._id !== response.data.data._id),
        ].slice(0, 20),
      )
      await loadHistory(request.signal)
    } catch (error) {
      if (alive.current && !request.signal.aborted)
        setError(getApiErrorMessage(error, '保存失败，文字已保留，请重试'))
    } finally {
      requests.current.delete(request)
      operation.current = false
      if (alive.current) setBusy('')
    }
  }

  if (loading) return <PageState loading fullPage />
  if (pointError || !point)
    return (
      <PageState
        fullPage
        title="无法打开录音复述"
        message={pointError}
        retry={() => reload(loadPoint)}
      >
        <Link className="button" to={`/knowledge/${id}`} state={{ returnTo }}>
          返回详情
        </Link>
      </PageState>
    )
  return (
    <section className={`record-page record-tab-${tab}`}>
      <header className="record-heading">
        <Link className="back-link" to={`/knowledge/${id}`} state={{ returnTo }}>
          <Icon name="arrow" size={18} />
          返回详情
        </Link>
        <h1 title={point.title}>录音复述 · {point.title}</h1>
      </header>
      <div className="record-mobile-tabs" role="tablist" aria-label="复述视图">
        <button
          role="tab"
          aria-selected={tab === 'original'}
          aria-controls="record-original"
          id="original-tab"
          onClick={() => setTab('original')}
        >
          原文参考
        </button>
        <button
          role="tab"
          aria-selected={tab === 'attempt'}
          aria-controls="record-attempt"
          id="attempt-tab"
          onClick={() => setTab('attempt')}
        >
          录音与复述
        </button>
      </div>
      <div className="record-workspace">
        <section
          className="record-original"
          id="record-original"
          aria-label="原文参考"
        >
          <h2>原文参考</h2>
          <div className="record-original-body" tabIndex={0}>
            <MarkdownRenderer content={point.content} />
          </div>
        </section>
        <div
          className="record-attempt"
          id="record-attempt"
          aria-label="录音与复述"
        >
          <section className="recorder-controls" aria-label="录音控制">
            <div className="recorder-state">
              <strong role="status">{labels[recorder.status]}</strong>
              <span aria-label="录音时长">
                {formatTime(recorder.seconds)} / 00:59
              </span>
            </div>
            <div className="record-buttons">
              <button
                className="button"
                onClick={start}
                disabled={
                  !isAuthenticated || Boolean(busy) || phaseBusy || Boolean(recorder.unsupported)
                }
              >
                {recorder.playback ? '重新录制' : '开始录音'}
              </button>
              {recorder.status === 'recording' && (
                <button className="button" onClick={recorder.pause}>
                  暂停
                </button>
              )}
              {recorder.status === 'paused' && (
                <button className="button" onClick={recorder.resume} disabled={!isAuthenticated}>
                  继续
                </button>
              )}
              {['recording', 'paused'].includes(recorder.status) && (
                <button className="button danger" onClick={recorder.stop}>
                  停止录音
                </button>
              )}
            </div>
            {recorder.playback && (
              <audio
                key={recorder.playback}
                controls
                preload="metadata"
                src={recorder.playback}
                aria-label="录音回放"
              />
            )}
            <p className="record-hint">
              最长59秒，暂停不计时。点击“转成文字”才会将音频发送至百度识别；本站不保存音频。
            </p>
            {(recorder.unsupported || recorder.error) && (
              <p className="form-alert" role="alert">
                {recorder.unsupported || recorder.error}
              </p>
            )}
          </section>
          <section className="record-draft" aria-label="本次复述">
            <label htmlFor="retelling-text">
              本次复述 <span>{text.length}/5000</span>
            </label>
            <textarea
              id="retelling-text"
              value={text}
              disabled={Boolean(busy) || phaseBusy}
              maxLength={5000}
              placeholder="录音后点击“转成文字”，识别结果会显示在这里，也可以修改后保存。"
              onChange={(event) => {
                setText(event.target.value)
                setDirty(true)
                saveKey.current = null
                setNotice('')
              }}
            />
          </section>
          <section className="record-history" aria-label="历史复述">
            <div className="record-history-heading">
              <h2>最近20次复述</h2>
              <button
                className="button button-small"
                onClick={() => reload(loadHistory)}
                disabled={!isAuthenticated || historyLoading || Boolean(busy)}
              >
                刷新
              </button>
            </div>
            <div className="record-history-body" tabIndex={0}>
              {historyLoading && (
                <p className="muted-copy">正在加载历史复述…</p>
              )}
              {historyError && (
                <p className="form-alert" role="alert">
                  {historyError}，可点击刷新重试。
                </p>
              )}
              {!historyLoading && !historyError && !attempts.length && (
                <p className="muted-copy">还没有保存过复述。</p>
              )}
              {attempts.map((attempt) => (
                <article key={attempt._id}>
                  <small>
                    {new Date(attempt.createdAt).toLocaleString('zh-CN')} ·{' '}
                    {Number(attempt.duration).toFixed(1)}秒
                  </small>
                  <p>{attempt.text}</p>
                  <button
                    className="button button-small"
                    disabled={!isAuthenticated || Boolean(busy) || phaseBusy}
                    onClick={() =>
                      setEvaluationTarget({
                        attempt,
                        needsEvaluation: !attempt.hasEvaluation,
                      })
                    }
                  >
                    {attempt.hasEvaluation ? '查看评价' : 'AI评价'}
                  </button>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
      <footer className="record-footer">
        <div className="record-feedback" aria-live="polite">
          {error ? (
            <span role="alert" className="record-error">
              {error}
            </span>
          ) : (
            notice ||
            (dirty ? '本次复述尚未保存' : '录音仅供本次使用，保存后保留文字')
          )}
        </div>
        <div className="record-buttons">
          <button
            className="button"
            disabled={!isAuthenticated || !recorder.audio || Boolean(busy) || phaseBusy}
            onClick={transcribe}
          >
            {busy === 'transcribe'
              ? '正在识别…'
              : text
                ? '重新识别'
                : '转成文字'}
          </button>
          <button
            className="button button-primary"
            disabled={
              !isAuthenticated ||
              !recorder.audio ||
              !text.trim() ||
              !dirty ||
              Boolean(busy) ||
              phaseBusy
            }
            onClick={() => save(false)}
          >
            {busy === 'save' ? '正在保存…' : '保存复述'}
          </button>
          <button
            className="button button-primary"
            disabled={
              !isAuthenticated || !recorder.audio || !text.trim() || Boolean(busy) || phaseBusy
            }
            onClick={() => save(true)}
          >
            保存并AI评价
          </button>
        </div>
      </footer>
      {evaluationTarget && (
        <AiEvaluation
          pointId={id}
          attempt={evaluationTarget.attempt}
          needsEvaluation={evaluationTarget.needsEvaluation}
          onBusy={setEvaluating}
          onClose={() => {
            setEvaluationTarget(null)
            setEvaluating(false)
          }}
          onSaved={(attemptId) =>
            setAttempts((current) =>
              current.map((item) =>
                item._id === attemptId
                  ? { ...item, hasEvaluation: true }
                  : item,
              ),
            )
          }
        />
      )}
    </section>
  )
}
