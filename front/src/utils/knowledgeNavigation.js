import { normalizeOverviewReturn } from './overviewFilters'

// 只接受站内的两个列表入口；直接打开详情时默认返回知识库。
export function getKnowledgeReturn(state) {
  const overview = normalizeOverviewReturn(state?.returnTo)
  return {
    returnTo: overview || '/knowledge',
    returnLabel: overview ? '返回学习概览' : '返回知识库',
  }
}
