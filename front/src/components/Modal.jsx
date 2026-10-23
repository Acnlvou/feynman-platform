import { useEffect, useRef } from 'react'
export default function Modal({
  title,
  onClose,
  busy = false,
  children,
  wide = false,
}) {
  const ref = useRef(null)
  useEffect(() => {
    const previous = document.activeElement
    ref.current.showModal()
    return () => {
      ref.current?.close()
      previous?.focus?.()
    }
  }, [])
  return (
    <dialog
      ref={ref}
      className={`app-modal${wide ? ' modal-wide' : ''}`}
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onClose()
      }}
      aria-label={title}
    >
      <div className="modal-header">
        <h2>{title}</h2>
        <button
          className="icon-button"
          onClick={onClose}
          disabled={busy}
          aria-label="关闭窗口"
        >
          ×
        </button>
      </div>
      {children}
    </dialog>
  )
}
