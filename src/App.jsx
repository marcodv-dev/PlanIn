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

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen text-xl">Caricamento...</div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen text-xl">Caricamento...</div>
  if (user) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
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
  )
}
