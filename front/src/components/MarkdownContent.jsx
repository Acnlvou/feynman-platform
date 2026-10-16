import { Component, isValidElement } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import MermaidChart from './MermaidChart'

// 富文本来自用户输入，渲染异常不应让整页白屏
class MarkdownErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error) {
    console.error('Markdown 渲染失败：', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <p className="form-alert" role="alert">
          这段内容的格式无法解析，请检查 Markdown、LaTeX 或 Mermaid 语法后重新保存。
        </p>
      )
    }
    return this.props.children
  }
}

function isMermaidElement(element) {
  return (
    isValidElement(element) &&
    typeof element.props?.className === 'string' &&
    element.props.className.includes('language-mermaid')
  )
}

function MarkdownCode({ className, children, ...props }) {
  if (typeof className === 'string' && className.includes('language-mermaid')) {
    return <MermaidChart code={String(children).replace(/\n$/, '')} />
  }

  return (
    <code className={className} {...props}>
      {children}
    </code>
  )
}

function MarkdownPre({ children, ...props }) {
  // mermaid 代码块会渲染成独立图表，不需要代码块的等宽字体与背景
  if (isMermaidElement(children)) {
    return <>{children}</>
  }

  return <pre {...props}>{children}</pre>
}

function MarkdownLink({ href, children, ...props }) {
  const isExternal = typeof href === 'string' && /^https?:\/\//.test(href)

  return (
    <a href={href} target={isExternal ? '_blank' : undefined} rel={isExternal ? 'noreferrer' : undefined} {...props}>
      {children}
    </a>
  )
}

export default function MarkdownContent({ content, className = '' }) {
  return (
    <MarkdownErrorBoundary>
      <div className={`markdown-body ${className}`.trim()}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[[rehypeKatex, { throwOnError: false, errorColor: '#ad4d36' }]]}
          components={{ code: MarkdownCode, pre: MarkdownPre, a: MarkdownLink }}
        >
          {content || ''}
        </ReactMarkdown>
      </div>
    </MarkdownErrorBoundary>
  )
}
