import { supabase } from './supabaseClient'

// Devuelve { id: nombre } para los usuarios indicados.
// Si la consulta falla, devuelve un mapa vacío para que la pantalla siga funcionando.
export async function nombresUsuarios(ids) {
  const unicos = [...new Set(ids.filter(Boolean))]
  if (unicos.length === 0) return {}
  const { data } = await supabase.from('usuarios').select('id, nombre').in('id', unicos)
  return Object.fromEntries((data ?? []).map((u) => [u.id, u.nombre]))
}
