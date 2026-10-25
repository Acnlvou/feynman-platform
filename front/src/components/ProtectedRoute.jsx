import { useEffect } from 'react'
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Modal from './Modal'

export default function ProtectedRoute() {
  const {
    isAuthenticated,
    sessionExpired,
    retained,
    discarding,
    dismissExpiryPrompt,
    discardExpiredDraft,
  } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const keepDraft = sessionExpired && retained?.location.key === location.key
  const loginState = {
    from: location,
    reason: sessionExpired ? 'expired' : undefined,
  }

  // 先让离开拦截器读取“已确认放弃”，再发起导航。
  useEffect(() => {
    if (keepDraft && discarding) {
      navigate('/login', {
        replace: true,
        state: { from: retained.location, reason: 'expired' },
      })
    }
  }, [keepDraft, discarding, retained, navigate])

  if (!isAuthenticated && !keepDraft) {
    return <Navigate to="/login" replace state={loginState} />
  }

  return (
    <>
      <Outlet />
      {keepDraft && retained.prompt && !discarding && (
        <Modal title="登录已过期" onClose={dismissExpiryPrompt}>
          <div className="session-expired-body">
            <p>当前文字和本地录音还在本页。重新登录将离开此页，未保存内容会丢失，可先保留并复制文字。</p>
          </div>
          <div className="modal-footer">
            <button className="button" onClick={dismissExpiryPrompt}>
              保留当前内容
            </button>
            <button className="button button-primary" onClick={discardExpiredDraft}>
              放弃并重新登录
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
