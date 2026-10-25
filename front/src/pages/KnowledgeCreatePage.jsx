import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import apiClient, { getApiErrorMessage } from '../api/client'
import KnowledgePointForm from '../components/KnowledgePointForm'
import Icon from '../components/Icon'
import { getKnowledgeReturn } from '../utils/knowledgeNavigation'
export default function KnowledgeCreatePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { returnTo, returnLabel } = getKnowledgeReturn(location.state)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const create = async (values) => {
    setSubmitting(true)
    setError('')
    try {
      const response = await apiClient.post('/knowledge-points', values)
      navigate(`/knowledge/${response.data.data._id}`, {
        replace: true,
        state: { returnTo, message: '知识点已保存' },
      })
    } catch (error) {
      setError(getApiErrorMessage(error, '保存失败，请稍后重试'))
      setSubmitting(false)
    }
  }
  return (
    <section className="editor-page">
      <div className="page-header">
        <div>
          <Link className="back-link" to={returnTo}>
            <Icon name="arrow" size={18} />
            {returnLabel}
          </Link>
          <h1>新建知识点</h1>
        </div>
      </div>
      <div className="edit-panel">
        <KnowledgePointForm
          submitting={submitting}
          error={error}
          onSubmit={create}
          onCancel={() => navigate(returnTo)}
        />
      </div>
    </section>
  )
}
