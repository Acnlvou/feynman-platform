import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="brand" to="/">
          <span className="brand-mark">F</span>
          <span>
            <strong>费曼学习平台</strong>
            <small>把知识讲成自己的</small>
          </span>
        </Link>
        <div className="topbar-actions">
          <span className="user-chip">你好，{user?.username || '学习者'}</span>
          <button className="button button-ghost button-small" onClick={handleLogout}>
            退出登录
          </button>
        </div>
      </header>

      <div className="workspace">
        <aside className="sidebar">
          <p className="sidebar-label">学习空间</p>
          <nav className="side-nav">
            <NavLink end to="/" className={({ isActive }) => (isActive ? 'active' : '')}>
              <span>⌂</span> 学习概览
            </NavLink>
            <NavLink to="/knowledge" className={({ isActive }) => (isActive ? 'active' : '')}>
              <span>◇</span> 我的知识点
            </NavLink>
          </nav>
          <div className="sidebar-note">
            <span className="eyebrow">FEYNMAN METHOD</span>
            <p>先讲出来，再发现自己真正懂了什么。</p>
          </div>
        </aside>
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
