import { lazy, Suspense } from 'react'

// Markdown / LaTeX / Mermaid 渲染引擎体积较大，按需加载，避免拖慢首屏
const MarkdownContent = lazy(() => import('./MarkdownContent'))

export default function MarkdownRenderer({ content, className = '' }) {
  return (
    <Suspense fallback={<p className="empty-state-inline">正在渲染内容…</p>}>
      <MarkdownContent content={content} className={className} />
    </Suspense>
  )
}
