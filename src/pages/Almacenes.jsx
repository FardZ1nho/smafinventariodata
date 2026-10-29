import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { traerTodo } from '../lib/reportes'
import Paginador from '../components/Paginador'

const POR_PAGINA = 10

export default function Almacenes() {
  const [almacenes, setAlmacenes] = useState([])
  // almacen_id -> { productos: con stock distinto de 0, unidades: suma }
  const [uso, setUso] = useState({})
  const [nombre, setNombre] = useState('')
  const [direccion, setDireccion] = useState('')
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [pagina, setPagina] = useState(1)
  // Almacén en edición: { id, nombre, direccion }
  const [editando, setEditando] = useState(null)

  async function cargar() {
    setCargando(true)
    const [{ data, error }, stock] = await Promise.all([
      supabase.from('almacenes').select('*').eq('activo', true).order('nombre'),
      traerTodo(() => supabase.from('stock_almacen').select('almacen_id, cantidad').neq('cantidad', 0).order('id')).catch(() => []),
    ])
    if (error) setError(error.message)
    else setAlmacenes(data)
    const mapa = {}
    stock.forEach((s) => {
      const actual = (mapa[s.almacen_id] ??= { productos: 0, unidades: 0 })
      actual.productos += 1
      actual.unidades += s.cantidad
    })
    setUso(mapa)
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

  async function guardarEdicion(e) {
    e.preventDefault()
    if (!editando.nombre.trim()) return
    const { error } = await supabase
      .from('almacenes')
      .update({ nombre: editando.nombre.trim(), direccion: editando.direccion.trim() || null })
      .eq('id', editando.id)
    if (error) { setError(error.message); return }
    setEditando(null)
    cargar()
  }

  async function desactivar(almacen) {
    // Con stock no se elimina: las existencias quedarían en un almacén que ya no aparece en los selectores
    if (uso[almacen.id]) return
    if (!confirm(`¿Eliminar "${almacen.nombre}"? No se borrará su historial; solo dejará de aparecer en la lista.`)) return
    const { error } = await supabase.from('almacenes').update({ activo: false }).eq('id', almacen.id)
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
          aria-label="Nombre del nuevo almacén"
          className="flex-1 rounded-md border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/40 focus:border-signal"
        />
        <input
          value={direccion}
          onChange={(e) => setDireccion(e.target.value)}
          placeholder="Dirección (opcional)"
          aria-label="Dirección del nuevo almacén"
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
              <li key={a.id} className="px-4 py-3">
                {editando?.id === a.id ? (
                  <form onSubmit={guardarEdicion} className="flex flex-col sm:flex-row gap-2">
                    <input
                      value={editando.nombre}
                      onChange={(e) => setEditando({ ...editando, nombre: e.target.value })}
                      aria-label="Nombre del almacén"
                      autoFocus
                      className="flex-1 rounded-md border border-line px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-signal/40 focus:border-signal"
                    />
                    <input
                      value={editando.direccion}
                      onChange={(e) => setEditando({ ...editando, direccion: e.target.value })}
                      placeholder="Dirección (opcional)"
                      aria-label="Dirección del almacén"
                      className="flex-1 rounded-md border border-line px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-signal/40 focus:border-signal"
                    />
                    <div className="flex gap-2">
                      <button className="bg-ink text-white px-3 py-1.5 rounded-md text-xs font-medium hover:bg-ink/90">Guardar</button>
                      <button type="button" onClick={() => setEditando(null)} className="px-3 py-1.5 rounded-md border border-line text-xs text-ink-muted hover:bg-stone-100">
                        Cancelar
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">{a.nombre}</p>
                      {a.direccion && <p className="text-xs text-ink-muted">{a.direccion}</p>}
                      <p className="text-[11px] text-ink-muted mt-0.5">
                        {uso[a.id]
                          ? `${uso[a.id].productos} producto${uso[a.id].productos === 1 ? '' : 's'} con stock · ${uso[a.id].unidades} unidades`
                          : 'Sin stock'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        onClick={() => setEditando({ id: a.id, nombre: a.nombre, direccion: a.direccion ?? '' })}
                        className="text-xs font-medium text-ink-muted hover:text-ink hover:underline"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => desactivar(a)}
                        disabled={Boolean(uso[a.id])}
                        title={uso[a.id] ? 'Primero transfiere o retira su stock' : undefined}
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
          {almacenes.some((a) => uso[a.id]) && (
            <p className="text-[11px] text-ink-muted mt-2">Un almacén con stock no se puede eliminar: primero transfiere o retira sus existencias.</p>
          )}
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
