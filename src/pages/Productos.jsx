import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import ProductoForm from '../components/ProductoForm'
import ProductoDetalle from '../components/ProductoDetalle'
import Paginador from '../components/Paginador'
import BotonDescarga from '../components/BotonDescarga'
import { modeloInventario, opcionesDescarga } from '../lib/reportes'
import { useAuth } from '../context/AuthContext'

const POR_PAGINA = 10

export default function Productos() {
  const { perfil } = useAuth()
  // Filtro inicial desde la URL (las tarjetas del Resumen enlazan a /productos?filtro=...)
  const [parametros, setParametros] = useSearchParams()
  const filtroInicial = parametros.get('filtro')
  const productoInicial = parametros.get('ver') // abre directamente la ficha de ese producto
  const [productos, setProductos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [almacenes, setAlmacenes] = useState([])
  const [stockTotales, setStockTotales] = useState({}) // producto_id -> total
  const [disponibilidadKits, setDisponibilidadKits] = useState({}) // kit_id -> total disponible (suma de almacenes)
  const [busqueda, setBusqueda] = useState('')
  const [filtroTipo, setFiltroTipo] = useState(filtroInicial === 'kit' || filtroInicial === 'simple' ? filtroInicial : 'todos') // todos | simple | kit
  const [filtroCategoria, setFiltroCategoria] = useState('todas')
  const [soloStockBajo, setSoloStockBajo] = useState(filtroInicial === 'stock_bajo')
  const [soloSinStock, setSoloSinStock] = useState(filtroInicial === 'sin_stock')
  const [soloConStock, setSoloConStock] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [modalAbierto, setModalAbierto] = useState(false)
  const [productoEditar, setProductoEditar] = useState(null)
  const [productoDetalle, setProductoDetalle] = useState(null)
  const [pagina, setPagina] = useState(1)

  async function cargar() {
    setCargando(true)
    const [{ data: prods, error: e1 }, { data: cats }, { data: totales }, { data: kitsDisp }, { data: alms }] = await Promise.all([
      supabase.from('productos').select('*').eq('activo', true).order('nombre'),
      supabase.from('categorias').select('*').order('nombre'),
      supabase.from('stock_total_producto').select('*'),
      supabase.from('kits_disponibilidad').select('*'),
      supabase.from('almacenes').select('id, nombre').eq('activo', true).order('nombre'),
    ])
    if (e1) setError(e1.message)
    setProductos(prods ?? [])
    setCategorias(cats ?? [])
    setAlmacenes(alms ?? [])
    if (productoInicial) {
      const p = (prods ?? []).find((x) => x.id === productoInicial)
      if (p) setProductoDetalle(p)
      // Se quita de la URL para que no se vuelva a abrir al recargar la lista
      setParametros((actuales) => { actuales.delete('ver'); return actuales }, { replace: true })
    }

    const mapaTotales = {}
    ;(totales ?? []).forEach((t) => { mapaTotales[t.producto_id] = t.stock_total })
    setStockTotales(mapaTotales)

    // Sumamos la disponibilidad de todos los almacenes por kit
    const mapaKits = {}
    ;(kitsDisp ?? []).forEach((k) => {
      mapaKits[k.kit_id] = (mapaKits[k.kit_id] ?? 0) + k.disponible
    })
    setDisponibilidadKits(mapaKits)

    setCargando(false)
  }

  useEffect(() => { cargar() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function desactivar(id) {
    if (!confirm('¿Desactivar este producto? No se borrará el historial, solo dejará de aparecer en la lista.')) return
    const { error } = await supabase.from('productos').update({ activo: false }).eq('id', id)
    if (error) { setError(error.message); return }
    cargar()
  }

  function abrirNuevo() {
    setProductoEditar(null)
    setModalAbierto(true)
  }
  function abrirEditar(p) {
    setProductoEditar(p)
    setModalAbierto(true)
  }
  function cerrarModal() {
    setModalAbierto(false)
    setProductoEditar(null)
  }
  function guardado() {
    cerrarModal()
    cargar()
  }

  const productosSimples = productos.filter((p) => p.tipo === 'simple')

  const filtrados = productos.filter((p) => {
    const coincideTexto =
      p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      (p.sku ?? '').toLowerCase().includes(busqueda.toLowerCase())
    const coincideTipo = filtroTipo === 'todos' || p.tipo === filtroTipo
    const coincideCategoria = filtroCategoria === 'todas' || p.categoria_id === filtroCategoria

    const esKit = p.tipo === 'kit'
    const stock = esKit ? (disponibilidadKits[p.id] ?? 0) : (stockTotales[p.id] ?? 0)
    const sinStock = stock <= 0
    const stockBajo = !sinStock && stock <= p.stock_minimo
    const coincideStockBajo = !soloStockBajo || stockBajo
    const coincideSinStock = !soloSinStock || sinStock
    const coincideConStock = !soloConStock || stock > 0

    return coincideTexto && coincideTipo && coincideCategoria && coincideStockBajo && coincideSinStock && coincideConStock
  })

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA))
  const paginados = filtrados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA)

  function actualizarBusqueda(v) { setBusqueda(v); setPagina(1) }
  function actualizarFiltroTipo(v) { setFiltroTipo(v); setPagina(1) }
  function actualizarFiltroCategoria(v) { setFiltroCategoria(v); setPagina(1) }
  function alternarStockBajo() { setSoloStockBajo((v) => !v); setPagina(1) }
  function alternarSinStock() { setSoloSinStock((v) => !v); setPagina(1) }
  function alternarConStock() { setSoloConStock((v) => !v); setPagina(1) }

  // La descarga respeta los filtros de pantalla y opcionalmente se limita a un almacén
  function modeloDescarga(almacen) {
    const descripcion = [
      almacen ? `Almacén: ${almacen.nombre}` : 'Todos los almacenes',
      filtroTipo !== 'todos' && (filtroTipo === 'kit' ? 'Solo kits' : 'Solo simples'),
      filtroCategoria !== 'todas' && `Categoría: ${categorias.find((c) => c.id === filtroCategoria)?.nombre ?? ''}`,
      soloStockBajo && 'Solo stock bajo',
      soloSinStock && 'Solo sin stock',
      soloConStock && 'Solo con stock',
      busqueda && `Búsqueda: "${busqueda}"`,
      `${filtrados.length} de ${productos.length} productos`,
    ].filter(Boolean).join(' · ')
    return modeloInventario({ productos: filtrados, categorias, almacenes, almacen, filtros: descripcion })
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-6 gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-ink mb-1">Productos</h2>
          <p className="text-sm text-ink-muted">
            {filtrados.length === productos.length
              ? `${productos.length} productos activos`
              : `${filtrados.length} encontrados de ${productos.length} productos activos`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <BotonDescarga
            opciones={opcionesDescarga([
              { etiqueta: 'Todos los almacenes', modelo: () => modeloDescarga(null) },
              ...almacenes.map((a) => ({ etiqueta: `Solo ${a.nombre}`, modelo: () => modeloDescarga(a) })),
            ], perfil?.nombre)}
          />
          <button
            onClick={abrirNuevo}
            className="bg-ink text-white px-4 py-2.5 rounded-md text-sm font-medium hover:bg-ink/90 transition whitespace-nowrap"
          >
            + Nuevo producto
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <input
          value={busqueda}
          onChange={(e) => actualizarBusqueda(e.target.value)}
          placeholder="Buscar por nombre o SKU..."
          className="flex-1 rounded-md border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/40 focus:border-signal"
        />
        <div className="flex rounded-md bg-stone-100 p-1 w-fit">
          {['todos', 'simple', 'kit'].map((t) => (
            <button
              key={t}
              onClick={() => actualizarFiltroTipo(t)}
              className={`px-3 py-1.5 text-xs font-medium rounded capitalize transition ${filtroTipo === t ? 'bg-white shadow-sm text-ink' : 'text-ink-muted'}`}
            >
              {t === 'todos' ? 'Todos' : t === 'simple' ? 'Simples' : 'Kits'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-5">
        <select
          value={filtroCategoria}
          onChange={(e) => actualizarFiltroCategoria(e.target.value)}
          className="rounded-md border border-line px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-signal/40 focus:border-signal"
        >
          <option value="todas">Todas las categorías</option>
          {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>

        <button
          onClick={alternarStockBajo}
          className={`px-3 py-1.5 rounded-md text-xs font-medium border transition ${
            soloStockBajo ? 'bg-signal/10 border-signal/30 text-signal' : 'border-line text-ink-muted hover:bg-stone-100'
          }`}
        >
          Solo stock bajo
        </button>

        <button
          onClick={alternarSinStock}
          className={`px-3 py-1.5 rounded-md text-xs font-medium border transition ${
            soloSinStock ? 'bg-danger/10 border-danger/30 text-danger' : 'border-line text-ink-muted hover:bg-stone-100'
          }`}
        >
          Solo sin stock
        </button>

        <button
          onClick={alternarConStock}
          className={`px-3 py-1.5 rounded-md text-xs font-medium border transition ${
            soloConStock ? 'bg-success/10 border-success/30 text-success' : 'border-line text-ink-muted hover:bg-stone-100'
          }`}
        >
          Solo con stock
        </button>

        {(filtroCategoria !== 'todas' || soloStockBajo || soloSinStock || soloConStock) && (
          <button
            onClick={() => { setFiltroCategoria('todas'); setSoloStockBajo(false); setSoloSinStock(false); setSoloConStock(false); setPagina(1) }}
            className="text-xs font-medium text-signal hover:underline"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {error && <p className="text-sm text-danger mb-4">{error}</p>}

      {cargando ? (
        <p className="text-sm text-ink-muted">Cargando...</p>
      ) : filtrados.length === 0 ? (
        <p className="text-sm text-ink-muted">No se encontraron productos.</p>
      ) : (
        <div className="bg-white border border-line rounded-lg overflow-hidden">
          <div className="divide-y divide-line">
            {paginados.map((p) => {
              const esKit = p.tipo === 'kit'
              const stock = esKit ? (disponibilidadKits[p.id] ?? 0) : (stockTotales[p.id] ?? 0)
              const sinStock = stock <= 0
              const stockBajo = !sinStock && stock <= p.stock_minimo
              const cat = categorias.find((c) => c.id === p.categoria_id)

              return (
                <button
                  key={p.id}
                  onClick={() => setProductoDetalle(p)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-stone-100/60 transition"
                >
                  {p.foto_url ? (
                    <img src={p.foto_url} alt="" className="w-10 h-10 rounded-md object-cover border border-line shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-md bg-stone-100 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-ink truncate">{p.nombre}</span>
                      {esKit && (
                        <span className="text-[10px] font-mono uppercase tracking-wide bg-stone-100 text-ink-muted px-1.5 py-0.5 rounded">
                          kit
                        </span>
                      )}
                      {sinStock && (
                        <span className="text-[10px] font-mono uppercase tracking-wide bg-danger/10 text-danger px-1.5 py-0.5 rounded">
                          sin stock
                        </span>
                      )}
                      {stockBajo && (
                        <span className="text-[10px] font-mono uppercase tracking-wide bg-signal/10 text-signal px-1.5 py-0.5 rounded">
                          stock bajo
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-ink-muted mt-0.5">
                      {p.sku && <span className="font-mono">{p.sku}</span>}
                      {p.sku && cat && ' · '}
                      {cat?.nombre}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <p className={`font-mono text-sm font-medium ${sinStock ? 'text-danger' : stockBajo ? 'text-signal' : 'text-ink'}`}>
                        {stock} <span className="text-ink-muted font-sans">{p.unidad}</span>
                      </p>
                      <p className="text-[10px] text-ink-muted">{esKit ? 'disponibles' : 'en todos los almacenes'}</p>
                    </div>
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => abrirEditar(p)} className="text-xs font-medium text-ink-muted hover:text-ink px-2 py-1">
                        Editar
                      </button>
                      <button onClick={() => desactivar(p.id)} className="text-xs font-medium text-danger hover:underline px-2 py-1">
                        Quitar
                      </button>
                    </div>
                  </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <Paginador pagina={pagina} totalPaginas={totalPaginas} onCambiar={setPagina} />

      {modalAbierto && (
        <ProductoForm
          producto={productoEditar}
          categorias={categorias}
          productosSimples={productosSimples}
          onClose={cerrarModal}
          onSaved={guardado}
        />
      )}

      {productoDetalle && (
        <ProductoDetalle
          producto={productoDetalle}
          categorias={categorias}
          onClose={() => setProductoDetalle(null)}
        />
      )}
    </div>
  )
}