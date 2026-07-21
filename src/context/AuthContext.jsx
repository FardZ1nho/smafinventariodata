import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = cargando, null = sin sesión
  const [perfil, setPerfil] = useState(null) // { nombre, rol }
  const [perfilCargando, setPerfilCargando] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

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
