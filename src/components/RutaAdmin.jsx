import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function RutaAdmin({ children }) {
  const { perfilCargando, esAdmin } = useAuth()

  if (perfilCargando) {
    return <p className="text-sm text-ink-muted">Cargando...</p>
  }

  if (!esAdmin) return <Navigate to="/" replace />

  return children
}
