export function summarize(content = '') {
  return content
    .replace(/```[\s\S]*?```/g, ' [图表 / 代码] ')
    .replace(/[#$>*_`~|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
export function formatDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? '日期未知'
    : date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
}
