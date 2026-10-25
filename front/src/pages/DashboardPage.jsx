import { Link, useLocation, useSearchParams } from 'react-router-dom'
import Icon from '../components/Icon'
import StatusBadge from '../components/StatusBadge'
import AiMetrics from '../components/AiMetrics'
import PageState from '../components/PageState'
import useKnowledgePoints from '../hooks/useKnowledgePoints'
import { formatDate } from '../utils/knowledge'
import {
  normalizeOverviewFilters,
  overviewHref,
  readOverviewFilters,
} from '../utils/overviewFilters'
export default function DashboardPage() {
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const selected = readOverviewFilters(searchParams)
  const returnTo = overviewHref(selected)
  const setFilters = (filters) => {
    const params = new URLSearchParams(searchParams)
    params.delete('filter')
    normalizeOverviewFilters(filters).forEach((value) =>
      params.append('filter', value),
    )
    setSearchParams(params, { replace: true, state: location.state })
  }
  const toggleFilter = (filter) => {
    if (selected.includes(filter))
      setFilters(selected.filter((value) => value !== filter))
    else if (filter === 'all') setFilters(['all'])
    else setFilters([...selected.filter((value) => value !== 'all'), filter])
  }
  const { points, loading, error, reload } = useKnowledgePoints()
  const reviewPoints = points.filter((point) => point.reviewList)
  const stats = [
    { id: 'review', title: '待复习', value: reviewPoints.length, icon: 'book' },
    { id: 'all', title: '全部知识点', value: points.length, icon: 'book' },
    {
      title: '正在学习',
      id: 'in_progress',
      value: points.filter((p) => p.status === 'in_progress').length,
      icon: 'edit',
    },
    {
      title: '已经掌握',
      id: 'mastered',
      value: points.filter((p) => p.status === 'mastered').length,
      icon: 'check',
    },
  ]
  const statuses = selected.filter((value) =>
    ['in_progress', 'mastered'].includes(value),
  )
  const filtered = points
    .filter(
      (point) =>
        (!selected.includes('review') || point.reviewList) &&
        (!statuses.length || statuses.includes(point.status)),
    )
    .sort(
      (a, b) =>
        new Date(b.updatedAt || b.createdAt) -
        new Date(a.updatedAt || a.createdAt),
    )
  return (
    <section className="overview-page compact-page">
      <div className="page-header">
        <div>
          <h1>学习概览</h1>
        </div>
        <Link
          className="button button-primary"
          to="/knowledge/new"
          state={{ returnTo }}
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
              <button
                type="button"
                className="stat-card stat-filter"
                key={stat.id}
                aria-pressed={selected.includes(stat.id)}
                aria-controls="overview-notes"
                onClick={() => toggleFilter(stat.id)}
              >
                <span className="stat-label">
                  {stat.title}
                  <Icon name={stat.icon} />
                </span>
                <strong>
                  {stat.value}
                  <small>个</small>
                </strong>
                {selected.includes(stat.id) && (
                  <span className="stat-selection" aria-hidden="true">
                    <Icon name="check" size={12} />
                  </span>
                )}
              </button>
            ))}
          </div>
          <section
            className="surface overview-notes"
            id="overview-notes"
            aria-labelledby="overview-notes-heading"
          >
            <div className="section-heading">
              <div className="overview-result-title">
                <h2 id="overview-notes-heading">笔记列表</h2>
                <span className="muted-label" role="status" aria-live="polite">
                  {filtered.length} / {points.length} 个
                </span>
              </div>
              {selected.length > 0 && (
                <button
                  type="button"
                  className="button button-small"
                  onClick={() => setFilters([])}
                >
                  清除筛选
                </button>
              )}
            </div>
            {!points.length ? (
              <PageState
                title="还没有学习记录"
                message="创建一个知识点，开始积累你的知识库。"
              >
                <Link
                  className="button"
                  to="/knowledge/new"
                  state={{ returnTo }}
                >
                  创建知识点
                </Link>
              </PageState>
            ) : !filtered.length ? (
              <PageState
                title="没有符合条件的笔记"
                message="可以调整上方选择，或清除筛选查看全部笔记。"
              >
                <button
                  type="button"
                  className="button"
                  onClick={() => setFilters([])}
                >
                  清除筛选
                </button>
              </PageState>
            ) : (
              filtered.map((point) => (
                <Link
                  className="overview-note-row"
                  key={point._id}
                  to={`/knowledge/${point._id}`}
                  state={{ returnTo }}
                >
                  <Icon name="book" />
                  <span className="overview-note-title">{point.title}</span>
                  <span className="overview-note-meta">
                    <StatusBadge status={point.status} />
                    {point.reviewList && (
                      <span className="review-flag">待复习</span>
                    )}
                    <time dateTime={point.updatedAt || point.createdAt}>
                      {formatDate(point.updatedAt || point.createdAt)}
                    </time>
                  </span>
                </Link>
              ))
            )}
          </section>
        </>
      )}
      <AiMetrics />
    </section>
  )
}
