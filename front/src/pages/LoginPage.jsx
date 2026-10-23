import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { getApiErrorMessage } from '../api/client'
import { useAuth } from '../context/AuthContext'
import AuthPageShell from '../components/AuthPageShell'

export default function LoginPage() {
  const { isAuthenticated, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const from = location.state?.from
  const destination = from
    ? `${from.pathname}${from.search || ''}${from.hash || ''}`
    : '/knowledge'
  if (isAuthenticated) return <Navigate to={destination} replace />

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(form)
      navigate(destination, { replace: true })
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, '登录失败，请检查邮箱和密码'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthPageShell
      title="登录学习空间"
      description="欢迎回来，继续整理你的知识。"
      footer={
        <>
          还没有账号？{' '}
          <Link to="/register" state={location.state}>
            创建一个账号
          </Link>
        </>
      }
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        {error && (
          <p className="form-alert" role="alert">
            {error}
          </p>
        )}
        <label>
          邮箱
          <input
            type="email"
            value={form.email}
            onChange={(event) =>
              setForm({ ...form, email: event.target.value })
            }
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
            onChange={(event) =>
              setForm({ ...form, password: event.target.value })
            }
            placeholder="输入登录密码"
            autoComplete="current-password"
            required
          />
        </label>
        <button
          className="button button-primary button-wide"
          disabled={submitting}
        >
          {submitting ? '正在登录…' : '登录平台'}
        </button>
      </form>
    </AuthPageShell>
  )
}
