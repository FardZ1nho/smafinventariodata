import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth, AVISO_SESION_VENCIDA } from '../context/AuthContext'

function leerAvisoVencida() {
  try { return sessionStorage.getItem(AVISO_SESION_VENCIDA) } catch { return null }
}

export default function Login() {
  const { session } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const [sesionVencida] = useState(leerAvisoVencida)
  const [modo, setModo] = useState('entrar') // entrar | recuperar
  const [enlaceEnviado, setEnlaceEnviado] = useState(false)

  // El aviso se muestra una sola vez
  useEffect(() => {
    try { sessionStorage.removeItem(AVISO_SESION_VENCIDA) } catch { /* sin almacenamiento */ }
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setCargando(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(traducirError(error.message))

    setCargando(false)
  }

  async function enviarRecuperacion(e) {
    e.preventDefault()
    setError('')
    setCargando(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/restablecer`,
    })
    setCargando(false)
    if (error) {
      setError(error.message.includes('rate limit') ? 'Ya se envió un enlace hace poco. Espera unos minutos e intenta de nuevo.' : error.message)
      return
    }
    // Mismo mensaje exista o no el correo, para no revelar qué cuentas existen
    setEnlaceEnviado(true)
  }

  function cambiarModo(nuevo) {
    setModo(nuevo)
    setError('')
    setEnlaceEnviado(false)
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
          <h2 className="text-sm font-medium text-ink mb-6">{modo === 'entrar' ? 'Iniciar sesión' : 'Recuperar contraseña'}</h2>

          {modo === 'entrar' && sesionVencida && (
            <p role="status" className="text-sm text-signal bg-signal/10 rounded-md px-3 py-2 mb-4">
              {sesionVencida === 'actualizacion'
                ? 'El sistema se actualizó. Vuelve a iniciar sesión para ver las novedades.'
                : 'Tu sesión se cerró porque pasaron 24 horas desde que ingresaste. Vuelve a iniciar sesión.'}
            </p>
          )}

          {modo === 'recuperar' ? (
            enlaceEnviado ? (
              <div className="space-y-4">
                <p role="status" className="text-sm text-ink">
                  Si <strong>{email}</strong> está registrado, te enviamos un correo con un enlace para crear una contraseña nueva.
                  Revisa también la carpeta de spam.
                </p>
                <button type="button" onClick={() => cambiarModo('entrar')} className="text-sm font-medium text-signal hover:underline">
                  Volver a iniciar sesión
                </button>
              </div>
            ) : (
              <form onSubmit={enviarRecuperacion} className="space-y-4">
                <p className="text-xs text-ink-muted">Escribe tu correo y te enviaremos un enlace para crear una contraseña nueva.</p>
                <div>
                  <label htmlFor="correo-recuperar" className="block text-sm font-medium text-ink mb-1.5">Correo</label>
                  <input
                    id="correo-recuperar"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-md border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/40 focus:border-signal"
                    placeholder="tucorreo@ejemplo.com"
                  />
                </div>
                {error && <p className="text-sm text-danger">{error}</p>}
                <button
                  type="submit"
                  disabled={cargando}
                  className="w-full bg-ink text-white rounded-md py-2.5 text-sm font-medium hover:bg-ink/90 transition disabled:opacity-50"
                >
                  {cargando ? 'Enviando...' : 'Enviar enlace'}
                </button>
                <button type="button" onClick={() => cambiarModo('entrar')} className="block w-full text-center text-xs text-ink-muted hover:underline">
                  Volver
                </button>
              </form>
            )
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="correo" className="block text-sm font-medium text-ink mb-1.5">Correo</label>
                <input
                  id="correo"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-md border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/40 focus:border-signal"
                  placeholder="tucorreo@ejemplo.com"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="contrasena" className="block text-sm font-medium text-ink">Contraseña</label>
                  <button type="button" onClick={() => cambiarModo('recuperar')} className="text-xs text-signal hover:underline">
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
                <input
                  id="contrasena"
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
          )}
        </div>

        <p className="text-xs text-ink-muted text-center mt-4">
          ¿No tienes cuenta? Pídele acceso al administrador.
        </p>
      </div>
    </div>
  )
}
