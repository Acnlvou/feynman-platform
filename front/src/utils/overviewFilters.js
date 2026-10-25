export const OVERVIEW_FILTERS = ['review', 'in_progress', 'mastered']

export function normalizeOverviewFilters(values) {
  if (values.includes('all')) return ['all']
  return OVERVIEW_FILTERS.filter((value) => values.includes(value))
}

export function readOverviewFilters(search) {
  return normalizeOverviewFilters(new URLSearchParams(search).getAll('filter'))
}

export function overviewHref(filters) {
  const params = new URLSearchParams()
  normalizeOverviewFilters(filters).forEach((value) =>
    params.append('filter', value),
  )
  const search = params.toString()
  return `/overview${search ? `?${search}` : ''}`
}

// 返回来源只接受概览路径和已知筛选条件，不接受外部地址或任意查询参数。
export function normalizeOverviewReturn(value) {
  if (typeof value !== 'string' || !/^\/overview\/?(?:\?[^#]*)?$/.test(value))
    return null
  const query = value.indexOf('?')
  return overviewHref(
    readOverviewFilters(query < 0 ? '' : value.slice(query + 1)),
  )
}
