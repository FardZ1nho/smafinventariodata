import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import MovimientoDetalle from '../components/MovimientoDetalle'
import SelectorProducto from '../components/SelectorProducto'
import Paginador from '../components/Paginador'
import BotonDescarga from '../components/BotonDescarga'
import { modeloMovimientos, opcionesDescarga } from '../lib/reportes'
import { fechaCorta } from '../lib/pdf'

const SELECT_MOVIMIENTO = '*, productos(nombre, unidad, tipo, sku), almacenes:almacen_id(nombre), origen:almacen_origen_id(nombre), destino:almacen_destino_id(nombre), importaciones(codigo)'
const POR_PAGINA = 15

export default function Movimientos() {
  const { user, perfil, esAdmin } = useAuth()
  const [movimientos, setMovimientos] = useState([])
  const [totalMovimientos, setTotalMovimientos] = useState(0)
  const [productos, setProductos] = useState([])
  const [almacenes, setAlmacenes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [movimientoDetalle, setMovimientoDetalle] = useState(null)

  // Filtros del historial
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [filtroProducto, setFiltroProducto] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [pagina, setPagina] = useState(1)

  const [form, setForm] = useState({
    producto_id: '',
    tipo: 'salida', // entrada | salida | transferencia
    cantidad: 1,
    almacen_id: '',
    almacen_origen_id: '',
    almacen_destino_id: '',
    en_transito: false,
    codigo_importacion: '',
    proveedor_importacion: '',
    fecha_llegada_estimada: '',
    motivo: '',
    numero_comprobante: '',
    nota: '',
  })
  const [guardando, setGuardando] = useState(false)
  const [stockProducto, setStockProducto] = useState({}) // almacen_id -> cantidad disponible
  const [importacionesExistentes, setImportacionesExistentes] = useState([]) // para autocompletar código

  async function cargarListasBase() {
    const [{ data: prods }, { data: alms }, { data: imps }] = await Promise.all([
      supabase.from('productos').select('id, nombre, tipo, unidad, sku').eq('activo', true).order('nombre'),
      supabase.from('almacenes').select('id, nombre').eq('activo', true).order('nombre'),
      supabase.from('importaciones').select('id, codigo, proveedor, fecha_llegada_estimada').order('created_at', { ascending: false }),
    ])
    setProductos(prods ?? [])
    setAlmacenes(alms ?? [])
    setImportacionesExistentes(imps ?? [])
  }

  // Consulta del historial con los filtros actuales. La usan la lista paginada y el PDF.
  function consultaHistorial(opciones) {
    let query = supabase
      .from('movimientos')
      .select(SELECT_MOVIMIENTO, opciones)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })

    if (filtroTipo !== 'todos') query = query.eq('tipo', filtroTipo)
    if (filtroProducto) query = query.eq('producto_id', filtroProducto)
    // Las fechas del filtro son días en hora local (Lima); se convierten a instantes UTC
    if (fechaDesde) query = query.gte('created_at', new Date(`${fechaDesde}T00:00:00`).toISOString())
    if (fechaHasta) {
      const diaSiguiente = new Date(`${fechaHasta}T00:00:00`)
      diaSiguiente.setDate(diaSiguiente.getDate() + 1)
      query = query.lt('created_at', diaSiguiente.toISOString())
    }
    return query
  }

  async function cargarMovimientos() {
    setCargando(true)
    const desde = (pagina - 1) * POR_PAGINA
    const { data, error, count } = await consultaHistorial({ count: 'exact' }).range(desde, desde + POR_PAGINA - 1)
    if (error) setError(error.message)
    setMovimientos(data ?? [])
    setTotalMovimientos(count ?? 0)
    setCargando(false)
  }

  useEffect(() => { cargarListasBase() }, [])
  useEffect(() => { cargarMovimientos() }, [filtroTipo, filtroProducto, fechaDesde, fechaHasta, pagina]) // eslint-disable-line react-hooks/exhaustive-deps

  function actualizarFiltro(setter, valor) {
    setter(valor)
    setPagina(1)
  }
  function limpiarFiltros() {
    setFiltroTipo('todos')
    setFiltroProducto('')
    setFechaDesde('')
    setFechaHasta('')
    setPagina(1)
  }

  const productoSeleccionado = productos.find((p) => p.id === form.producto_id)
  const esKit = productoSeleccionado?.tipo === 'kit'

  const importacionCoincidente = importacionesExistentes.find(
    (i) => i.codigo.trim().toLowerCase() === form.codigo_importacion.trim().toLowerCase()
  )

  // Carga el stock disponible del producto elegido, por almacén
  // (para productos simples: stock real / para kits: cuántos se pueden armar)
  useEffect(() => {
    async function cargarStock() {
      if (!form.producto_id) { setStockProducto({}); return }
      if (esKit) {
        const { data } = await supabase.from('kits_disponibilidad').select('almacen_id, disponible').eq('kit_id', form.producto_id)
        const mapa = {}
        ;(data ?? []).forEach((d) => { mapa[d.almacen_id] = d.disponible })
        setStockProducto(mapa)
      } else {
        const { data } = await supabase.from('stock_almacen').select('almacen_id, cantidad').eq('producto_id', form.producto_id)
        const mapa = {}
        ;(data ?? []).forEach((s) => { mapa[s.almacen_id] = s.cantidad })
        setStockProducto(mapa)
      }
    }
    cargarStock()
  }, [form.producto_id, esKit])

  function actualizar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  function disponibleEn(almacenId) {
    if (!almacenId) return null
    return stockProducto[almacenId] ?? 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setOk('')

    if (!form.producto_id) { setError('Selecciona un producto.'); return }
    if (esKit && form.tipo === 'entrada') { setError('Los kits no reciben entradas directas.'); return }
    if (esKit && form.tipo === 'transferencia') { setError('Los kits no se transfieren; transfiere sus piezas por separado.'); return }

    if (form.tipo === 'transferencia') {
      if (!form.almacen_origen_id || !form.almacen_destino_id) { setError('Selecciona almacén de origen y de destino.'); return }
      if (form.almacen_origen_id === form.almacen_destino_id) { setError('El almacén de origen y destino deben ser distintos.'); return }
      const disponible = disponibleEn(form.almacen_origen_id)
      if (Number(form.cantidad) > disponible) {
        setError(`Solo hay ${disponible} ${productoSeleccionado?.unidad ?? ''} disponibles en el almacén de origen.`)
        return
      }
    } else {
      if (!form.almacen_id) { setError('Selecciona un almacén.'); return }
      if (form.tipo === 'salida') {
        const disponible = disponibleEn(form.almacen_id)
        if (Number(form.cantidad) > disponible) {
          setError(esKit
            ? `Solo se pueden armar ${disponible} kits con el stock de ese almacén.`
            : `Solo hay ${disponible} ${productoSeleccionado?.unidad ?? ''} disponibles en ese almacén.`)
          return
        }
      }
    }

    if (form.tipo === 'entrada' && form.en_transito) {
      if (!form.codigo_importacion.trim()) { setError('Indica el código de importación.'); return }
      if (!importacionCoincidente && !form.fecha_llegada_estimada) {
        setError('Es un código de importación nuevo: indica la fecha estimada de llegada.')
        return
      }
    }

    setGuardando(true)

    let importacionId = importacionCoincidente?.id ?? null
    let fechaLlegada = importacionCoincidente?.fecha_llegada_estimada ?? form.fecha_llegada_estimada

    // Si el código es nuevo, primero creamos la importación
    if (form.tipo === 'entrada' && form.en_transito && !importacionCoincidente) {
      const { data: nuevaImportacion, error: errorImportacion } = await supabase
        .from('importaciones')
        .insert({
          codigo: form.codigo_importacion.trim(),
          proveedor: form.proveedor_importacion.trim() || null,
          fecha_llegada_estimada: form.fecha_llegada_estimada,
          usuario_id: user.id,
        })
        .select()
        .single()

      if (errorImportacion) {
        setError(errorImportacion.message.includes('duplicate') ? 'Ya existe una importación con ese código.' : errorImportacion.message)
        setGuardando(false)
        return
      }
      importacionId = nuevaImportacion.id
      fechaLlegada = nuevaImportacion.fecha_llegada_estimada
    }

    const payload = {
      producto_id: form.producto_id,
      tipo: form.tipo,
      cantidad: Number(form.cantidad),
      motivo: form.motivo.trim() || null,
      numero_comprobante: form.numero_comprobante.trim() || null,
      nota: form.nota.trim() || null,
      usuario_id: user.id,
    }

    if (form.tipo === 'transferencia') {
      payload.almacen_origen_id = form.almacen_origen_id
      payload.almacen_destino_id = form.almacen_destino_id
    } else {
      payload.almacen_id = form.almacen_id
      if (form.tipo === 'entrada') {
        payload.estado = form.en_transito ? 'en_transito' : 'confirmado'
        if (form.en_transito) {
          payload.fecha_llegada_estimada = fechaLlegada
          payload.importacion_id = importacionId
        }
      }
    }

    const { error } = await supabase.from('movimientos').insert(payload)

    if (error) {
      setError(error.message.includes('STOCK_INSUFICIENTE') ? 'No se pudo registrar: no hay suficiente stock en ese almacén.' : error.message)
    } else {
      setOk('Movimiento registrado.')
      setForm({ producto_id: '', tipo: 'salida', cantidad: 1, almacen_id: '', almacen_origen_id: '', almacen_destino_id: '', en_transito: false, codigo_importacion: '', proveedor_importacion: '', fecha_llegada_estimada: '', motivo: '', numero_comprobante: '', nota: '' })
      cargarListasBase()
      cargarMovimientos()
    }
    setGuardando(false)
  }

  async function confirmarLlegada(id, cantidadRecibida) {
    // Solo si sigue en tránsito: evita cambiar la cantidad de algo ya recibido (doble clic, dos usuarios)
    const { error } = await supabase
      .from('movimientos')
      .update({ estado: 'confirmado', cantidad: cantidadRecibida })
      .eq('id', id)
      .eq('estado', 'en_transito')
      .is('anulado_at', null)
    if (error) return traducirError(error.message)
    setMovimientoDetalle(null)
    cargarMovimientos()
    cargarListasBase()
  }

  async function anularMovimiento(id, motivo) {
    const { error } = await supabase.rpc('anular_movimiento', { p_movimiento_id: id, p_motivo: motivo })
    if (error) return traducirError(error.message)
    setMovimientoDetalle(null)
    cargarMovimientos()
    cargarListasBase()
  }

  // Los errores del servidor vienen como "CODIGO: mensaje"
  function traducirError(mensaje) {
    if (mensaje.includes('STOCK_INSUFICIENTE')) {
      return 'No se puede: el stock de ese almacén quedaría negativo (por ejemplo, las unidades ya salieron).'
    }
    const separador = mensaje.indexOf(': ')
    return /^[A-Z_]+:/.test(mensaje) ? mensaje.slice(separador + 2) : mensaje
  }

  const totalPaginas = Math.max(1, Math.ceil(totalMovimientos / POR_PAGINA))

  return (
    <div>
      <h2 className="text-2xl font-semibold text-ink mb-1">Movimientos</h2>
      <p className="text-sm text-ink-muted mb-6">Registra entradas, salidas y transferencias entre almacenes.</p>

      <div className="grid md:grid-cols-[380px_1fr] gap-6">
        {/* Formulario */}
        <div className="bg-white border border-line rounded-lg p-5 h-fit">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex rounded-md bg-stone-100 p-1">
              {['entrada', 'salida', 'transferencia'].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => actualizar('tipo', t)}
                  className={`flex-1 py-2 text-xs font-medium rounded capitalize transition ${
                    form.tipo === t
                      ? `bg-white shadow-sm ${t === 'entrada' ? 'text-success' : t === 'salida' ? 'text-danger' : 'text-signal'}`
                      : 'text-ink-muted'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">Producto</label>
              <SelectorProducto
                productos={productos}
                value={form.producto_id}
                onChange={(id) => actualizar('producto_id', id)}
                placeholder="Busca por nombre o SKU..."
              />
              {esKit && form.tipo === 'entrada' && <p className="text-xs text-danger mt-1.5">Los kits no reciben entradas directas.</p>}
              {esKit && form.tipo === 'transferencia' && <p className="text-xs text-danger mt-1.5">Los kits no se transfieren directamente.</p>}
              {esKit && form.tipo === 'salida' && <p className="text-xs text-ink-muted mt-1.5">Se descontará el stock de cada pieza, en el almacén elegido.</p>}
            </div>

            {form.tipo === 'transferencia' ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-ink mb-1.5">Desde</label>
                  <select
                    value={form.almacen_origen_id}
                    onChange={(e) => {
                      const origen = e.target.value
                      // Origen y destino no pueden ser el mismo almacén
                      setForm((f) => ({ ...f, almacen_origen_id: origen, almacen_destino_id: f.almacen_destino_id === origen ? '' : f.almacen_destino_id }))
                    }}
                    className="w-full rounded-md border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/40 focus:border-signal"
                  >
                    <option value="">Elige...</option>
                    {almacenes.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                  </select>
                  {form.producto_id && form.almacen_origen_id && (
                    <p className={`text-xs mt-1 ${disponibleEn(form.almacen_origen_id) === 0 ? 'text-danger' : 'text-ink-muted'}`}>
                      Disponible: {disponibleEn(form.almacen_origen_id)} {productoSeleccionado?.unidad}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink mb-1.5">Hacia</label>
                  <select
                    value={form.almacen_destino_id}
                    onChange={(e) => actualizar('almacen_destino_id', e.target.value)}
                    className="w-full rounded-md border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/40 focus:border-signal"
                  >
                    <option value="">Elige...</option>
                    {almacenes
                      .filter((a) => a.id !== form.almacen_origen_id)
                      .map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                  </select>
                  {form.producto_id && form.almacen_destino_id && (
                    <p className="text-xs mt-1 text-ink-muted">
                      Actualmente: {disponibleEn(form.almacen_destino_id)} {productoSeleccionado?.unidad}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-ink mb-1.5">Almacén</label>
                <select
                  value={form.almacen_id}
                  onChange={(e) => actualizar('almacen_id', e.target.value)}
                  className="w-full rounded-md border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/40 focus:border-signal"
                >
                  <option value="">Elige un almacén...</option>
                  {almacenes.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                </select>
                {form.tipo === 'salida' && form.producto_id && form.almacen_id && (
                  <p className={`text-xs mt-1 ${disponibleEn(form.almacen_id) === 0 ? 'text-danger' : 'text-ink-muted'}`}>
                    Disponible: {disponibleEn(form.almacen_id)} {productoSeleccionado?.unidad}
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">Cantidad</label>
              <input
                type="number" min="1"
                value={form.cantidad}
                onChange={(e) => actualizar('cantidad', e.target.value)}
                className="w-full rounded-md border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/40 focus:border-signal"
              />
            </div>

            {form.tipo === 'entrada' && !esKit && (
              <div className="space-y-3">
                <label className="flex items-center gap-2 bg-stone rounded-md px-3 py-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.en_transito}
                    onChange={(e) => actualizar('en_transito', e.target.checked)}
                    className="rounded border-line"
                  />
                  <span className="text-sm text-ink">Está en tránsito (importación en camino, aún no llega al almacén)</span>
                </label>

                {form.en_transito && (
                  <div className="space-y-3 border-l-2 border-signal/30 pl-3">
                    <div>
                      <label className="block text-sm font-medium text-ink mb-1.5">Código de importación</label>
                      <input
                        list="codigos-importacion"
                        value={form.codigo_importacion}
                        onChange={(e) => actualizar('codigo_importacion', e.target.value)}
                        placeholder="ej. IMP-2026-014"
                        className="w-full rounded-md border border-line px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-signal/40 focus:border-signal"
                      />
                      <datalist id="codigos-importacion">
                        {importacionesExistentes.map((i) => <option key={i.id} value={i.codigo} />)}
                      </datalist>
                      {importacionCoincidente ? (
                        <p className="text-xs text-success mt-1.5">
                          Importación existente{importacionCoincidente.proveedor && <> · {importacionCoincidente.proveedor}</>}
                          {importacionCoincidente.fecha_llegada_estimada && (
                            <> · llega {new Date(importacionCoincidente.fecha_llegada_estimada + 'T00:00:00').toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}</>
                          )}
                        </p>
                      ) : form.codigo_importacion.trim() ? (
                        <p className="text-xs text-ink-muted mt-1.5">Código nuevo: se creará una importación con estos datos.</p>
                      ) : null}
                    </div>

                    {!importacionCoincidente && form.codigo_importacion.trim() && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-ink mb-1.5">Proveedor (opcional)</label>
                          <input
                            value={form.proveedor_importacion}
                            onChange={(e) => actualizar('proveedor_importacion', e.target.value)}
                            className="w-full rounded-md border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/40 focus:border-signal"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-ink mb-1.5">Fecha estimada de llegada</label>
                          <input
                            type="date"
                            value={form.fecha_llegada_estimada}
                            onChange={(e) => actualizar('fecha_llegada_estimada', e.target.value)}
                            min={new Date().toISOString().split('T')[0]}
                            className="w-full rounded-md border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/40 focus:border-signal"
                          />
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-ink">Motivo</label>
                {form.tipo === 'salida' && (
                  <button
                    type="button"
                    onClick={() => actualizar('motivo', form.motivo.trim().toLowerCase() === 'venta' ? '' : 'Venta')}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium border transition ${
                      form.motivo.trim().toLowerCase() === 'venta'
                        ? 'bg-signal/10 border-signal/30 text-signal'
                        : 'border-line text-ink-muted hover:bg-stone-100'
                    }`}
                  >
                    Venta
                  </button>
                )}
              </div>
              <input
                value={form.motivo}
                onChange={(e) => actualizar('motivo', e.target.value)}
                placeholder={form.tipo === 'entrada' ? 'Compra a proveedor' : form.tipo === 'salida' ? 'Venta' : 'Reposición de stock'}
                className="w-full rounded-md border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/40 focus:border-signal"
              />
            </div>

            {form.tipo === 'salida' && form.motivo.trim().toLowerCase() === 'venta' && (
              <div>
                <label className="block text-sm font-medium text-ink mb-1.5">N° de factura o comprobante</label>
                <input
                  value={form.numero_comprobante}
                  onChange={(e) => actualizar('numero_comprobante', e.target.value)}
                  placeholder="ej. F001-00123"
                  className="w-full rounded-md border border-line px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-signal/40 focus:border-signal"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">Nota (opcional)</label>
              <textarea
                value={form.nota}
                onChange={(e) => actualizar('nota', e.target.value)}
                rows={2}
                className="w-full rounded-md border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/40 focus:border-signal resize-none"
              />
            </div>

            {error && <p className="text-sm text-danger">{error}</p>}
            {ok && <p className="text-sm text-success">{ok}</p>}

            <button
              type="submit"
              disabled={guardando}
              className="w-full bg-ink text-white rounded-md py-2.5 text-sm font-medium hover:bg-ink/90 transition disabled:opacity-50"
            >
              {guardando ? 'Registrando...' : 'Registrar movimiento'}
            </button>
          </form>
        </div>

        {/* Historial */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-ink-muted uppercase tracking-wide">Historial</h3>
            <div className="flex items-center gap-3">
              {(filtroTipo !== 'todos' || filtroProducto || fechaDesde || fechaHasta) && (
                <button onClick={limpiarFiltros} className="text-xs font-medium text-signal hover:underline">
                  Limpiar filtros
                </button>
              )}
              <BotonDescarga
                opciones={opcionesDescarga([{
                  etiqueta: 'Historial de movimientos',
                  modelo: () => modeloMovimientos({
                    construirConsulta: () => consultaHistorial(),
                    filtros: [
                      filtroTipo === 'todos' ? 'Todos los tipos' : `Tipo: ${filtroTipo}`,
                      filtroProducto && `Producto: ${productos.find((p) => p.id === filtroProducto)?.nombre ?? ''}`,
                      fechaDesde && `Desde ${fechaCorta(fechaDesde)}`,
                      fechaHasta && `Hasta ${fechaCorta(fechaHasta)}`,
                      `${totalMovimientos} movimientos`,
                    ].filter(Boolean).join(' · '),
                  }),
                }], perfil?.nombre)}
              />
            </div>
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap gap-2 mb-4">
            <div className="w-full sm:w-64">
              <SelectorProducto
                productos={productos}
                value={filtroProducto}
                onChange={(id) => actualizarFiltro(setFiltroProducto, id)}
                placeholder="Buscar movimientos de un producto..."
              />
            </div>
            <div className="flex rounded-md bg-stone-100 p-1">
              {['todos', 'entrada', 'salida', 'transferencia'].map((t) => (
                <button
                  key={t}
                  onClick={() => actualizarFiltro(setFiltroTipo, t)}
                  className={`px-3 py-1.5 text-xs font-medium rounded capitalize transition ${filtroTipo === t ? 'bg-white shadow-sm text-ink' : 'text-ink-muted'}`}
                >
                  {t}
                </button>
              ))}
            </div>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => actualizarFiltro(setFechaDesde, e.target.value)}
              className="rounded-md border border-line px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-signal/40 focus:border-signal"
              title="Desde"
            />
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => actualizarFiltro(setFechaHasta, e.target.value)}
              className="rounded-md border border-line px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-signal/40 focus:border-signal"
              title="Hasta"
            />
          </div>

          {cargando ? (
            <p className="text-sm text-ink-muted">Cargando...</p>
          ) : movimientos.length === 0 ? (
            <p className="text-sm text-ink-muted">No hay movimientos con esos filtros.</p>
          ) : (
            <>
              <div className="bg-white border border-line rounded-lg divide-y divide-line">
                {movimientos.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMovimientoDetalle(m)}
                    className={`w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-stone-100/60 transition ${m.anulado_at ? 'opacity-60' : ''}`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`text-sm font-medium text-ink truncate ${m.anulado_at ? 'line-through' : ''}`}>{m.productos?.nombre ?? 'Producto eliminado'}</p>
                        {m.anulado_at && (
                          <span className="text-[10px] font-mono uppercase tracking-wide bg-danger/10 text-danger px-1.5 py-0.5 rounded">anulado</span>
                        )}
                        {!m.anulado_at && m.estado === 'en_transito' && (
                          <span className="text-[10px] font-mono uppercase tracking-wide bg-signal/10 text-signal px-1.5 py-0.5 rounded">tránsito</span>
                        )}
                      </div>
                      <p className="text-xs text-ink-muted">
                        {m.tipo === 'transferencia'
                          ? `${m.origen?.nombre ?? '?'} → ${m.destino?.nombre ?? '?'}`
                          : m.almacenes?.nombre ?? '—'}
                        {m.motivo && <> · {m.motivo}</>}
                        {m.numero_comprobante && <> · <span className="font-mono">{m.numero_comprobante}</span></>}
                        {m.importaciones?.codigo && <> · <span className="font-mono">{m.importaciones.codigo}</span></>}
                        {m.estado === 'en_transito' && m.fecha_llegada_estimada && (
                          <> · llega {new Date(m.fecha_llegada_estimada + 'T00:00:00').toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}</>
                        )}
                        {!(m.estado === 'en_transito' && m.fecha_llegada_estimada) && (
                          <> · {new Date(m.created_at).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}</>
                        )}
                      </p>
                    </div>
                    <span className={`font-mono text-sm font-medium shrink-0 ${
                      m.tipo === 'entrada' ? 'text-success' : m.tipo === 'salida' ? 'text-danger' : 'text-ink'
                    }`}>
                      {m.tipo === 'entrada' ? '+' : m.tipo === 'salida' ? '-' : '⇄'}{m.cantidad}
                    </span>
                  </button>
                ))}
              </div>
              <Paginador pagina={pagina} totalPaginas={totalPaginas} onCambiar={setPagina} />
            </>
          )}
        </div>
      </div>

      {movimientoDetalle && (
        <MovimientoDetalle
          movimiento={movimientoDetalle}
          onClose={() => setMovimientoDetalle(null)}
          onConfirmarLlegada={confirmarLlegada}
          onAnular={esAdmin ? anularMovimiento : null}
        />
      )}
    </div>
  )
}