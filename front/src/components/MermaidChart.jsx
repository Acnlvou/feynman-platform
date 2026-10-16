import { useEffect, useRef, useState } from 'react'

// mermaid 体积较大，首次遇到图表时才按需加载，避免拖慢首屏
let mermaidPromise = null
let chartSequence = 0

function loadMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid')
      .then((module) => {
        const mermaid = module.default
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: 'neutral',
          fontFamily: 'inherit',
        })
        return mermaid
      })
      .catch((error) => {
        mermaidPromise = null
        throw error
      })
  }
  return mermaidPromise
}

export default function MermaidChart({ code }) {
  const chartId = useRef(null)
  if (!chartId.current) {
    chartSequence += 1
    chartId.current = `mermaid-chart-${chartSequence}`
  }

  const [svg, setSvg] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setSvg('')
    setError('')

    loadMermaid()
      .then((mermaid) => mermaid.render(`${chartId.current}-${Date.now()}`, code))
      .then((result) => {
        if (!cancelled) setSvg(result.svg)
      })
      .catch((renderError) => {
        if (!cancelled) setError(renderError?.message || '未知错误')
      })

    return () => {
      cancelled = true
    }
  }, [code])

  if (error) {
    return (
      <div className="mermaid-block mermaid-error" role="alert">
        <p className="mermaid-error-title">图表渲染失败：{error}</p>
        <pre>
          <code>{code}</code>
        </pre>
      </div>
    )
  }

  if (!svg) {
    return <div className="mermaid-block mermaid-loading">正在渲染图表…</div>
  }

  // svg 由 mermaid 本地渲染生成，securityLevel 为 strict，脚本与外部资源已被过滤
  return <div className="mermaid-block" dangerouslySetInnerHTML={{ __html: svg }} />
}
