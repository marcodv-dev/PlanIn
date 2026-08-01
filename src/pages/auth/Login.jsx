import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../store/AuthContext'
import { useToast } from '../../store/ToastContext'
import Button from '../../components/ui/Button'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { signIn } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    try {
      await signIn(email, password)
      navigate('/')
    } catch (err) {
      showToast(err?.message || String(err), 'error')
    }
  }

  return (
    <div className="min-h-screen d-flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <img src="/PlanIn-title.png" alt="PlanIn" draggable={false}
          className="d-flex mx-auto mb-2 mt-4" style={{ width: '200px', height: 'auto'}} />
        <p className="text-gray-500 text-center mb-8 text-sm">Pianifica le tue uscite di gruppo</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm mb-1 text-gray-600">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="w-full border border-card rounded px-3 py-2 text-black outline-none focus:border-auth" />
          </div>
          <div style={{marginBottom:40}}>
            <label className="block text-sm mb-1 text-gray-600">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
              className="w-full border border-card rounded px-3 py-2 text-black outline-none focus:border-auth" />
          </div>
          <Button type="submit" text="Accedi" variant="primary2" size="xl" fullWidth/>
        </form>
        <p className="text-center mt-4 text-sm text-gray-500">
          Non hai un account? <Link to="/register" className="text-black hover:underline">Registrati</Link>
        </p>
      </div>
    </div>
  )
}
