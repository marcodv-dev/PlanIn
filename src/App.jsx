import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/layout/Layout'
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import Profile from './pages/profile/Profile'
import Dashboard from './pages/groups/Dashboard'
import CreateGroup from './pages/groups/CreateGroup'
import GroupDetail from './pages/groups/GroupDetail'
import JoinGroup from './pages/groups/JoinGroup'
import CreatePoll from './pages/polls/CreatePoll'

import CreateEvent from './pages/events/CreateEvent'
import EventDetail from './pages/events/EventDetail'
import { useAuth } from './store/AuthContext'
import { useData } from './store/DataContext'

function Splash({ leaving, onEnd }) {
  return (
    <div
      className={`splash-overlay ${leaving ? 'splash-leave' : ''}`}
      onAnimationEnd={(e) => { if (e.target === e.currentTarget) onEnd() }}
    >
      <div style={{
        padding: '30px',
        aspectRatio: 1,
        backgroundColor: '#fff',
        borderColor: '#6b728042',
        boxShadow: '0 0 20px 5px rgba(0,0,0,0.1)'
      }} className="rounded-lg2 border">
        <div className="logo-frame">
          <img src="/PlanIn.png" alt="PlanIn" draggable={false} />
        </div>
      </div>
    </div>
  )
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  return children
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user) return <Navigate to="/" replace />
  return children
}

export default function App() {
  const { loading: authLoading } = useAuth()
  const { loading: dataLoading } = useData()
  const [leaving, setLeaving] = useState(false)
  const [gone, setGone] = useState(false)
  const isLoading = authLoading || dataLoading

  useEffect(() => {
    if (!isLoading) {
      const id = requestAnimationFrame(() => setLeaving(true))
      return () => cancelAnimationFrame(id)
    }
  }, [isLoading])

  useEffect(() => {
    if (!leaving) return
    const t = setTimeout(() => setGone(true), 800)
    return () => clearTimeout(t)
  }, [leaving])

  return (
    <>
      {!gone && <Splash leaving={leaving} onEnd={() => setGone(true)} />}
      <div className={leaving ? 'content-fade-in' : ''}>
      <Routes>
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
        <Route path="/join/:code" element={<JoinGroup />} />
        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/groups/new" element={<CreateGroup />} />
          <Route path="/groups/:groupId" element={<GroupDetail />} />
          <Route path="/groups/:groupId/polls/new" element={<CreatePoll />} />

          <Route path="/groups/:groupId/events/new" element={<CreateEvent />} />
          <Route path="/groups/:groupId/events/:eventId" element={<EventDetail />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </div>
    </>
  )
}
