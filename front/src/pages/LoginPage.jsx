import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { getApiErrorMessage } from '../api/client'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { isAuthenticated, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (isAuthenticated) return <Navigate to="/" replace />

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(form)
      navigate(location.state?.from?.pathname || '/', { replace: true })
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, '登录失败，请检查邮箱和密码'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthPageShell
      eyebrow="WELCOME BACK"
      title="继续你的学习旅程"
      description="把今天学到的内容讲出来，让理解留下清晰的痕迹。"
      footer={
        <>
          还没有账号？ <Link to="/register">创建一个账号</Link>
        </>
      }
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        {error && <p className="form-alert">{error}</p>}
        <label>
          邮箱
          <input
            type="email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
        </label>
        <label>
          密码
          <input
            type="password"
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
            placeholder="输入登录密码"
            autoComplete="current-password"
            required
          />
        </label>
        <button className="button button-primary button-wide" disabled={submitting}>
          {submitting ? '正在登录…' : '登录平台'}
        </button>
      </form>
    </AuthPageShell>
  )
}

function AuthPageShell({ eyebrow, title, description, children, footer }) {
  return (
    <div className="auth-page">
      <div className="auth-aside">
        <Link className="brand brand-light" to="/login">
          <span className="brand-mark">F</span>
          <span>
            <strong>费曼学习平台</strong>
            <small>Feynman Learning Platform</small>
          </span>
        </Link>
        <div className="quote-block">
          <span className="quote-mark">“</span>
          <p>如果你不能用简单的语言解释它，说明你还没有真正理解它。</p>
          <span className="quote-source">— Richard Feynman</span>
        </div>
      </div>
      <div className="auth-panel">
        <div className="auth-card">
          <span className="eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          <p className="auth-description">{description}</p>
          {children}
          <p className="auth-footer">{footer}</p>
        </div>
      </div>
    </div>
  )
}
