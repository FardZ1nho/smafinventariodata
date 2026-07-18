import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import Paginador from '../components/Paginador'

const POR_PAGINA = 10

export default function Almacenes() {
  const [almacenes, setAlmacenes] = useState([])
  const [nombre, setNombre] = useState('')
  const [direccion, setDireccion] = useState('')
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [pagina, setPagina] = useState(1)

  async function cargar() {
    setCargando(true)
    const { data, error } = await supabase.from('almacenes').select('*').eq('activo', true).order('nombre')
    if (error) setError(error.message)
    else setAlmacenes(data)
    setCargando(false)
  }

  useEffect(() => { cargar() }, [])

  async function agregar(e) {
    e.preventDefault()
    if (!nombre.trim()) return
    const { error } = await supabase.from('almacenes').insert({ nombre: nombre.trim(), direccion: direccion.trim() || null })
    if (error) { setError(error.message); return }
    setNombre('')
    setDireccion('')
    cargar()
  }

  async function desactivar(id) {
    if (!confirm('¿Desactivar este almacén? No se borrará su historial de stock.')) return
    const { error } = await supabase.from('almacenes').update({ activo: false }).eq('id', id)
    if (error) { setError(error.message); return }
    cargar()
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-semibold text-ink mb-1">Almacenes</h2>
      <p className="text-sm text-ink-muted mb-6">Lugares donde guardas tu inventario.</p>

      <form onSubmit={agregar} className="flex flex-col sm:flex-row gap-2 mb-6">
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre (ej. Almacén Los Olivos)"
          className="flex-1 rounded-md border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/40 focus:border-signal"
        />
        <input
          value={direccion}
          onChange={(e) => setDireccion(e.target.value)}
          placeholder="Dirección (opcional)"
          className="flex-1 rounded-md border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/40 focus:border-signal"
        />
        <button className="bg-ink text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-ink/90 transition whitespace-nowrap">
          Agregar
        </button>
      </form>

      {error && <p className="text-sm text-danger mb-4">{error}</p>}

      {cargando ? (
        <p className="text-sm text-ink-muted">Cargando...</p>
      ) : almacenes.length === 0 ? (
        <p className="text-sm text-ink-muted">Aún no hay almacenes. Agrega el primero arriba.</p>
      ) : (
        <>
          <ul className="divide-y divide-line bg-white border border-line rounded-lg">
            {almacenes.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA).map((a) => (
              <li key={a.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-ink">{a.nombre}</p>
                  {a.direccion && <p className="text-xs text-ink-muted">{a.direccion}</p>}
                </div>
                <button onClick={() => desactivar(a.id)} className="text-xs font-medium text-danger hover:underline">
                  Eliminar
                </button>
              </li>
            ))}
          </ul>
          <Paginador
            pagina={pagina}
            totalPaginas={Math.max(1, Math.ceil(almacenes.length / POR_PAGINA))}
            onCambiar={setPagina}
          />
        </>
      )}
    </div>
  )
}
