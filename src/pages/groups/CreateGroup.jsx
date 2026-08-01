import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../store/AuthContext'
import { useData } from '../../store/DataContext'
import { generateInviteCode } from '../../lib/utils'
import { useToast } from '../../store/ToastContext'
import Button from '../../components/ui/Button'
import { ArrowLeft, ChevronLeft } from 'lucide-react'

export default function CreateGroup() {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const { user } = useAuth()
  const { refreshGroup, upsertGroup } = useData()
  const { showToast } = useToast()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const { data: group, error: groupErr } = await supabase
        .from('groups')
        .insert({ name, created_by: user.id })
        .select()
        .single()
      if (groupErr) throw groupErr

      await supabase.from('group_members').insert({
        group_id: group.id, user_id: user.id, role: 'admin'
      })

      await supabase.from('group_invites').insert({
        group_id: group.id, code: generateInviteCode(), created_by: user.id
      })

      upsertGroup(group)
      await refreshGroup(group.id)
      navigate(`/groups/${group.id}`)
    } catch (err) {
      showToast(err?.message || String(err), 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4">
      <div className="d-flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="text-black">
          <ChevronLeft size={30} />
        </button>
        <h1 className="text-xl font-bold text-accent">Nuovo Gruppo</h1>
      </div>
      <form onSubmit={handleSubmit} className="max-w-lg space-y-4 max-w-sm mx-auto">
        <div style={{marginBottom:40}}>
          <label className="block text-sm mb-1 text-gray-600">Nome del gruppo</label>
          <input value={name} onChange={e => setName(e.target.value)} required placeholder="Es. Amici Calcetto"
            className="w-full border border-card rounded px-3 py-2 text-black outline-none focus:border-accent" />
        </div>
        <Button type="submit" text={loading ? 'Creazione...' : 'Crea Gruppo'} variant="primary" size="xl" fullWidth/>
      </form>
    </div>
  )
}
