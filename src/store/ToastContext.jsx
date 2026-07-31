import { createContext, useContext, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'

const ToastContext = createContext(null)

let toastId = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timersRef = useRef({})

  const removeToast = useCallback((id) => {
    clearTimeout(timersRef.current[id])
    delete timersRef.current[id]
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const showToast = useCallback((message, type = 'info') => {
    const id = ++toastId
    setToasts(prev => [...prev, { id, message, type }])
    timersRef.current[id] = setTimeout(() => removeToast(id), 2000)
    return id
  }, [removeToast])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {createPortal(
        <div className="pos-fixed" style={{
          position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
          zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          pointerEvents: 'none', width: 'auto', maxWidth: '90%'
        }}>
          {toasts.map(t => {
            const color = t.type === 'error' ? '#ef4444'
              : t.type === 'success' ? '#22c55e'
              : t.type === 'warning' ? '#f59e0b'
              : '#3b82f6'
            return (
              <div key={t.id} onClick={() => removeToast(t.id)}
                style={{
                  pointerEvents: 'auto', cursor: 'pointer',
                  animation: 'toastIn 0.25s ease-out',
                  padding: '10px 16px 10px 14px', borderRadius: 10,
                  fontSize: 14, fontWeight: 500, textAlign: 'center',
                  background: '#17171e',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderLeft: `4px solid ${color}`,
                  color: '#fff',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
                  maxWidth: '100%'
                }}>
                {t.message}
              </div>
            )
          })}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
