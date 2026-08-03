import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../store/AuthContext'
import { useData } from '../../store/DataContext'
import { useToast } from '../../store/ToastContext'
import Button from '../../components/ui/Button'
import { Plus, Users, Trash2 } from 'lucide-react'

export default function Dashboard() {
  const { user } = useAuth()
  const { groups, deleteGroup } = useData()
  const { showToast } = useToast()
  const navigate = useNavigate()

  async function handleDeleteGroup(e, group) {
    e.preventDefault()
    e.stopPropagation()
    if (!window.confirm(`Eliminare il gruppo "${group.name}"? Verranno eliminati anche sondaggi, eventi e membri.`)) return
    const { error } = await supabase.from('groups').delete().eq('id', group.id)
    if (error) { showToast(error?.message || String(error), 'error'); return }
    deleteGroup(group.id)
    showToast('Gruppo eliminato', 'success')
  }

  return (
    <div className="d-flex-1 d-flex flex-col px-4 pt-4 overflow-hidden">
      <div className="shrink-0 d-flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-accent">I miei gruppi</h1>
        
      </div>

      <Button icon={<Plus size={24} />} className="pos-fixed z-50" variant="primary" size="xl" square="square" style={{ width: 56, height: 56, bottom: '100px', right: '12px' }} onClick={() => navigate(`/groups/new`)} />

      {groups.length === 0 ? (
        <div className="flex-1 d-flex items-center justify-center text-center mx-auto max-w-lg w-full">
          <div>
            <Users size={48} className="mx-auto mb-4 text-gray-600" />
            <p className="text-gray-500 mb-4">Non sei ancora in nessun gruppo</p>
            <Button text="Crea il primo gruppo" variant="primary" size="lg" wide onClick={() => navigate('/groups/new')} />
          </div>
        </div>
      ) : (
        <div className="max-w-lg flex-1 overflow-y-auto space-y-3 pb-20 w-full mx-auto">
          {groups.map(group => (
            <Link key={group.id} to={`/groups/${group.id}`}
              className="block bg-card border border-card rounded-lg2 p-4 transition active:scale-98">
              <div className="d-flex items-center justify-between">
                <div className="min-w-0">
                  <h2 className="font-bold text-accent text-xl">{group.name}</h2>
                  <p className="text-sm text-gray-500 mt-1">Creato il {new Date(group.created_at).toLocaleDateString('it')}</p>
                </div>
                {group.created_by === user.id && (
                  <button onClick={e => handleDeleteGroup(e, group)} className="text-gray-400 hover:text-red-400 p-1 shrink-0 ml-2" aria-label="Elimina gruppo">
                    <Trash2 size={22} />
                  </button>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
