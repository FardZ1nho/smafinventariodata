import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { session } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setCargando(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(traducirError(error.message))

    setCargando(false)
  }

  function traducirError(msg) {
    if (msg.includes('Invalid login credentials')) return 'Correo o contraseña incorrectos.'
    if (msg.includes('Email not confirmed')) return 'Este correo aún no fue confirmado.'
    return msg
  }

  // Si ya hay una sesión activa (login recién hecho, o entró directo a /login
  // estando ya logueado), lo mandamos al sistema.
  if (session) return <Navigate to="/" replace />

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
          <h2 className="text-sm font-medium text-ink mb-6">Iniciar sesión</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">Correo</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/40 focus:border-signal"
                placeholder="tucorreo@ejemplo.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">Contraseña</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/40 focus:border-signal"
                placeholder="••••••••"
              />
            </div>

            {error && <p className="text-sm text-danger">{error}</p>}

            <button
              type="submit"
              disabled={cargando}
              className="w-full bg-ink text-white rounded-md py-2.5 text-sm font-medium hover:bg-ink/90 transition disabled:opacity-50"
            >
              {cargando ? 'Un momento...' : 'Entrar'}
            </button>
          </form>
        </div>

        <p className="text-xs text-ink-muted text-center mt-4">
          ¿No tienes cuenta? Pídele acceso al administrador.
        </p>
      </div>
    </div>
  )
}
