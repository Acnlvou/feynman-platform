import { Link, useLocation } from 'react-router-dom'
import Icon from '../components/Icon'
import StatusBadge from '../components/StatusBadge'
import AiMetrics from '../components/AiMetrics'
import PageState from '../components/PageState'
import useKnowledgePoints from '../hooks/useKnowledgePoints'
import { formatDate } from '../utils/knowledge'
export default function DashboardPage() {
  const location = useLocation()
  const { points, loading, error, reload } = useKnowledgePoints()
  const reviewPoints = points.filter((point) => point.reviewList)
  const stats = [
    { title: '待复习', value: reviewPoints.length, icon: 'book' },
    { title: '全部知识点', value: points.length, icon: 'book' },
    {
      title: '正在学习',
      value: points.filter((p) => p.status === 'in_progress').length,
      icon: 'edit',
    },
    {
      title: '已经掌握',
      value: points.filter((p) => p.status === 'mastered').length,
      icon: 'check',
    },
  ]
  const recent = [...points]
    .sort(
      (a, b) =>
        new Date(b.updatedAt || b.createdAt) -
        new Date(a.updatedAt || a.createdAt),
    )
    .slice(0, 5)
  return (
    <section className="overview-page compact-page">
      <div className="page-header">
        <div>
          <h1>学习概览</h1>
        </div>
        <Link
          className="button button-primary"
          to="/knowledge/new"
          state={{ returnTo: '/overview' }}
        >
          <Icon name="plus" />
          新建知识点
        </Link>
      </div>
      {location.state?.message && (
        <p className="form-success">{location.state.message}</p>
      )}
      {loading ? (
        <PageState loading />
      ) : error ? (
        <div className="surface">
          <PageState
            title="暂时无法加载学习概览"
            message={error}
            retry={reload}
          />
        </div>
      ) : (
        <>
          <div className="stats-grid overview-stats">
            {stats.map((stat) => (
              <div className="stat-card" key={stat.title}>
                <span className="stat-label">
                  {stat.title}
                  <Icon name={stat.icon} />
                </span>
                <strong>
                  {stat.value}
                  <small>个</small>
                </strong>
              </div>
            ))}
          </div>
          <div className="surface overview-review">
            <div className="section-heading">
              <h2>待复习知识点</h2>
              <span className="review-flag">{reviewPoints.length}个</span>
            </div>
            {reviewPoints.length ? (
              reviewPoints.map((point) => (
                <Link
                  className="recent-row"
                  key={point._id}
                  to={`/knowledge/${point._id}`}
                  state={{ returnTo: '/overview' }}
                >
                  <Icon name="book" />
                  <span>{point.title}</span>
                  <span className="review-flag">待复习</span>
                  <StatusBadge status={point.status} />
                </Link>
              ))
            ) : (
              <p className="empty-state-inline">当前没有待复习知识点。</p>
            )}
          </div>
          <div className="surface">
            <div className="section-heading">
              <h2>最近更新</h2>
              <Link className="text-link" to="/knowledge">
                查看全部 →
              </Link>
            </div>
            {!recent.length ? (
              <PageState
                title="还没有学习记录"
                message="创建一个知识点，开始积累你的知识库。"
              >
                <Link
                  className="button"
                  to="/knowledge/new"
                  state={{ returnTo: '/overview' }}
                >
                  创建知识点
                </Link>
              </PageState>
            ) : (
              recent.map((point) => (
                <Link
                  className="recent-row"
                  key={point._id}
                  to={`/knowledge/${point._id}`}
                  state={{ returnTo: '/overview' }}
                >
                  <Icon name="book" />
                  <span>
                    {point.title}
                    {point.reviewList && (
                      <small className="review-flag overview-inline-review">
                        待复习
                      </small>
                    )}
                  </span>
                  <StatusBadge status={point.status} />
                  <time>{formatDate(point.updatedAt || point.createdAt)}</time>
                </Link>
              ))
            )}
          </div>
        </>
      )}
      <AiMetrics />
    </section>
  )
}
