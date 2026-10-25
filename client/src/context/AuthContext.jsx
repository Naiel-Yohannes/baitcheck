import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  clearToken,
  getMe,
  getToken,
  health,
  login as apiLogin,
  register as apiRegister,
  setToken,
  setUnauthorizedHandler,
} from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,      setUser]      = useState(null)
  const [status,    setStatus]    = useState('loading')
  const [authError, setAuthError] = useState(null)

  const didInit = useRef(false)

  const checkSession = useCallback(async () => {
    setAuthError(null)
    setStatus('loading')

    health().catch(() => {})

    const token = getToken()
    if (!token) {
      setUser(null)
      setStatus('ready')
      return
    }

    try {
      const data = await getMe()
      setUser(data.user)
      setStatus('ready')
    } catch (err) {
      if (err.status === 401) {
        clearToken()
        setUser(null)
        setStatus('ready')
      } else {
        setAuthError(err.code ?? 'NETWORK_ERROR')
        setUser(null)
        setStatus('ready')
      }
    }
  }, [])

  useEffect(() => {
    if (didInit.current) return
    didInit.current = true
    checkSession()
  }, [checkSession])

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearToken()
      setUser(null)
    })
  }, [])

  const login = useCallback(async (data) => {
    const res = await apiLogin(data)
    setToken(res.token)
    setUser(res.user)
    setAuthError(null)
    return res
  }, [])

  const register = useCallback(async (data) => {
    const res = await apiRegister(data)
    setToken(res.token)
    setUser(res.user)
    setAuthError(null)
    return res
  }, [])

  const logout = useCallback(() => {
    clearToken()
    setUser(null)
  }, [])

  const retry = useCallback(() => {
    checkSession()
  }, [checkSession])

  return (
    <AuthContext.Provider value={{ user, status, authError, login, register, logout, retry }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
