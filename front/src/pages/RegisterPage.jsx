import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { getApiErrorMessage } from '../api/client'
import { useAuth } from '../context/AuthContext'

export default function RegisterPage() {
  const { isAuthenticated, register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (isAuthenticated) return <Navigate to="/" replace />

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await register(form)
      navigate('/', { replace: true })
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, '注册失败，请稍后重试'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page auth-page-register">
      <div className="auth-aside">
        <Link className="brand brand-light" to="/register">
          <span className="brand-mark">F</span>
          <span>
            <strong>费曼学习平台</strong>
            <small>Feynman Learning Platform</small>
          </span>
        </Link>
        <div className="register-tips">
          <span className="eyebrow">START SMALL, LEARN DEEP</span>
          <h2>每一次复述，都是一次理解的加深。</h2>
          <div className="step-list">
            <span><b>01</b> 记录你的知识点</span>
            <span><b>02</b> 用自己的话讲出来</span>
            <span><b>03</b> 找到真正的薄弱点</span>
          </div>
        </div>
      </div>
      <div className="auth-panel">
        <div className="auth-card">
          <span className="eyebrow">CREATE ACCOUNT</span>
          <h1>建立你的知识空间</h1>
          <p className="auth-description">注册后，就可以开始整理、复述和回顾你的知识点。</p>
          <form className="auth-form" onSubmit={handleSubmit}>
            {error && <p className="form-alert">{error}</p>}
            <label>
              用户名
              <input
                type="text"
                value={form.username}
                onChange={(event) => setForm({ ...form, username: event.target.value })}
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
                placeholder="至少输入 6 位字符"
                autoComplete="new-password"
                minLength="6"
                required
              />
            </label>
            <button className="button button-primary button-wide" disabled={submitting}>
              {submitting ? '正在创建…' : '创建账号'}
            </button>
          </form>
          <p className="auth-footer">
            已经有账号？ <Link to="/login">直接登录</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
