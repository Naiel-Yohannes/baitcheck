import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import RequireAuth from './components/RequireAuth'
import RequireRole from './components/RequireRole'
import { useAuth } from './context/AuthContext'
import { useLang } from './context/LanguageContext'
import Admin from './pages/Admin'
import Chat from './pages/Chat'
import History from './pages/History'
import Login from './pages/Login'
import Register from './pages/Register'
import Report from './pages/Report'
import Scenarios from './pages/Scenarios'

function HomeRedirect() {
  const { user, status } = useAuth()
  const { t } = useLang()

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-400 text-sm animate-pulse">{t('statusLoading')}</p>
      </div>
    )
  }

  const destination = user
    ? user.role === 'orgAdmin' ? '/admin' : '/scenarios'
    : '/login'
  return <Navigate to={destination} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/login"    element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route element={<RequireAuth />}>
            <Route path="/scenarios"         element={<Scenarios />} />
            <Route path="/chat/:sessionId"   element={<Chat />} />
            <Route path="/report/:sessionId" element={<Report />} />
            <Route path="/history"           element={<History />} />

            <Route element={<RequireRole roles={['orgAdmin']} />}>
              <Route path="/admin" element={<Admin />} />
            </Route>
          </Route>

          <Route path="*" element={<HomeRedirect />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
