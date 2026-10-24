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

// ── Context ──────────────────────────────────────────────────────
const AuthContext = createContext(null)

/**
 * status:
 *   "loading" — initial check not yet done
 *   "ready"   — check done (user may be null)
 */
export function AuthProvider({ children }) {
  const [user,      setUser]      = useState(null)
  const [status,    setStatus]    = useState('loading')
  const [authError, setAuthError] = useState(null) // error code string | null

  // Prevent double-invocation in StrictMode
  const didInit = useRef(false)

  // ── Session restore ──────────────────────────────────────────
  const checkSession = useCallback(async () => {
    setAuthError(null)
    setStatus('loading')

    // Fire-and-forget health ping (wakes sleeping backend)
    health().catch(() => {})

    const token = getToken()
    if (!token) {
      setUser(null)
      setStatus('ready')
      return
    }

    try {
      const data = await getMe()      // → { user }
      setUser(data.user)
      setStatus('ready')
    } catch (err) {
      if (err.status === 401) {
        // Expired / invalid token — discard it
        clearToken()
        setUser(null)
        setStatus('ready')
      } else {
        // Network failure or server error — keep the token, surface the error
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

  // ── Unauthorized handler (token expiry mid-session) ──────────
  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearToken()
      setUser(null)
      // Navigation to /login is the route guard's responsibility
    })
  }, [])

  // ── Auth actions ─────────────────────────────────────────────
  /**
   * login(data) — calls POST /auth/login, stores token, sets user.
   * Returns the full API response ({ token, user }).
   * Does NOT navigate.
   */
  const login = useCallback(async (data) => {
    const res = await apiLogin(data)
    setToken(res.token)
    setUser(res.user)
    setAuthError(null)
    return res
  }, [])

  /**
   * register(data) — calls POST /auth/register, stores token, sets user.
   * Returns the full API response ({ token, user, joinCode? }).
   * Does NOT navigate.
   */
  const register = useCallback(async (data) => {
    const res = await apiRegister(data)
    setToken(res.token)
    setUser(res.user)
    setAuthError(null)
    return res
  }, [])

  /** logout() — clears the token and user. Does NOT navigate. */
  const logout = useCallback(() => {
    clearToken()
    setUser(null)
  }, [])

  /** retry() — repeats the initial session check. */
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
