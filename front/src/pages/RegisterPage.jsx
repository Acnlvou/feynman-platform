import { useState } from 'react'
import { Link, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { getApiErrorMessage } from '../api/client'
import { useAuth } from '../context/AuthContext'
import AuthPageShell from '../components/AuthPageShell'
import { getLoginDestination } from '../utils/authSession'

export default function RegisterPage() {
  const { isAuthenticated, register } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ username: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const destination = getLoginDestination(location.state?.from)
  if (isAuthenticated)
    return <Navigate to={destination.to} state={destination.state} replace />

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await register(form)
      navigate(destination.to, { replace: true, state: destination.state })
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, '注册失败，请稍后重试'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthPageShell
      title="创建你的学习空间"
      description="从第一个知识点开始，积累自己的理解。"
      footer={
        <>
          已经有账号？{' '}
          <Link to="/login" state={location.state}>
            直接登录
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
          用户名
          <input
            type="text"
            value={form.username}
            onChange={(event) =>
              setForm({ ...form, username: event.target.value })
            }
            placeholder="例如：小明"
            autoComplete="username"
            required
          />
        </label>
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
            placeholder="至少输入 6 位字符"
            autoComplete="new-password"
            minLength="6"
            required
          />
        </label>
        <button
          className="button button-primary button-wide"
          disabled={submitting}
        >
          {submitting ? '正在创建…' : '创建账号'}
        </button>
      </form>
    </AuthPageShell>
  )
}
