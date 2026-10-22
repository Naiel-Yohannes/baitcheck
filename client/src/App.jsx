import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Admin from './pages/Admin'
import Chat from './pages/Chat'
import History from './pages/History'
import Login from './pages/Login'
import Register from './pages/Register'
import Report from './pages/Report'
import Scenarios from './pages/Scenarios'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/scenarios" replace />} />
          <Route path="/login"                element={<Login />} />
          <Route path="/register"             element={<Register />} />
          <Route path="/scenarios"            element={<Scenarios />} />
          <Route path="/chat/:sessionId"      element={<Chat />} />
          <Route path="/report/:sessionId"    element={<Report />} />
          <Route path="/history"              element={<History />} />
          <Route path="/admin"                element={<Admin />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
