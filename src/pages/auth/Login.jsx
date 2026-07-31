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
        <h1 className="text-3xl font-bold text-center mb-2 text-accent">PlanIn</h1>
        <p className="text-gray-500 text-center mb-8 text-sm">Pianifica le tue uscite di gruppo</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm mb-1 text-gray-600">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="w-full border border-card rounded px-3 py-2 text-black outline-none focus:border-accent" />
          </div>
          <div style={{marginBottom:40}}>
            <label className="block text-sm mb-1 text-gray-600">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
              className="w-full border border-card rounded px-3 py-2 text-black outline-none focus:border-accent" />
          </div>
          <Button type="submit" text="Accedi" variant="primary" size="xl" fullWidth />
        </form>
        <p className="text-center mt-4 text-sm text-gray-500">
          Non hai un account? <Link to="/register" className="text-accent-hover hover:underline">Registrati</Link>
        </p>
      </div>
    </div>
  )
}
