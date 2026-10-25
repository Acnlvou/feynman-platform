import Icon from './Icon'
export default function PageState({
  loading,
  fullPage = false,
  title,
  message,
  retry,
  children,
}) {
  return (
    <div
      className={`page-state${fullPage ? ' page-state--page' : ''}`}
      role={loading ? 'status' : undefined}
    >
      {loading ? (
        <span className="loader" />
      ) : (
        <span className="state-icon">
          <Icon name="book" size={25} />
        </span>
      )}
      <h2>{loading ? '正在加载…' : title}</h2>
      {message && <p>{message}</p>}
      {retry && (
        <button className="button" onClick={retry}>
          重新加载
        </button>
      )}
      {children}
    </div>
  )
}
