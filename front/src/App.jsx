import { useEffect } from 'react'
import { useAuth, AuthProvider } from './context/AuthContext'
import {
  Navigate,
  Outlet,
  useNavigate,
  Route,
  RouterProvider,
  createBrowserRouter,
  createRoutesFromElements,
} from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import DashboardPage from './pages/DashboardPage'
import KnowledgeDetailPage from './pages/KnowledgeDetailPage'
import KnowledgeEditPage from './pages/KnowledgeEditPage'
import KnowledgePage from './pages/KnowledgePage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import KnowledgeCreatePage from './pages/KnowledgeCreatePage'
import FeynmanRecordPage from './pages/FeynmanRecordPage'

// 离开录音页经 useBlocker 确认后才会到达这里，避免取消离开却先丢失登录态。
function LogoutPage() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  useEffect(() => {
    logout()
    navigate('/login', { replace: true })
  }, [])
  return null
}

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route
      element={
        <AuthProvider>
          <Outlet />
        </AuthProvider>
      }
    >
      <Route path="/login" element={<LoginPage />} />
      <Route path="/logout" element={<LogoutPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/knowledge" replace />} />
          <Route path="/overview" element={<DashboardPage />} />
          <Route path="/knowledge/new" element={<KnowledgeCreatePage />} />
          <Route path="/knowledge" element={<KnowledgePage />} />
          <Route path="/knowledge/:id" element={<KnowledgeDetailPage />} />
          <Route path="/knowledge/:id/edit" element={<KnowledgeEditPage />} />
          <Route path="/knowledge/:id/record" element={<FeynmanRecordPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Route>,
  ),
)
export default function App() {
  return <RouterProvider router={router} />
}
