export const transferFormat = 'feynman-knowledge'
const fields = ['title', 'content', 'status', 'reviewList', 'category', 'tags']
export function portablePoint(point) {
  return {
    title: point.title,
    content: point.content,
    status: point.status || 'not_started',
    reviewList: point.reviewList || false,
    category: point.category || '',
    tags: point.tags || [],
  }
}
function validate(point) {
  if (!point || typeof point !== 'object' || Array.isArray(point))
    throw Error('知识点格式不正确')
  for (const [key, limit] of [
    ['title', 120],
    ['content', 20000],
    ['category', 40],
  ]) {
    const value = point[key] ?? (key === 'category' ? '' : undefined)
    if (
      typeof value !== 'string' ||
      value.length > limit ||
      (key !== 'category' && !value.trim())
    )
      throw Error(
        `标题、正文或分类不符合长度要求（标题120、正文20000、分类40字符）`,
      )
  }
  if (
    point.status !== undefined &&
    !['not_started', 'in_progress', 'mastered'].includes(point.status)
  )
    throw Error('知识点状态不正确')
  if (point.reviewList !== undefined && typeof point.reviewList !== 'boolean')
    throw Error('复习标记格式不正确')
  if (
    point.tags !== undefined &&
    (!Array.isArray(point.tags) ||
      point.tags.length > 10 ||
      point.tags.some(
        (tag) => typeof tag !== 'string' || !tag.trim() || tag.length > 20,
      ))
  )
    throw Error('标签最多10个，每个1–20字符')
  return portablePoint(
    Object.fromEntries(fields.map((key) => [key, point[key]])),
  )
}
export function parseImport(text, filename) {
  text = text.replace(/^\uFEFF/, '')
  if (/\.json$/i.test(filename)) {
    let data
    try {
      data = JSON.parse(text)
    } catch {
      throw Error('JSON 文件无法解析，请选择平台导出的备份')
    }
    if (
      !data ||
      typeof data !== 'object' ||
      data.format !== transferFormat ||
      data.version !== 1 ||
      !Array.isArray(data.knowledgePoints) ||
      !data.knowledgePoints.length ||
      data.knowledgePoints.length > 1000
    )
      throw Error('备份格式不正确，一次最多预览1000条')
    return data.knowledgePoints.map(validate)
  }
  if (!/\.(md|markdown)$/i.test(filename))
    throw Error('请选择 .md 或 .json 文件')
  const heading = /^\s*#\s+(.+)(?:\r?\n|$)/.exec(text)
  return [
    validate({
      title: heading ? heading[1].trim() : filename.replace(/\.[^.]+$/, ''),
      content: heading
        ? text.slice(heading[0].length).replace(/^\s*\n/, '')
        : text,
    }),
  ]
}
export function backup(points) {
  return {
    format: transferFormat,
    version: 1,
    exportedAt: new Date().toISOString(),
    knowledgePoints: points.map(portablePoint),
  }
}
export function importBatches(points) {
  const batches = []
  let current = [],
    bytes = 0
  for (const point of points) {
    const size = new TextEncoder().encode(JSON.stringify(point)).length
    if (current.length && (current.length === 30 || bytes + size > 800000)) {
      batches.push(current)
      current = []
      bytes = 0
    }
    current.push(point)
    bytes += size
  }
  if (current.length) batches.push(current)
  return batches
}
export function downloadFile(filename, content, type = 'application/json') {
  const url = URL.createObjectURL(
    new Blob([content], { type: `${type};charset=utf-8` }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export function exportMarkdown(point) {
  downloadFile(
    `${point.title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 80) || '知识点'}.md`,
    `# ${point.title}\n\n${point.content}`,
    'text/markdown',
  )
}
