import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../store/AuthContext'
import { useData } from '../../store/DataContext'
import Button from '../../components/ui/Button'

export default function JoinGroup() {
  const { code } = useParams()
  const { user } = useAuth()
  const { joinGroup } = useData()
  const navigate = useNavigate()
  const [group, setGroup] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: invite } = await supabase
        .from('group_invites')
        .select('*, groups(*)')
        .eq('code', code)
        .single()

      if (!invite || (invite.expires_at && new Date(invite.expires_at) < new Date())) {
        setError('Link invito non valido o scaduto')
        setLoading(false)
        return
      }
      setGroup(invite.groups)
      setLoading(false)
    }
    load()
  }, [code])

  async function handleJoin() {
    if (!user) { navigate('/login'); return }
    setJoining(true)
    setError('')
    try {
      const { error: err } = await supabase.from('group_members').insert({
        group_id: group.id, user_id: user.id, role: 'member'
      })
      if (err) throw err
      await joinGroup(group.id)
      navigate(`/groups/${group.id}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setJoining(false)
    }
  }

  if (loading) return <div className="d-flex items-center justify-center h-screen text-gray-500">Caricamento...</div>

  return (
    <div className="min-h-screen d-flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        {error ? (
          <>
            <h1 className="text-2xl font-bold text-red-500 mb-4">Link non valido</h1>
            <p className="text-gray-400 mb-6">{error}</p>
            <Button text="Torna alla Home" variant="primary" size="lg" wide onClick={() => navigate('/')} />
          </>
        ) : group ? (
          <>
            <h1 className="text-2xl font-bold text-accent mb-2">Sei stato invitato!</h1>
            <p className="text-xl mb-8">Unisciti a <strong>{group.name}</strong></p>
            <Button text={joining ? 'Accesso...' : (user ? 'Unisciti al Gruppo' : 'Accedi per unirti')}
              variant="primary" size="xl" wide onClick={handleJoin} />
          </>
        ) : null}
      </div>
    </div>
  )
}
