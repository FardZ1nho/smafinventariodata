import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function RutaProtegida({ children }) {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone">
        <p className="text-sm text-ink-muted">Cargando...</p>
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />

  return children
}
