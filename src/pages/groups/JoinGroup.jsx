import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../store/AuthContext'
import { useData } from '../../store/DataContext'
import Button from '../../components/ui/Button'

export default function JoinGroup() {
  const { code } = useParams()
  const { user } = useAuth()
  const { joinGroup, groups } = useData()
  const navigate = useNavigate()
  const [group, setGroup] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [alreadyMember, setAlreadyMember] = useState(false)

  const isMember = !!user && !!group && groups.some(g => g.id === group.group_id)
  const showMemberMessage = alreadyMember || isMember

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.rpc('get_invite_by_code', { invite_code: code })
      const invite = data?.[0]

      if (error || !invite || (invite.expires_at && new Date(invite.expires_at) < new Date())) {
        setError('Link invito non valido o scaduto')
        setLoading(false)
        return
      }
      setGroup(invite)
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
        group_id: group.group_id, user_id: user.id, role: 'member'
      })
      if (err) throw err
      await joinGroup(group.group_id)
      navigate(`/groups/${group.group_id}`)
    } catch (err) {
      if (err?.code === '23505' || /duplicate key/i.test(err?.message || '')) {
        setAlreadyMember(true)
      } else {
        setError(err.message)
      }
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
            <h1 className="text-2xl font-bold text-red-500 mb-4 mt-4">Link non valido</h1>
            <p className="text-gray-400 mb-6">{error}</p>
            <Button text="Torna alla Home" variant="primary2" size="lg" wide onClick={() => navigate('/')} />
          </>
        ) : group && showMemberMessage ? (
          <>
            <h1 className="text-2xl font-bold text-black mb-2 mt-4">Fai già parte di questo gruppo</h1>
            <p className="text-xl mb-8">Fai parte di <strong>{group.name}</strong></p>
            <Button text="Vai al Gruppo" variant="primary2" size="xl" wide onClick={() => navigate(`/groups/${group.group_id}`)} />
          </>
        ) : group ? (
          <>
            <h1 className="text-2xl font-bold text-black mb-2 mt-4">Sei stato invitato!</h1>
            <p className="text-xl mb-8">Unisciti a <strong>{group.name}</strong></p>
            <Button text={joining ? 'Accesso...' : (user ? 'Unisciti al Gruppo' : 'Accedi per unirti')}
              variant="primary2" size="xl" wide onClick={handleJoin} />
          </>
        ) : null}
      </div>
    </div>
  )
}
