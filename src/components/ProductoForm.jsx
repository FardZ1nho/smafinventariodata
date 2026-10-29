import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { subirFotoProducto } from '../lib/imagenes'
import SelectorProducto from './SelectorProducto'

export default function ProductoForm({ producto, categorias, productosSimples, onClose, onSaved }) {
  const esEdicion = !!producto
  const [form, setForm] = useState({
    nombre: producto?.nombre ?? '',
    sku: producto?.sku ?? '',
    categoria_id: producto?.categoria_id ?? '',
    precio_compra: producto?.precio_compra ?? '',
    precio_venta: producto?.precio_venta ?? '',
    stock_minimo: producto?.stock_minimo ?? 0,
    unidad: producto?.unidad ?? 'unidad',
    tipo: producto?.tipo ?? 'simple',
    foto_url: producto?.foto_url ?? '',
  })
  const [componentes, setComponentes] = useState([]) // [{componente_id, cantidad}]
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [subiendoFoto, setSubiendoFoto] = useState(false)

  useEffect(() => {
    if (esEdicion && producto.tipo === 'kit') {
      supabase
        .from('producto_componentes')
        .select('componente_id, cantidad')
        .eq('kit_id', producto.id)
        .then(({ data }) => setComponentes(data ?? []))
    }
  }, [producto, esEdicion])

  function actualizar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  async function manejarSeleccionFoto(e) {
    const archivo = e.target.files?.[0]
    if (!archivo) return
    setError('')
    setSubiendoFoto(true)
    try {
      const url = await subirFotoProducto(supabase, archivo)
      actualizar('foto_url', url)
    } catch (err) {
      setError('No se pudo subir la foto: ' + err.message)
    }
    setSubiendoFoto(false)
    e.target.value = '' // permite volver a elegir el mismo archivo si quiere reintentar
  }

  function quitarFoto() {
    actualizar('foto_url', '')
  }

  function agregarComponente() {
    setComponentes((c) => [...c, { componente_id: '', cantidad: 1 }])
  }
  function actualizarComponente(i, campo, valor) {
    setComponentes((c) => c.map((item, idx) => (idx === i ? { ...item, [campo]: valor } : item)))
  }
  function quitarComponente(i) {
    setComponentes((c) => c.filter((_, idx) => idx !== i))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!form.nombre.trim()) { setError('El nombre es obligatorio.'); return }
    if (form.tipo === 'kit' && componentes.some((c) => !c.componente_id)) {
      setError('Selecciona un producto para cada componente del kit.')
      return
    }

    setGuardando(true)

    const payload = {
      nombre: form.nombre.trim(),
      sku: form.sku.trim() || null,
      categoria_id: form.categoria_id || null,
      precio_compra: form.precio_compra === '' ? 0 : Number(form.precio_compra),
      precio_venta: form.precio_venta === '' ? 0 : Number(form.precio_venta),
      stock_minimo: Number(form.stock_minimo) || 0,
      unidad: form.unidad.trim() || 'unidad',
      tipo: form.tipo,
      foto_url: form.foto_url || null,
    }

    let productoId = producto?.id

    if (esEdicion) {
      const { error } = await supabase.from('productos').update(payload).eq('id', productoId)
      if (error) { setError(error.message); setGuardando(false); return }
    } else {
      // Un producto kit siempre nace con stock 0 (no tiene stock propio)
      const { data, error } = await supabase
        .from('productos')
        .insert(payload)
        .select()
        .single()
      if (error) { setError(error.message); setGuardando(false); return }
      productoId = data.id
    }

    if (form.tipo === 'kit') {
      // Reemplazar la receta completa: borrar la anterior y meter la nueva
      await supabase.from('producto_componentes').delete().eq('kit_id', productoId)
      const filas = componentes
        .filter((c) => c.componente_id)
        .map((c) => ({ kit_id: productoId, componente_id: c.componente_id, cantidad: Number(c.cantidad) || 1 }))
      if (filas.length > 0) {
        const { error } = await supabase.from('producto_componentes').insert(filas)
        if (error) { setError(error.message); setGuardando(false); return }
      }
    }

    setGuardando(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-0 md:p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="producto-form-titulo" className="bg-white w-full md:max-w-lg md:rounded-lg rounded-t-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-line flex items-center justify-between sticky top-0 bg-white">
          <h3 id="producto-form-titulo" className="font-semibold text-ink">{esEdicion ? 'Editar producto' : 'Nuevo producto'}</h3>
          <button onClick={onClose} aria-label="Cerrar" className="text-ink-muted hover:text-ink text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Tipo de producto */}
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">Tipo de producto</label>
            <div className="flex rounded-md bg-stone-100 p-1">
              <button
                type="button"
                onClick={() => actualizar('tipo', 'simple')}
                className={`flex-1 py-2 text-sm font-medium rounded transition ${form.tipo === 'simple' ? 'bg-white shadow-sm text-ink' : 'text-ink-muted'}`}
              >
                Simple
              </button>
              <button
                type="button"
                onClick={() => actualizar('tipo', 'kit')}
                className={`flex-1 py-2 text-sm font-medium rounded transition ${form.tipo === 'kit' ? 'bg-white shadow-sm text-ink' : 'text-ink-muted'}`}
              >
                Kit (armado de piezas)
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="pf-nombre" className="block text-sm font-medium text-ink mb-1.5">Nombre</label>
            <input
              id="pf-nombre"
              value={form.nombre}
              onChange={(e) => actualizar('nombre', e.target.value)}
              className="w-full rounded-md border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/40 focus:border-signal"
              placeholder="Bull Float 1.20m"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">Foto (opcional)</label>
            <div className="flex items-center gap-3">
              {form.foto_url ? (
                <img src={form.foto_url} alt="" className="w-16 h-16 rounded-md object-cover border border-line" />
              ) : (
                <div className="w-16 h-16 rounded-md border border-dashed border-line flex items-center justify-center text-ink-muted text-xs">
                  Sin foto
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <label className="inline-flex items-center justify-center px-3 py-1.5 rounded-md border border-line text-xs font-medium text-ink cursor-pointer hover:bg-stone-100 transition w-fit">
                  {subiendoFoto ? 'Subiendo...' : form.foto_url ? 'Cambiar foto' : 'Elegir foto'}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={manejarSeleccionFoto}
                    disabled={subiendoFoto}
                    className="hidden"
                  />
                </label>
                {form.foto_url && !subiendoFoto && (
                  <button type="button" onClick={quitarFoto} className="text-xs font-medium text-danger hover:underline text-left">
                    Quitar foto
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="pf-sku" className="block text-sm font-medium text-ink mb-1.5">SKU / código</label>
              <input
                id="pf-sku"
                value={form.sku}
                onChange={(e) => actualizar('sku', e.target.value)}
                className="w-full rounded-md border border-line px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-signal/40 focus:border-signal"
                placeholder="BF-120"
              />
            </div>
            <div>
              <label htmlFor="pf-categoria" className="block text-sm font-medium text-ink mb-1.5">Categoría</label>
              <select
                id="pf-categoria"
                value={form.categoria_id}
                onChange={(e) => actualizar('categoria_id', e.target.value)}
                className="w-full rounded-md border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/40 focus:border-signal"
              >
                <option value="">Sin categoría</option>
                {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="pf-precio-compra" className="block text-sm font-medium text-ink mb-1.5">Precio compra</label>
              <input
                type="number" step="0.01" min="0"
                id="pf-precio-compra"
                value={form.precio_compra}
                onChange={(e) => actualizar('precio_compra', e.target.value)}
                className="w-full rounded-md border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/40 focus:border-signal"
              />
            </div>
            <div>
              <label htmlFor="pf-precio-venta" className="block text-sm font-medium text-ink mb-1.5">Precio venta</label>
              <input
                type="number" step="0.01" min="0"
                id="pf-precio-venta"
                value={form.precio_venta}
                onChange={(e) => actualizar('precio_venta', e.target.value)}
                className="w-full rounded-md border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/40 focus:border-signal"
              />
            </div>
            <div>
              <label htmlFor="pf-unidad" className="block text-sm font-medium text-ink mb-1.5">Unidad</label>
              <input
                id="pf-unidad"
                value={form.unidad}
                onChange={(e) => actualizar('unidad', e.target.value)}
                className="w-full rounded-md border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/40 focus:border-signal"
              />
            </div>
          </div>

          <div>
            <label htmlFor="pf-stock-minimo" className="block text-sm font-medium text-ink mb-1.5">Stock mínimo (alerta, sumando todos los almacenes)</label>
            <input
              type="number" min="0"
              id="pf-stock-minimo"
              value={form.stock_minimo}
              onChange={(e) => actualizar('stock_minimo', e.target.value)}
              className="w-full rounded-md border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/40 focus:border-signal"
            />
          </div>

          {form.tipo === 'simple' && !esEdicion && (
            <p className="text-xs text-ink-muted -mt-2">
              El stock inicial se agrega después, desde <strong>Movimientos → Entrada</strong>, eligiendo el almacén.
            </p>
          )}

          {/* Receta del kit */}
          {form.tipo === 'kit' && (
            <div className="border-t border-line pt-4">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-ink">Componentes del kit</label>
                <button type="button" onClick={agregarComponente} className="text-xs font-medium text-signal hover:underline">
                  + Agregar pieza
                </button>
              </div>
              <p className="text-xs text-ink-muted mb-3">
                Un kit no tiene stock propio: se calcula según el stock disponible de sus piezas.
              </p>

              {componentes.length === 0 && (
                <p className="text-sm text-ink-muted italic mb-2">Aún no agregaste piezas.</p>
              )}

              <div className="space-y-2">
                {componentes.map((comp, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <div className="flex-1">
                      <SelectorProducto
                        productos={productosSimples.filter((p) => !producto || p.id !== producto.id)}
                        value={comp.componente_id}
                        onChange={(id) => actualizarComponente(i, 'componente_id', id)}
                        placeholder="Busca la pieza..."
                      />
                    </div>
                    <input
                      type="number" min="1"
                      aria-label="Cantidad de la pieza"
                      value={comp.cantidad}
                      onChange={(e) => actualizarComponente(i, 'cantidad', e.target.value)}
                      className="w-16 rounded-md border border-line px-2 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-signal/40 focus:border-signal"
                    />
                    <button type="button" onClick={() => quitarComponente(i)} aria-label="Quitar pieza" className="text-danger text-lg leading-none px-1">×</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-line rounded-md py-2.5 text-sm font-medium text-ink hover:bg-stone-100 transition">
              Cancelar
            </button>
            <button type="submit" disabled={guardando} className="flex-1 bg-ink text-white rounded-md py-2.5 text-sm font-medium hover:bg-ink/90 transition disabled:opacity-50">
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}