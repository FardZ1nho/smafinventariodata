import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import Paginador from '../components/Paginador'

const POR_PAGINA = 10

export default function Categorias() {
  const [categorias, setCategorias] = useState([])
  const [nombre, setNombre] = useState('')
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [pagina, setPagina] = useState(1)

  async function cargar() {
    setCargando(true)
    const { data, error } = await supabase.from('categorias').select('*').order('nombre')
    if (error) setError(error.message)
    else setCategorias(data)
    setCargando(false)
  }

  useEffect(() => { cargar() }, [])

  async function agregar(e) {
    e.preventDefault()
    if (!nombre.trim()) return
    const { error } = await supabase.from('categorias').insert({ nombre: nombre.trim() })
    if (error) { setError(error.message); return }
    setNombre('')
    cargar()
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar esta categoría? Los productos que la usan quedarán sin categoría.')) return
    const { error } = await supabase.from('categorias').delete().eq('id', id)
    if (error) { setError(error.message); return }
    cargar()
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-semibold text-ink mb-1">Categorías</h2>
      <p className="text-sm text-ink-muted mb-6">Organiza tus productos en grupos.</p>

      <form onSubmit={agregar} className="flex gap-2 mb-6">
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre de la categoría (ej. Bebidas)"
          className="flex-1 rounded-md border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/40 focus:border-signal"
        />
        <button className="bg-ink text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-ink/90 transition">
          Agregar
        </button>
      </form>

      {error && <p className="text-sm text-danger mb-4">{error}</p>}

      {cargando ? (
        <p className="text-sm text-ink-muted">Cargando...</p>
      ) : categorias.length === 0 ? (
        <p className="text-sm text-ink-muted">Aún no hay categorías. Agrega la primera arriba.</p>
      ) : (
        <>
          <ul className="divide-y divide-line bg-white border border-line rounded-lg">
            {categorias.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA).map((c) => (
              <li key={c.id} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-ink">{c.nombre}</span>
                <button
                  onClick={() => eliminar(c.id)}
                  className="text-xs font-medium text-danger hover:underline"
                >
                  Eliminar
                </button>
              </li>
            ))}
          </ul>
          <Paginador
            pagina={pagina}
            totalPaginas={Math.max(1, Math.ceil(categorias.length / POR_PAGINA))}
            onCambiar={setPagina}
          />
        </>
      )}
    </div>
  )
}
