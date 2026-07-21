import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import Paginador from '../components/Paginador'

const POR_PAGINA = 20

const NOMBRES_TABLA = {
  productos: 'Producto',
  categorias: 'Categoría',
  almacenes: 'Almacén',
  movimientos: 'Movimiento',
  producto_componentes: 'Componente de kit',
}

const ETIQUETA_ACCION = {
  insert: { texto: 'Creó', color: 'text-success bg-success/10' },
  update: { texto: 'Editó', color: 'text-signal bg-signal/10' },
  delete: { texto: 'Eliminó', color: 'text-danger bg-danger/10' },
}

export default function Auditoria() {
  const [registros, setRegistros] = useState([])
  const [total, setTotal] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [pagina, setPagina] = useState(1)
  const [filtroTabla, setFiltroTabla] = useState('todas')
  const [filtroAccion, setFiltroAccion] = useState('todas')
  const [expandido, setExpandido] = useState(null)

  async function cargar() {
    setCargando(true)
    let query = supabase
      .from('auditoria')
      .select('*, usuarios(nombre)', { count: 'exact' })
      .order('created_at', { ascending: false })

    if (filtroTabla !== 'todas') query = query.eq('tabla', filtroTabla)
    if (filtroAccion !== 'todas') query = query.eq('accion', filtroAccion)

    const desde = (pagina - 1) * POR_PAGINA
    query = query.range(desde, desde + POR_PAGINA - 1)

    const { data, error, count } = await query
    if (error) setError(error.message)
    setRegistros(data ?? [])
    setTotal(count ?? 0)
    setCargando(false)
  }

  useEffect(() => { cargar() }, [filtroTabla, filtroAccion, pagina]) // eslint-disable-line react-hooks/exhaustive-deps

  function actualizarFiltro(setter, valor) {
    setter(valor)
    setPagina(1)
  }

  function nombreDelRegistro(r) {
    return r.datos_nuevos?.nombre ?? r.datos_anteriores?.nombre ?? r.registro_id?.slice(0, 8) ?? '—'
  }

  // Para "update": muestra solo los campos que cambiaron
  function camposCambiados(r) {
    if (r.accion !== 'update' || !r.datos_anteriores || !r.datos_nuevos) return []
    const claves = new Set([...Object.keys(r.datos_anteriores), ...Object.keys(r.datos_nuevos)])
    const cambios = []
    claves.forEach((k) => {
      const antes = r.datos_anteriores[k]
      const despues = r.datos_nuevos[k]
      if (JSON.stringify(antes) !== JSON.stringify(despues)) {
        cambios.push({ campo: k, antes, despues })
      }
    })
    return cambios
  }

  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA))

  return (
    <div>
      <h2 className="text-2xl font-semibold text-ink mb-1">Auditoría</h2>
      <p className="text-sm text-ink-muted mb-6">Quién hizo qué y cuándo. Solo visible para administradores.</p>

      <div className="flex flex-wrap gap-2 mb-5">
        <select
          value={filtroTabla}
          onChange={(e) => actualizarFiltro(setFiltroTabla, e.target.value)}
          className="rounded-md border border-line px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-signal/40 focus:border-signal"
        >
          <option value="todas">Todas las secciones</option>
          {Object.entries(NOMBRES_TABLA).map(([valor, etiqueta]) => (
            <option key={valor} value={valor}>{etiqueta}</option>
          ))}
        </select>

        <div className="flex rounded-md bg-stone-100 p-1">
          {['todas', 'insert', 'update', 'delete'].map((a) => (
            <button
              key={a}
              onClick={() => actualizarFiltro(setFiltroAccion, a)}
              className={`px-3 py-1.5 text-xs font-medium rounded transition ${filtroAccion === a ? 'bg-white shadow-sm text-ink' : 'text-ink-muted'}`}
            >
              {a === 'todas' ? 'Todas' : a === 'insert' ? 'Creaciones' : a === 'update' ? 'Ediciones' : 'Eliminaciones'}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-danger mb-4">{error}</p>}

      {cargando ? (
        <p className="text-sm text-ink-muted">Cargando...</p>
      ) : registros.length === 0 ? (
        <p className="text-sm text-ink-muted">No hay registros con esos filtros.</p>
      ) : (
        <>
          <div className="bg-white border border-line rounded-lg divide-y divide-line">
            {registros.map((r) => {
              const abierto = expandido === r.id
              const accion = ETIQUETA_ACCION[r.accion]
              const cambios = camposCambiados(r)
              return (
                <div key={r.id}>
                  <button
                    onClick={() => setExpandido(abierto ? null : r.id)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-stone-100/60 transition"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-mono uppercase tracking-wide px-1.5 py-0.5 rounded ${accion.color}`}>
                          {accion.texto}
                        </span>
                        <span className="text-sm font-medium text-ink">{NOMBRES_TABLA[r.tabla] ?? r.tabla}</span>
                        <span className="text-sm text-ink-muted truncate">"{nombreDelRegistro(r)}"</span>
                      </div>
                      <p className="text-xs text-ink-muted mt-0.5">
                        {r.usuarios?.nombre ?? 'Usuario eliminado'} ·{' '}
                        {new Date(r.created_at).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' })}
                      </p>
                    </div>
                    <span className="text-xs text-ink-muted shrink-0">{abierto ? 'Ocultar' : 'Ver detalle'}</span>
                  </button>

                  {abierto && (
                    <div className="px-4 pb-4 bg-stone-100/40">
                      {r.accion === 'update' ? (
                        cambios.length === 0 ? (
                          <p className="text-xs text-ink-muted">Sin cambios detectables en los campos.</p>
                        ) : (
                          <div className="border border-line rounded-md bg-white divide-y divide-line">
                            {cambios.map((c, i) => (
                              <div key={i} className="px-3 py-2">
                                <p className="text-[10px] font-mono uppercase tracking-wide text-ink-muted mb-1">{c.campo}</p>
                                <div className="flex items-center gap-2 text-xs">
                                  <span className="text-danger line-through font-mono">{formatear(c.antes)}</span>
                                  <span className="text-ink-muted">→</span>
                                  <span className="text-success font-mono">{formatear(c.despues)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )
                      ) : (
                        <pre className="text-xs font-mono bg-white border border-line rounded-md p-3 overflow-x-auto">
                          {JSON.stringify(r.accion === 'delete' ? r.datos_anteriores : r.datos_nuevos, null, 2)}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <Paginador pagina={pagina} totalPaginas={totalPaginas} onCambiar={setPagina} />
        </>
      )}
    </div>
  )
}

function formatear(valor) {
  if (valor === null || valor === undefined) return '—'
  if (typeof valor === 'boolean') return valor ? 'sí' : 'no'
  return String(valor)
}
