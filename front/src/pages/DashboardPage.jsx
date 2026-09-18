import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function DashboardPage() {
  const { user } = useAuth()

  return (
    <section className="dashboard-page">
      <div className="hero-card">
        <div>
          <span className="eyebrow">YOUR LEARNING SPACE</span>
          <h1>你好，{user?.username || '学习者'}。</h1>
          <p>今天也用自己的话，讲清楚一个知识点吧。</p>
          <Link className="button button-light" to="/knowledge">
            进入知识库 <span>↗</span>
          </Link>
        </div>
        <div className="hero-orbit" aria-hidden="true">
          <span className="orbit-dot dot-one" />
          <span className="orbit-dot dot-two" />
          <span className="orbit-dot dot-three" />
          <div className="orbit-core">F</div>
        </div>
      </div>

      <div className="section-heading">
        <div>
          <span className="eyebrow">A SIMPLE LOOP</span>
          <h2>从记住，到真正理解</h2>
        </div>
        <span className="muted-label">费曼学习法</span>
      </div>
      <div className="method-grid">
        <MethodCard number="01" title="记录" text="把新知识放进自己的知识库。" icon="＋" />
        <MethodCard number="02" title="复述" text="不用术语，尝试讲给另一个人听。" icon="↗" />
        <MethodCard number="03" title="发现" text="标记含糊的地方，回到知识源头。" icon="◌" />
      </div>
    </section>
  )
}

function MethodCard({ number, title, text, icon }) {
  return (
    <article className="method-card">
      <div className="method-card-top"><span>{number}</span><span className="method-icon">{icon}</span></div>
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  )
}
