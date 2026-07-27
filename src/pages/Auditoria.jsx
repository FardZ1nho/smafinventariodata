import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import Paginador from '../components/Paginador'

const POR_PAGINA = 20

const NOMBRES_TABLA = {
  productos: 'Producto',
  categorias: 'Categoría',
  almacenes: 'Almacén',
  producto_componentes: 'Componente de kit',
  importaciones: 'Importación',
}

const NOMBRES_TABLA_TODAS = { ...NOMBRES_TABLA, movimientos: 'Movimiento' }

const ETIQUETA_ACCION = {
  insert: { texto: 'Creó', color: 'text-success bg-success/10' },
  update: { texto: 'Editó', color: 'text-signal bg-signal/10' },
  delete: { texto: 'Eliminó', color: 'text-danger bg-danger/10' },
}

const ETIQUETA_TIPO_MOVIMIENTO = {
  entrada: { texto: 'Entrada', color: 'text-success bg-success/10' },
  salida: { texto: 'Salida', color: 'text-danger bg-danger/10' },
  transferencia: { texto: 'Transferencia', color: 'text-signal bg-signal/10' },
}

// Traducción de cada campo técnico a español.
// tipo indica si el valor es un ID que hay que resolver a un nombre real.
// null significa "no mostrar este campo" (es redundante o interno).
const CAMPOS = {
  id: null,
  usuario_id: null,
  nombre: { etiqueta: 'Nombre' },
  sku: { etiqueta: 'SKU' },
  codigo: { etiqueta: 'Código' },
  proveedor: { etiqueta: 'Proveedor' },
  categoria_id: { etiqueta: 'Categoría', tipo: 'categoria' },
  precio_compra: { etiqueta: 'Precio de compra', prefijo: 'S/ ' },
  precio_venta: { etiqueta: 'Precio de venta', prefijo: 'S/ ' },
  stock_minimo: { etiqueta: 'Stock mínimo' },
  unidad: { etiqueta: 'Unidad' },
  tipo: { etiqueta: 'Tipo' },
  foto_url: { etiqueta: 'Foto' },
  activo: { etiqueta: 'Activo', tipo: 'booleano' },
  created_at: { etiqueta: 'Fecha de creación', tipo: 'fecha' },
  direccion: { etiqueta: 'Dirección' },
  producto_id: { etiqueta: 'Producto', tipo: 'producto' },
  almacen_id: { etiqueta: 'Almacén', tipo: 'almacen' },
  almacen_origen_id: { etiqueta: 'Almacén de origen', tipo: 'almacen' },
  almacen_destino_id: { etiqueta: 'Almacén de destino', tipo: 'almacen' },
  cantidad: { etiqueta: 'Cantidad' },
  motivo: { etiqueta: 'Motivo' },
  nota: { etiqueta: 'Nota' },
  estado: { etiqueta: 'Estado' },
  fecha_llegada_estimada: { etiqueta: 'Llegada estimada', tipo: 'fechaCorta' },
  kit_id: { etiqueta: 'Kit', tipo: 'producto' },
  componente_id: { etiqueta: 'Componente', tipo: 'producto' },
}

const VALORES = {
  simple: 'Simple', kit: 'Kit',
  entrada: 'Entrada', salida: 'Salida', transferencia: 'Transferencia',
  confirmado: 'Confirmado', en_transito: 'En tránsito',
}

export default function Auditoria() {
  const [registros, setRegistros] = useState([])
  const [total, setTotal] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [pagina, setPagina] = useState(1)
  const [filtroTabla, setFiltroTabla] = useState('todas')
  const [vista, setVista] = useState('todas') // todas | movimientos | insert | update | delete
  const [expandido, setExpandido] = useState(null)

  const [mapaProductos, setMapaProductos] = useState({})
  const [mapaAlmacenes, setMapaAlmacenes] = useState({})
  const [mapaCategorias, setMapaCategorias] = useState({})

  useEffect(() => {
    async function cargarMapas() {
      const [{ data: prods }, { data: alms }, { data: cats }] = await Promise.all([
        supabase.from('productos').select('id, nombre'),
        supabase.from('almacenes').select('id, nombre'),
        supabase.from('categorias').select('id, nombre'),
      ])
      setMapaProductos(Object.fromEntries((prods ?? []).map((p) => [p.id, p.nombre])))
      setMapaAlmacenes(Object.fromEntries((alms ?? []).map((a) => [a.id, a.nombre])))
      setMapaCategorias(Object.fromEntries((cats ?? []).map((c) => [c.id, c.nombre])))
    }
    cargarMapas()
  }, [])

  async function cargar() {
    setCargando(true)
    let query = supabase
      .from('auditoria')
      .select('*, usuarios(nombre)', { count: 'exact' })
      .order('created_at', { ascending: false })

    if (vista === 'movimientos') {
      query = query.eq('tabla', 'movimientos')
    } else {
      query = query.neq('tabla', 'movimientos')
      if (filtroTabla !== 'todas') query = query.eq('tabla', filtroTabla)
      if (vista !== 'todas') query = query.eq('accion', vista)
    }

    const desde = (pagina - 1) * POR_PAGINA
    query = query.range(desde, desde + POR_PAGINA - 1)

    const { data, error, count } = await query
    if (error) setError(error.message)
    setRegistros(data ?? [])
    setTotal(count ?? 0)
    setCargando(false)
  }

  useEffect(() => { cargar() }, [filtroTabla, vista, pagina]) // eslint-disable-line react-hooks/exhaustive-deps

  function actualizarFiltro(setter, valor) {
    setter(valor)
    setPagina(1)
  }

  // Resuelve un ID (producto/almacén/categoría) a su nombre real
  function resolver(tipo, id) {
    if (!id) return '—'
    const mapa = tipo === 'producto' ? mapaProductos : tipo === 'almacen' ? mapaAlmacenes : mapaCategorias
    return mapa[id] ?? '(eliminado)'
  }

  // Formatea un valor según el tipo de campo que sea
  function formatearValor(campo, valor) {
    const config = CAMPOS[campo]
    if (valor === null || valor === undefined || valor === '') return '—'
    if (config?.tipo === 'producto' || config?.tipo === 'almacen' || config?.tipo === 'categoria') {
      return resolver(config.tipo, valor)
    }
    if (config?.tipo === 'booleano') return valor ? 'Sí' : 'No'
    if (config?.tipo === 'fecha') return new Date(valor).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' })
    if (config?.tipo === 'fechaCorta') return new Date(valor + 'T00:00:00').toLocaleDateString('es-PE', { dateStyle: 'medium' })
    if (VALORES[valor]) return VALORES[valor]
    const prefijo = config?.prefijo ?? ''
    return `${prefijo}${valor}`
  }

  function etiquetaDe(campo) {
    return CAMPOS[campo]?.etiqueta ?? campo
  }

  // Nombre representativo del registro para el encabezado de cada fila
  function nombreDelRegistro(r) {
    const datos = r.datos_nuevos ?? r.datos_anteriores ?? {}
    if (datos.nombre) return datos.nombre
    if (datos.codigo) return datos.codigo
    if (datos.producto_id) return resolver('producto', datos.producto_id)
    if (datos.kit_id) return resolver('producto', datos.kit_id)
    return r.registro_id?.slice(0, 8) ?? '—'
  }

  // Lista de campos visibles (traducidos) para insert/delete
  function camposVisibles(datos) {
    if (!datos) return []
    return Object.entries(datos)
      .filter(([campo]) => CAMPOS[campo] !== null)
      .map(([campo, valor]) => ({ etiqueta: etiquetaDe(campo), valor: formatearValor(campo, valor) }))
  }

  // Para "update": muestra solo los campos que cambiaron, traducidos
  function camposCambiados(r) {
    if (r.accion !== 'update' || !r.datos_anteriores || !r.datos_nuevos) return []
    const claves = new Set([...Object.keys(r.datos_anteriores), ...Object.keys(r.datos_nuevos)])
    const cambios = []
    claves.forEach((campo) => {
      if (CAMPOS[campo] === null) return
      const antes = r.datos_anteriores[campo]
      const despues = r.datos_nuevos[campo]
      if (JSON.stringify(antes) !== JSON.stringify(despues)) {
        cambios.push({ etiqueta: etiquetaDe(campo), antes: formatearValor(campo, antes), despues: formatearValor(campo, despues) })
      }
    })
    return cambios
  }

  // Para movimientos creados, mostramos el tipo real (Entrada/Salida/Transferencia)
  // en vez del genérico "Creó" — es más claro para quien no es de sistemas.
  function etiquetaDeAccion(r) {
    if (r.tabla === 'movimientos' && r.accion === 'insert') {
      const tipo = r.datos_nuevos?.tipo
      return ETIQUETA_TIPO_MOVIMIENTO[tipo] ?? ETIQUETA_ACCION.insert
    }
    if (r.tabla === 'movimientos' && r.accion === 'update'
        && r.datos_anteriores?.estado === 'en_transito' && r.datos_nuevos?.estado === 'confirmado') {
      return { texto: 'Llegada confirmada', color: 'text-success bg-success/10' }
    }
    return ETIQUETA_ACCION[r.accion]
  }

  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA))

  return (
    <div>
      <h2 className="text-2xl font-semibold text-ink mb-1">Auditoría</h2>
      <p className="text-sm text-ink-muted mb-6">Quién hizo qué y cuándo. Solo visible para administradores.</p>

      <div className="flex flex-wrap gap-2 mb-5">
        <div className="flex rounded-md bg-stone-100 p-1">
          {['todas', 'movimientos', 'insert', 'update', 'delete'].map((v) => (
            <button
              key={v}
              onClick={() => actualizarFiltro(setVista, v)}
              className={`px-3 py-1.5 text-xs font-medium rounded transition ${vista === v ? 'bg-white shadow-sm text-ink' : 'text-ink-muted'}`}
            >
              {v === 'todas' ? 'Todas' : v === 'movimientos' ? 'Movimientos' : v === 'insert' ? 'Creaciones' : v === 'update' ? 'Ediciones' : 'Eliminaciones'}
            </button>
          ))}
        </div>

        {vista !== 'movimientos' && (
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
        )}
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
              const accion = etiquetaDeAccion(r)
              const cambios = camposCambiados(r)
              const visibles = r.accion === 'delete' ? camposVisibles(r.datos_anteriores) : camposVisibles(r.datos_nuevos)
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
                        <span className="text-sm font-medium text-ink">{NOMBRES_TABLA_TODAS[r.tabla] ?? r.tabla}</span>
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
                          <p className="text-xs text-ink-muted">No hubo cambios visibles en los campos.</p>
                        ) : (
                          <div className="border border-line rounded-md bg-white divide-y divide-line">
                            {cambios.map((c, i) => (
                              <div key={i} className="px-3 py-2">
                                <p className="text-xs font-medium text-ink-muted mb-1">{c.etiqueta}</p>
                                <div className="flex items-center gap-2 text-sm flex-wrap">
                                  <span className="text-danger line-through">{c.antes}</span>
                                  <span className="text-ink-muted">→</span>
                                  <span className="text-success font-medium">{c.despues}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )
                      ) : (
                        <div className="border border-line rounded-md bg-white divide-y divide-line">
                          {visibles.map((v, i) => (
                            <div key={i} className="flex items-center justify-between gap-3 px-3 py-2">
                              <span className="text-xs text-ink-muted">{v.etiqueta}</span>
                              <span className="text-sm text-ink text-right">{v.valor}</span>
                            </div>
                          ))}
                        </div>
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