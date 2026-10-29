import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { traerTodo } from '../lib/reportes'
import Paginador from '../components/Paginador'

const POR_PAGINA = 10

export default function Categorias() {
  const [categorias, setCategorias] = useState([])
  const [uso, setUso] = useState({}) // categoria_id -> productos activos que la usan
  const [nombre, setNombre] = useState('')
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [pagina, setPagina] = useState(1)
  // Categoría en edición: { id, nombre }
  const [editando, setEditando] = useState(null)

  async function cargar() {
    setCargando(true)
    const [{ data, error }, productos] = await Promise.all([
      supabase.from('categorias').select('*').order('nombre'),
      traerTodo(() => supabase.from('productos').select('categoria_id').eq('activo', true).not('categoria_id', 'is', null).order('id')).catch(() => []),
    ])
    if (error) setError(error.message)
    else setCategorias(data)
    const mapa = {}
    productos.forEach((p) => { mapa[p.categoria_id] = (mapa[p.categoria_id] ?? 0) + 1 })
    setUso(mapa)
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

  async function guardarEdicion(e) {
    e.preventDefault()
    if (!editando.nombre.trim()) return
    const { error } = await supabase.from('categorias').update({ nombre: editando.nombre.trim() }).eq('id', editando.id)
    if (error) { setError(error.message); return }
    setEditando(null)
    cargar()
  }

  async function eliminar(categoria) {
    // Con productos asignados no se elimina: quedarían sin categoría sin que nadie lo note
    if (uso[categoria.id]) return
    if (!confirm(`¿Eliminar la categoría "${categoria.nombre}"?`)) return
    const { error } = await supabase.from('categorias').delete().eq('id', categoria.id)
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
          placeholder="Nombre de la categoría (ej. Herramientas)"
          aria-label="Nombre de la nueva categoría"
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
              <li key={c.id} className="px-4 py-3">
                {editando?.id === c.id ? (
                  <form onSubmit={guardarEdicion} className="flex gap-2">
                    <input
                      value={editando.nombre}
                      onChange={(e) => setEditando({ ...editando, nombre: e.target.value })}
                      aria-label="Nombre de la categoría"
                      autoFocus
                      className="flex-1 rounded-md border border-line px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-signal/40 focus:border-signal"
                    />
                    <button className="bg-ink text-white px-3 py-1.5 rounded-md text-xs font-medium hover:bg-ink/90">Guardar</button>
                    <button type="button" onClick={() => setEditando(null)} className="px-3 py-1.5 rounded-md border border-line text-xs text-ink-muted hover:bg-stone-100">
                      Cancelar
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm text-ink">{c.nombre}</p>
                      <p className="text-[11px] text-ink-muted">
                        {uso[c.id] ? `${uso[c.id]} producto${uso[c.id] === 1 ? '' : 's'}` : 'Sin productos'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        onClick={() => setEditando({ id: c.id, nombre: c.nombre })}
                        className="text-xs font-medium text-ink-muted hover:text-ink hover:underline"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => eliminar(c)}
                        disabled={Boolean(uso[c.id])}
                        title={uso[c.id] ? 'Primero cambia la categoría de sus productos' : undefined}
                        className="text-xs font-medium text-danger hover:underline disabled:text-ink-muted/50 disabled:no-underline disabled:cursor-not-allowed"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
          {categorias.some((c) => uso[c.id]) && (
            <p className="text-[11px] text-ink-muted mt-2">Una categoría con productos no se puede eliminar: primero cambia la categoría de esos productos.</p>
          )}
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
