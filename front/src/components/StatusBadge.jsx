const labels = {
  not_started: '未开始',
  in_progress: '学习中',
  mastered: '已掌握',
}

export default function StatusBadge({ status }) {
  return <span className={`status-badge status-${status}`}>{labels[status] || '未开始'}</span>
}
