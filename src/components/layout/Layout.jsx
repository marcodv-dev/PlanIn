import { useEffect, useRef } from 'react'
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Users, Calendar, Plus, User, Group } from 'lucide-react'
import { useAuth } from '../../store/AuthContext'
import { applyAccent } from '../../lib/accent'

export default function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const prevPathRef = useRef(location.pathname)

  const accentKey = profile?.accent_color || localStorage.getItem('hc_accent')
  applyAccent(accentKey)

  useEffect(() => {
    if (profile?.accent_color) localStorage.setItem('hc_accent', profile?.accent_color)
  }, [profile?.accent_color])

  useEffect(() => {
    if (location.pathname !== prevPathRef.current) {
      if (location.pathname === '/profile') {
        sessionStorage.setItem('hc_last_group_page', prevPathRef.current)
      }
      prevPathRef.current = location.pathname
    }
  }, [location.pathname])

  function handleGroupsClick(e) {
    const last = sessionStorage.getItem('hc_last_group_page')
    if (location.pathname === '/profile' && last && last !== '/profile') {
      e.preventDefault()
      navigate(last)
    }
  }

  return (
    <div className="h-dvh d-flex flex-col" style={{overflow:'hidden'}}>
      <main className="d-flex-1 d-flex flex-col overflow-hidden">
        <Outlet />
      </main>
      <nav className="shrink-0 d-flex justify-around items-center py-4 px-4" style={{border:'none',borderTop:'1px solid'}}>
        <NavLink to="/" end onClick={handleGroupsClick} className={() => `d-flex d-flex-col items-center gap-1 text-xs ${location.pathname !== '/profile' ? 'text-accent' : 'text-gray-500'}`}>
          <Group size={40} />
        </NavLink>
        <NavLink to="/profile" className={({ isActive }) => `d-flex d-flex-col items-center gap-1 text-xs ${isActive ? 'text-accent' : 'text-gray-500'}`}>
          <User size={40} />
        </NavLink>
      </nav>
    </div>
  )
}
