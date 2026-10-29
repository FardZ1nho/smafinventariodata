import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext(null)

// Una sesión dura como máximo 24 horas desde el inicio de sesión; luego hay que volver a entrar.
// Se mide con last_sign_in_at, que lo fija Supabase al iniciar sesión (no cambia al renovar el token).
const DURACION_MAXIMA_SESION_MS = 24 * 60 * 60 * 1000
// Las sesiones iniciadas antes de esta fecha se cierran (se usa al publicar una actualización
// para que todos vuelvan a entrar). Debe ser anterior al momento de publicar.
const SESIONES_VALIDAS_DESDE = Date.parse('2026-10-28T23:05:00-05:00')
export const AVISO_SESION_VENCIDA = 'sesion_vencida'

// Devuelve el motivo del cierre ('tiempo' | 'actualizacion') o null si la sesión sigue vigente
function sesionVencida(session) {
  // La sesión temporal del enlace de recuperación de contraseña no se cierra a mitad del cambio
  if (window.location.pathname.startsWith('/restablecer')) return null
  const inicio = Date.parse(session?.user?.last_sign_in_at ?? '')
  if (!Number.isFinite(inicio)) return null
  if (inicio < SESIONES_VALIDAS_DESDE) return 'actualizacion'
  if (Date.now() - inicio > DURACION_MAXIMA_SESION_MS) return 'tiempo'
  return null
}

function cerrarSesionVencida(motivo) {
  try { sessionStorage.setItem(AVISO_SESION_VENCIDA, motivo) } catch { /* sin almacenamiento: solo se omite el aviso */ }
  // scope 'local': cierra solo este dispositivo, no las sesiones del usuario en otros equipos.
  // setTimeout: Supabase no recomienda llamar a sus métodos dentro de onAuthStateChange.
  setTimeout(() => supabase.auth.signOut({ scope: 'local' }), 0)
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = cargando, null = sin sesión
  const [perfil, setPerfil] = useState(null) // { nombre, rol }
  const [perfilCargando, setPerfilCargando] = useState(true)

  useEffect(() => {
    function aplicar(nuevaSesion) {
      const motivo = nuevaSesion && sesionVencida(nuevaSesion)
      if (motivo) {
        cerrarSesionVencida(motivo)
        setSession(null)
        return
      }
      setSession(nuevaSesion)
    }

    supabase.auth.getSession().then(({ data }) => aplicar(data.session))

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => aplicar(newSession))

    return () => listener.subscription.unsubscribe()
  }, [])

  // Con la app abierta, se revisa cada minuto y al volver a la pestaña
  useEffect(() => {
    if (!session) return
    function revisar() {
      const motivo = sesionVencida(session)
      if (motivo) {
        cerrarSesionVencida(motivo)
        setSession(null)
      }
    }
    const intervalo = setInterval(revisar, 60 * 1000)
    document.addEventListener('visibilitychange', revisar)
    return () => {
      clearInterval(intervalo)
      document.removeEventListener('visibilitychange', revisar)
    }
  }, [session])

  // Cuando hay sesión, cargamos su rol (admin/empleado) desde la tabla usuarios
  useEffect(() => {
    if (!session?.user?.id) {
      setPerfil(null)
      setPerfilCargando(false)
      return
    }
    setPerfilCargando(true)
    supabase
      .from('usuarios')
      .select('nombre, rol')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
        setPerfil(data ?? null)
        setPerfilCargando(false)
      })
  }, [session?.user?.id])

  const signOut = () => supabase.auth.signOut()

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        perfil,
        perfilCargando,
        esAdmin: perfil?.rol === 'admin',
        signOut,
        loading: session === undefined,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
