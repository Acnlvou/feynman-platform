import { useEffect, useRef, useState } from 'react'
import {
  Link,
  useBlocker,
  useLocation,
  useParams,
  useSearchParams,
} from 'react-router-dom'
import apiClient, { getApiErrorMessage } from '../api/client'
import { useAuth } from '../context/AuthContext'
import useSessionDraft from '../hooks/useSessionDraft'
import { getKnowledgeReturn } from '../utils/knowledgeNavigation'
import MarkdownRenderer from '../components/MarkdownRenderer'
import Modal from '../components/Modal'
import PageState from '../components/PageState'
import Icon from '../components/Icon'

const types = { 'single-choice': '单选题', 'short-answer': '简答题' }
const difficulties = { basic: '基础', medium: '中等', hard: '困难' }
const statuses = {
  generating: '正在出题',
  generation_failed: '出题未完成',
  awaiting_answer: '等待作答',
  grading: '正在评分',
  grading_failed: '评分未完成',
  completed: '已完成',
}
export default function QuizPage() {
  const { id } = useParams()
  return <QuizSession key={id} id={id} />
}
function QuizSession({ id }) {
  const location = useLocation()
  const { returnTo } = getKnowledgeReturn(location.state)
  const { isAuthenticated, discarding } = useAuth()
  const [params, setParams] = useSearchParams()
  const quizId = params.get('quiz') || ''
  const currentQuizId = useRef(quizId)
  currentQuizId.current = quizId
  const [point, setPoint] = useState(null)
  const [pointLoading, setPointLoading] = useState(true)
  const [pointError, setPointError] = useState('')
  const [quiz, setQuiz] = useState(null)
  const [quizLoading, setQuizLoading] = useState(false)
  const [type, setType] = useState('single-choice')
  const [difficulty, setDifficulty] = useState('basic')
  const [answer, setAnswer] = useState('')
  const [submitted, setSubmitted] = useState(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const alive = useRef(false)
  const operation = useRef(null)
  const pendingGeneration = useRef(null)
  const allowNavigation = useRef(false)
  const pointRequest = useRef(null)
  const historyRequest = useRef(null)
  const reading = useRef(null)
  const locked = quiz?.answer !== undefined || submitted !== null
  const draft = Boolean(
    quiz?.question &&
      !quiz?.result &&
      quiz?.answer === undefined &&
      (answer || submitted !== null),
  )
  const hasUnsaved = draft || Boolean(busy)
  useSessionDraft(hasUnsaved, () => {
    operation.current?.abort()
    reading.current?.abort()
    historyRequest.current?.abort()
    setQuizLoading(false)
    setHistoryOpen(false)
  })
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      hasUnsaved &&
      !discarding &&
      !allowNavigation.current &&
      (currentLocation.pathname !== nextLocation.pathname ||
        currentLocation.search !== nextLocation.search),
  )
  useEffect(() => {
    if (blocker.state !== 'blocked') return
    if (
      window.confirm(
        '当前答案尚未确认保存，或AI请求仍在进行。确定离开吗？已发出的调用可能已计费。',
      )
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
  useEffect(() => {
    allowNavigation.current = false
  }, [location.key])

  const navigateQuiz = (value) => {
    if (value === currentQuizId.current) return
    currentQuizId.current = value
    allowNavigation.current = true
    setParams(value ? { quiz: value } : {}, {
      replace: true,
      state: { returnTo },
    })
  }
  const applyQuiz = (value) => {
    setQuiz(value)
    setType(value.type)
    setDifficulty(value.difficulty)
    setAnswer(value.answer ?? '')
    setSubmitted(null)
    pendingGeneration.current = value.question
      ? null
      : {
          type: value.type,
          difficulty: value.difficulty,
          requestKey: value.requestKey,
        }
  }
  const loadPoint = async () => {
    pointRequest.current?.abort()
    const request = new AbortController()
    pointRequest.current = request
    setPointLoading(true)
    setPointError('')
    try {
      const response = await apiClient.get(`/knowledge-points/${id}`, {
        signal: request.signal,
      })
      if (alive.current && !request.signal.aborted) setPoint(response.data.data)
    } catch (requestError) {
      if (alive.current && !request.signal.aborted)
        setPointError(getApiErrorMessage(requestError, '知识点加载失败'))
    } finally {
      if (alive.current && !request.signal.aborted) setPointLoading(false)
    }
  }
  useEffect(() => {
    alive.current = true
    loadPoint()
    return () => {
      alive.current = false
      operation.current?.abort()
      pointRequest.current?.abort()
      historyRequest.current?.abort()
      reading.current?.abort()
    }
  }, [id])
  useEffect(() => {
    reading.current?.abort()
    if (!quizId) {
      setQuiz(null)
      setAnswer('')
      setSubmitted(null)
      setQuizLoading(false)
      return
    }
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(quizId)) {
      pendingGeneration.current = null
      setQuiz(null)
      setAnswer('')
      setSubmitted(null)
      setError('测评编号不正确，请从测评历史重新选择')
      setQuizLoading(false)
      return
    }
    pendingGeneration.current = null
    const request = new AbortController()
    reading.current = request
    setQuizLoading(true)
    setError('')
    setNotice('')
    setQuiz(null)
    setAnswer('')
    setSubmitted(null)
    // 恢复和刷新只读取，不在effect里触发付费请求。
    apiClient
      .get(`/knowledge-points/${id}/quizzes/${quizId}`, {
        signal: request.signal,
      })
      .then((response) => {
        if (!request.signal.aborted) applyQuiz(response.data.data)
      })
      .catch((requestError) => {
        if (!request.signal.aborted)
          setError(getApiErrorMessage(requestError, '测评读取失败'))
      })
      .finally(() => {
        if (!request.signal.aborted) setQuizLoading(false)
      })
    return () => request.abort()
  }, [id, quizId])

  const loadHistory = async () => {
    historyRequest.current?.abort()
    const request = new AbortController()
    historyRequest.current = request
    setHistoryLoading(true)
    setHistoryError('')
    try {
      const response = await apiClient.get(`/knowledge-points/${id}/quizzes`, {
        signal: request.signal,
      })
      if (alive.current && !request.signal.aborted)
        setHistory(response.data.data)
    } catch (requestError) {
      if (alive.current && !request.signal.aborted)
        setHistoryError(getApiErrorMessage(requestError, '历史读取失败'))
    } finally {
      if (alive.current && !request.signal.aborted) setHistoryLoading(false)
    }
  }
  const refreshQuiz = async (confirmed = false) => {
    if (!quizId || operation.current) return
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(quizId)) {
      setError('测评编号不正确，请从测评历史重新选择')
      return
    }
    if (
      draft &&
      !confirmed &&
      !window.confirm('重新读取将用已保存记录替换当前答案，确定继续吗？')
    )
      return
    reading.current?.abort()
    const request = new AbortController()
    reading.current = request
    setQuizLoading(true)
    setError('')
    try {
      const response = await apiClient.get(
        `/knowledge-points/${id}/quizzes/${quizId}`,
        { signal: request.signal },
      )
      if (alive.current && !request.signal.aborted)
        applyQuiz(response.data.data)
    } catch (requestError) {
      if (alive.current && !request.signal.aborted)
        setError(getApiErrorMessage(requestError, '测评读取失败'))
    } finally {
      if (alive.current && !request.signal.aborted) setQuizLoading(false)
    }
  }
  const generate = async (fresh) => {
    if (!isAuthenticated || operation.current || quizLoading) return
    if (
      fresh &&
      draft &&
      !window.confirm('生成新题将放弃当前尚未确认保存的答案，确定继续吗？')
    )
      return
    const input = fresh
      ? { type, difficulty, requestKey: crypto.randomUUID() }
      : pendingGeneration.current
    if (!input) return
    reading.current?.abort()
    pendingGeneration.current = input
    setQuiz(null)
    setAnswer('')
    setSubmitted(null)
    navigateQuiz('')
    const request = new AbortController()
    operation.current = request
    setBusy('generate')
    setError('')
    setNotice('')
    try {
      const response = await apiClient.post(
        `/knowledge-points/${id}/quizzes`,
        input,
        {
          signal: request.signal,
          timeout: 105000,
        },
      )
      if (!alive.current || request.signal.aborted) return
      applyQuiz(response.data.data)
      navigateQuiz(response.data.data._id)
    } catch (requestError) {
      if (alive.current && !request.signal.aborted)
        setError(
          getApiErrorMessage(requestError, '出题失败，请重试或读取测评历史'),
        )
    } finally {
      if (operation.current === request) operation.current = null
      if (alive.current) setBusy('')
    }
  }
  const submit = async () => {
    if (!isAuthenticated || !quiz?.question || operation.current || quizLoading)
      return
    const value = quiz.answer ?? submitted ?? answer.trim()
    if (!value || (quiz.type === 'short-answer' && value.length > 5000)) return
    const request = new AbortController()
    operation.current = request
    setSubmitted(value)
    setBusy('grade')
    setError('')
    setNotice('')
    try {
      const response = await apiClient.post(
        `/knowledge-points/${id}/quizzes/${quiz._id}/answer`,
        { answer: value },
        {
          signal: request.signal,
          timeout: 105000,
        },
      )
      if (alive.current && !request.signal.aborted)
        applyQuiz(response.data.data)
    } catch (requestError) {
      if (alive.current && !request.signal.aborted)
        setError(
          getApiErrorMessage(
            requestError,
            '提交失败，当前答案已保留，可重试评分或补存',
          ),
        )
    } finally {
      if (operation.current === request) operation.current = null
      if (alive.current) setBusy('')
    }
  }
  const chooseHistory = (value) => {
    if (
      draft &&
      !window.confirm('打开历史记录将放弃当前尚未确认保存的答案，确定继续吗？')
    )
      return
    setHistoryOpen(false)
    if (value === quizId) {
      setSubmitted(null)
      refreshQuiz(true)
    } else navigateQuiz(value)
  }
  const result = quiz?.result
  const retryReview =
    result &&
    (['pending', 'failed'].includes(result.reviewStatus) ||
      result.reviewRecordingIncomplete)
  const disabled = !isAuthenticated || Boolean(busy) || quizLoading

  if (pointLoading) return <PageState loading fullPage />
  if (pointError || !point)
    return (
      <PageState
        fullPage
        title="无法打开测评"
        message={pointError}
        retry={loadPoint}
      >
        <Link className="button" to={`/knowledge/${id}`} state={{ returnTo }}>
          返回详情
        </Link>
      </PageState>
    )
  return (
    <section className="quiz-page">
      <header className="quiz-heading">
        <Link
          className="back-link"
          to={`/knowledge/${id}`}
          state={{ returnTo }}
        >
          <Icon name="arrow" size={18} />
          返回详情
        </Link>
        <h1 title={point.title}>知识点测评 · {point.title}</h1>
        <button
          className="button button-small"
          disabled={disabled}
          onClick={() => {
            setHistoryOpen(true)
            loadHistory()
          }}
        >
          测评历史
        </button>
      </header>
      <div className="quiz-toolbar">
        <label>
          题型
          <select
            value={type}
            disabled={disabled}
            onChange={(event) => setType(event.target.value)}
            aria-label="测评题型"
          >
            {Object.entries(types).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          难度
          <select
            value={difficulty}
            disabled={disabled}
            onChange={(event) => setDifficulty(event.target.value)}
            aria-label="测评难度"
          >
            {Object.entries(difficulties).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <span className="muted-copy">用于下一道题，每次生成一道。</span>
      </div>
      <div className="quiz-body" aria-label="题目与结果" tabIndex={0}>
        {quizLoading ? (
          <PageState loading fullPage />
        ) : (
          <div className="quiz-content">
            {(error || quiz?.operationError) && (
              <p className="form-alert" role="alert">
                {error || quiz.operationError}
              </p>
            )}
            {notice && (
              <p className="form-success" role="status">
                {notice}
              </p>
            )}
            {busy && (
              <p role="status">
                {busy === 'generate'
                  ? 'DeepSeek正在出题…'
                  : '正在判分或保存结果…'}
              </p>
            )}
            {quiz?.sourceChanged && (
              <p className="form-alert">
                知识点原文已变化，本题仍基于“{quiz.sourceTitle}”的第
                {quiz.sourceRevision}版内容；答错时不会自动修改当前复习标记。
              </p>
            )}
            {!quiz?.question ? (
              <PageState
                title={
                  quiz ? statuses[quiz.status] : '选择题型和难度，开始练习'
                }
                message="出题前会将知识点原文发送至DeepSeek；读取已有题目不调用模型。刷新出题中的页面后，可从历史读取状态并手动重试。"
              />
            ) : (
              <>
                <div className="quiz-question-meta">
                  <span>
                    {types[quiz.type]} · {difficulties[quiz.difficulty]}
                  </span>
                  <span>{statuses[quiz.status]}</span>
                </div>
                <MarkdownRenderer content={quiz.question.text} />
                {quiz.type === 'single-choice' ? (
                  <fieldset
                    className="quiz-options"
                    disabled={disabled || locked || Boolean(result)}
                  >
                    <legend>选择一个答案</legend>
                    {Object.entries(quiz.question.options).map(
                      ([key, value]) => (
                        <label
                          className={`quiz-option${answer === key ? ' selected' : ''}`}
                          key={key}
                        >
                          <input
                            type="radio"
                            name={`quiz-${quiz._id}`}
                            value={key}
                            checked={answer === key}
                            onChange={() => setAnswer(key)}
                          />
                          <strong>{key}</strong>
                          <MarkdownRenderer content={value} />
                        </label>
                      ),
                    )}
                  </fieldset>
                ) : (
                  <label className="quiz-short-answer">
                    你的回答 <span>{answer.length}/5000</span>
                    <textarea
                      value={answer}
                      maxLength={5000}
                      readOnly={locked || Boolean(result)}
                      disabled={Boolean(busy)}
                      onChange={(event) => setAnswer(event.target.value)}
                      placeholder="用自己的话作答。提交后答案锁定，可重试评分，不能改为另一个答案。"
                    />
                  </label>
                )}
                {locked && !result && (
                  <p className="muted-copy">
                    本次提交使用的答案已锁定。失败重试会复用同一答案；响应丢失时可先读取记录确认状态。
                  </p>
                )}
                {quiz.type === 'short-answer' && !result && (
                  <p className="muted-copy">
                    提交简答时，原文快照、题目、答案要点和你的回答将发送给DeepSeek评分。
                  </p>
                )}
                {quiz.generation && (
                  <p className="quiz-model">
                    出题：{quiz.generation.providerName} ·{' '}
                    {quiz.generation.model} ·{' '}
                    {(quiz.generation.durationMs / 1000).toFixed(1)}秒
                  </p>
                )}
                {quiz.generation?.metricsIncomplete && (
                  <p className="form-alert">
                    本次出题统计记录不完整，题目已保存。
                  </p>
                )}
                {result && (
                  <section className="quiz-result" aria-label="测评结果">
                    <h2>
                      {result.isCorrect ? '回答正确' : '需要改进'} ·{' '}
                      {result.score}分
                    </h2>
                    <p className="muted-copy">
                      {result.providerName}
                      {result.model ? ` · ${result.model}` : ''} ·{' '}
                      {new Date(result.evaluatedAt).toLocaleString('zh-CN')}
                    </p>
                    {result.correctAnswer && (
                      <p>
                        正确答案：{result.correctAnswer}；你的选择：
                        {quiz.answer}
                      </p>
                    )}
                    <MarkdownRenderer content={result.explanation} />
                    {result.answerKeyPoints && (
                      <>
                        <h3>答案要点</h3>
                        <ul>
                          {result.answerKeyPoints.map((item, index) => (
                            <li key={index}>{item}</li>
                          ))}
                        </ul>
                        <p className="muted-copy">
                          简答题60分及以上视为答对，AI评分仅供学习参考。
                        </p>
                      </>
                    )}
                    {result.reviewStatus === 'applied' && (
                      <p className="form-success">
                        已加入待复习，学习状态保持原状。
                      </p>
                    )}
                    {result.reviewStatus === 'source_changed' && (
                      <p className="form-alert">
                        原文已变化，本次未自动标记复习。
                      </p>
                    )}
                    {['pending', 'failed'].includes(result.reviewStatus) && (
                      <p className="form-alert">
                        评分已保存，但复习标记未完成，可在下方补做。
                      </p>
                    )}
                    {result.reviewRecordingIncomplete && (
                      <p className="form-alert">
                        复习操作状态未能完整写回，请读取记录后补做确认。
                      </p>
                    )}
                    {result.metricsIncomplete && (
                      <p className="form-alert">
                        评分统计写入不完整，结果已保存。
                      </p>
                    )}
                  </section>
                )}
              </>
            )}
          </div>
        )}
      </div>
      <footer className="quiz-footer">
        <span className="muted-copy">
          出题会发送知识点原文，简答评分会发送你的答案至DeepSeek，可能计费。
        </span>
        <div className="quiz-actions">
          {busy ? (
            <button
              className="button"
              onClick={() => {
                operation.current?.abort()
                setNotice(
                  '已取消等待。已发出的请求可能完成或计费，可读取记录、历史或手动重试。',
                )
              }}
            >
              取消等待
            </button>
          ) : (
            <>
              {quizId && (
                <button
                  className="button"
                  disabled={disabled}
                  onClick={() => refreshQuiz()}
                >
                  读取记录
                </button>
              )}
              {!quiz?.question && pendingGeneration.current && (
                <button
                  className="button"
                  disabled={disabled}
                  onClick={() => generate(false)}
                >
                  重试出题／补存
                </button>
              )}
              <button
                className="button"
                disabled={disabled}
                onClick={() => generate(true)}
              >
                {quiz?.question ? '下一题' : '生成新题'}
              </button>
              {quiz?.question && (!result || retryReview) && (
                <button
                  className="button button-primary"
                  disabled={
                    disabled || !(quiz.answer ?? submitted ?? answer.trim())
                  }
                  onClick={submit}
                >
                  {result
                    ? '补做复习标记'
                    : locked
                      ? '重试评分／补存'
                      : '提交答案'}
                </button>
              )}
            </>
          )}
        </div>
      </footer>
      {historyOpen && (
        <Modal
          title="最近20次测评"
          onClose={() => {
            setHistoryOpen(false)
            historyRequest.current?.abort()
          }}
          wide
        >
          <div className="quiz-history-body">
            {historyLoading ? (
              <PageState loading />
            ) : historyError ? (
              <PageState
                title="测评历史暂不可用"
                message={historyError}
                retry={loadHistory}
              />
            ) : !history.length ? (
              <PageState
                title="还没有测评记录"
                message="生成第一道题后，记录会显示在这里。"
              />
            ) : (
              history.map((item) => (
                <button
                  type="button"
                  className="quiz-history-row"
                  key={item._id}
                  onClick={() => chooseHistory(item._id)}
                >
                  <strong>{item.title}</strong>
                  <span>
                    {types[item.type]} · {difficulties[item.difficulty]} ·{' '}
                    {statuses[item.status]}
                    {item.score !== undefined ? ` · ${item.score}分` : ''}
                  </span>
                  <time>
                    {new Date(item.createdAt).toLocaleString('zh-CN')}
                  </time>
                </button>
              ))
            )}
          </div>
        </Modal>
      )}
    </section>
  )
}
