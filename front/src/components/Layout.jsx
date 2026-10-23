import { useEffect, useRef, useState } from 'react'
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Icon from './Icon'
export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isEditor = /^\/knowledge\/(new|[^/]+\/edit)\/?$/.test(location.pathname)
  const isRecord = /^\/knowledge\/[^/]+\/record\/?$/.test(location.pathname)
  const isDetail =
    /^\/knowledge\/[^/]+\/?$/.test(location.pathname) && !isEditor
  const isCompact =
    isEditor ||
    isDetail ||
    isRecord ||
    ['/knowledge', '/overview'].includes(location.pathname)
  const [open, setOpen] = useState(false)
  const menu = useRef(null)
  const trigger = useRef(null)
  useEffect(() => {
    setOpen(false)
  }, [location.pathname])
  useEffect(() => {
    if (!open) return
    const outside = (event) => {
      if (!menu.current?.contains(event.target)) setOpen(false)
    }
    const escape = (event) => {
      if (event.key === 'Escape') {
        setOpen(false)
        trigger.current?.focus()
      }
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [open])
  return (
    <div
      className={`app-shell${isEditor ? ' app-shell--editor' : ''}${isCompact ? ' app-shell--compact' : ''}${isDetail ? ' app-shell--reader' : ''}${isRecord ? ' app-shell--record' : ''}`}
    >
      <a className="skip-link" href="#main">
        跳到正文
      </a>
      <header className="topbar">
        <div className="topbar-inner">
          <Link className="brand" to="/knowledge">
            <span className="brand-mark">
              <Icon name="book" />
            </span>
            <strong>
              费曼<span className="brand-subtitle">学习空间</span>
            </strong>
          </Link>
          <nav className="top-nav" aria-label="主导航">
            <NavLink to="/knowledge">
              <Icon name="book" size={18} />
              知识库
            </NavLink>
            <NavLink to="/overview">
              <Icon name="chart" size={18} />
              学习概览
            </NavLink>
          </nav>
          <div className="account" ref={menu}>
            <button
              ref={trigger}
              className="account-trigger"
              aria-label="账号菜单"
              aria-expanded={open}
              aria-controls="account-panel"
              onClick={() => setOpen(!open)}
            >
              <span className="avatar">
                {(user?.username || '我').slice(0, 1)}
              </span>
              <span className="account-name">{user?.username || '学习者'}</span>
              <Icon name="down" size={16} />
            </button>
            {open && (
              <div id="account-panel" className="account-menu">
                <p>
                  当前账号<strong>{user?.username || '学习者'}</strong>
                </p>
                <button
                  onClick={() => {
                    if (
                      location.pathname.endsWith('/edit') ||
                      location.pathname === '/knowledge/new'
                    ) {
                      if (
                        !window.confirm('退出将离开当前编辑页面，确定退出吗？')
                      )
                        return
                    }
                    if (isRecord) {
                      navigate('/logout')
                      return
                    }
                    logout()
                    navigate('/login')
                  }}
                >
                  <Icon name="logout" size={18} />
                  退出登录
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      <main id="main" className="main-content">
        <Outlet />
      </main>
      <footer className="site-footer">
        费曼学习空间 <span>记录，让理解更清晰。</span>
      </footer>
    </div>
  )
}
