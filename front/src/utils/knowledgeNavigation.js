// 只接受站内的两个列表入口；直接打开详情时默认返回知识库。
export function getKnowledgeReturn(state) {
  const returnTo = state?.returnTo === '/overview' ? '/overview' : '/knowledge'
  return {
    returnTo,
    returnLabel: returnTo === '/overview' ? '返回学习概览' : '返回知识库',
  }
}
