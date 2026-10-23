import { Link } from 'react-router-dom'
import Icon from './Icon'
export default function AuthPageShell({
  title,
  description,
  children,
  footer,
}) {
  return (
    <main className="auth-page">
      <Link className="brand auth-brand" to="/knowledge">
        <span className="brand-mark">
          <Icon name="book" />
        </span>
        <strong>费曼学习空间</strong>
      </Link>
      <section className="auth-card">
        <h1>{title}</h1>
        <p className="auth-description">{description}</p>
        {children}
        <p className="auth-footer">{footer}</p>
      </section>
      <p className="auth-caption">记录知识，练习理解。</p>
    </main>
  )
}
