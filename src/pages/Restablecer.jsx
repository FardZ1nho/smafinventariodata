import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

// Destino del enlace "Olvidé mi contraseña". Supabase inicia una sesión temporal al abrir el enlace
// y aquí se elige la contraseña nueva.
export default function Restablecer() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [repetir, setRepetir] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [listo, setListo] = useState(false)

  async function guardar(e) {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return }
    if (password !== repetir) { setError('Las contraseñas no coinciden.'); return }
    setGuardando(true)
    const { error } = await supabase.auth.updateUser({ password })
    setGuardando(false)
    if (error) {
      setError(error.message.includes('different from the old')
        ? 'La contraseña nueva debe ser distinta de la anterior.'
        : error.message)
      return
    }
    setListo(true)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 mb-2">
            <span className="w-2.5 h-2.5 rounded-sm bg-signal" />
            <span className="font-mono text-xs tracking-widest uppercase text-ink-muted">Control de stock</span>
          </div>
          <h1 className="text-3xl font-semibold text-ink">Inventario</h1>
        </div>

        <div className="bg-white border border-line rounded-lg p-6 shadow-sm">
          <h2 className="text-sm font-medium text-ink mb-6">Crear contraseña nueva</h2>

          {loading ? (
            <p className="text-sm text-ink-muted">Verificando el enlace...</p>
          ) : listo ? (
            <div className="space-y-4">
              <p role="status" className="text-sm text-success">Listo, tu contraseña fue actualizada.</p>
              <button
                onClick={() => navigate('/', { replace: true })}
                className="w-full bg-ink text-white rounded-md py-2.5 text-sm font-medium hover:bg-ink/90 transition"
              >
                Entrar al sistema
              </button>
            </div>
          ) : !session ? (
            <div className="space-y-4">
              <p className="text-sm text-ink">El enlace no es válido o ya venció. Los enlaces sirven una sola vez y por poco tiempo.</p>
              <Link to="/login" className="text-sm font-medium text-signal hover:underline">Pedir un enlace nuevo</Link>
            </div>
          ) : (
            <form onSubmit={guardar} className="space-y-4">
              <div>
                <label htmlFor="nueva" className="block text-sm font-medium text-ink mb-1.5">Contraseña nueva</label>
                <input
                  id="nueva"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-md border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/40 focus:border-signal"
                />
                <p className="text-[11px] text-ink-muted mt-1">Mínimo 8 caracteres.</p>
              </div>
              <div>
                <label htmlFor="repetir" className="block text-sm font-medium text-ink mb-1.5">Repite la contraseña</label>
                <input
                  id="repetir"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={repetir}
                  onChange={(e) => setRepetir(e.target.value)}
                  className="w-full rounded-md border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/40 focus:border-signal"
                />
              </div>
              {error && <p className="text-sm text-danger">{error}</p>}
              <button
                type="submit"
                disabled={guardando}
                className="w-full bg-ink text-white rounded-md py-2.5 text-sm font-medium hover:bg-ink/90 transition disabled:opacity-50"
              >
                {guardando ? 'Guardando...' : 'Guardar contraseña'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
