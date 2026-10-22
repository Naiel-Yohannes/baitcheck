import { NavLink, Outlet } from 'react-router-dom'

const navLinks = [
  { to: '/scenarios', label: 'Scenarios' },
  { to: '/history',   label: 'History'   },
  { to: '/admin',     label: 'Admin'     },
  { to: '/login',     label: 'Login'     },
]

export default function Layout() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <nav className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex gap-6 items-center">
        <span className="text-indigo-400 font-bold text-lg tracking-tight mr-auto">
          BaitCheck
        </span>
        {navLinks.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `text-sm font-medium transition-colors ${
                isActive
                  ? 'text-indigo-400'
                  : 'text-gray-400 hover:text-white'
              }`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  )
}
