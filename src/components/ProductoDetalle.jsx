import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { modeloProducto, opcionesDescarga } from '../lib/reportes'
import { useAuth } from '../context/AuthContext'
import BotonDescarga from './BotonDescarga'

export default function ProductoDetalle({ producto, categorias, onClose }) {
  const { perfil } = useAuth()
  const [stockPorAlmacen, setStockPorAlmacen] = useState([])
  const [disponibilidadKit, setDisponibilidadKit] = useState([])
  const [componentes, setComponentes] = useState([])
  const [movimientos, setMovimientos] = useState([])
  const [cargando, setCargando] = useState(true)

  const esKit = producto.tipo === 'kit'
  const categoria = categorias.find((c) => c.id === producto.categoria_id)

  useEffect(() => {
    async function cargar() {
      setCargando(true)
      // Los almacenes eliminados quedan con activo = false. Se ocultan si no tienen stock;
      // si aún tienen, se muestran marcados como inactivos para no esconder existencias.
      if (esKit) {
        const [{ data: disp }, { data: comps }, { data: inactivos }] = await Promise.all([
          supabase.from('kits_disponibilidad').select('*').eq('kit_id', producto.id),
          supabase.from('producto_componentes').select('cantidad, productos:componente_id(nombre, unidad)').eq('kit_id', producto.id),
          supabase.from('almacenes').select('id').eq('activo', false),
        ])
        const idsInactivos = new Set((inactivos ?? []).map((a) => a.id))
        setDisponibilidadKit(
          (disp ?? [])
            .map((d) => ({ ...d, inactivo: idsInactivos.has(d.almacen_id) }))
            .filter((d) => !d.inactivo || d.disponible > 0)
        )
        setComponentes(comps ?? [])
      } else {
        const { data } = await supabase
          .from('stock_almacen')
          .select('cantidad, almacenes(id, nombre, activo)')
          .eq('producto_id', producto.id)
          .order('cantidad', { ascending: false })
        setStockPorAlmacen((data ?? []).filter((s) => s.almacenes?.activo !== false || s.cantidad !== 0))
      }

      const { data: movs } = await supabase
        .from('movimientos')
        .select('*, almacenes:almacen_id(nombre), origen:almacen_origen_id(nombre), destino:almacen_destino_id(nombre), importaciones(codigo)')
        .eq('producto_id', producto.id)
        .order('created_at', { ascending: false })
        .limit(20)
      setMovimientos(movs ?? [])
      setCargando(false)
    }
    cargar()
  }, [producto.id, esKit])

  const enTransito = movimientos.filter((m) => m.estado === 'en_transito' && !m.anulado_at)

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-0 md:p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="producto-detalle-titulo" className="bg-white w-full md:max-w-lg md:rounded-lg rounded-t-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-line flex items-start justify-between sticky top-0 bg-white">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 id="producto-detalle-titulo" className="font-semibold text-ink">{producto.nombre}</h3>
              {esKit && (
                <span className="text-[10px] font-mono uppercase tracking-wide bg-stone-100 text-ink-muted px-1.5 py-0.5 rounded">kit</span>
              )}
            </div>
            <p className="text-xs text-ink-muted">
              {producto.sku && <span className="font-mono">{producto.sku}</span>}
              {producto.sku && categoria && ' · '}
              {categoria?.nombre}
            </p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="text-ink-muted hover:text-ink text-xl leading-none">×</button>
        </div>

        <div className="p-5 space-y-6">
          {!cargando && (
            <div className="flex justify-end -mb-3">
              <BotonDescarga
                opciones={opcionesDescarga([{
                  etiqueta: 'Ficha del producto',
                  modelo: async () => modeloProducto({ producto, categoria, stockPorAlmacen, disponibilidadKit, componentes, movimientos }),
                }], perfil?.nombre)}
              />
            </div>
          )}

          {producto.foto_url && (
            <img src={producto.foto_url} alt={producto.nombre} className="w-full max-h-56 object-cover rounded-md border border-line" />
          )}

          {/* Precios */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-stone rounded-md px-3 py-2">
              <p className="text-[10px] text-ink-muted uppercase tracking-wide">Precio compra</p>
              <p className="font-mono text-sm text-ink">S/ {Number(producto.precio_compra).toFixed(2)}</p>
            </div>
            <div className="bg-stone rounded-md px-3 py-2">
              <p className="text-[10px] text-ink-muted uppercase tracking-wide">Precio venta</p>
              <p className="font-mono text-sm text-ink">S/ {Number(producto.precio_venta).toFixed(2)}</p>
            </div>
          </div>

          {cargando ? (
            <p className="text-sm text-ink-muted">Cargando...</p>
          ) : (
            <>
              {enTransito.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-signal uppercase tracking-wide mb-2">En camino</h4>
                  <div className="border border-signal/30 bg-signal/5 rounded-md divide-y divide-signal/20">
                    {enTransito.map((m) => (
                      <div key={m.id} className="flex items-center justify-between px-3 py-2">
                        <div>
                          <p className="text-sm text-ink">{m.almacenes?.nombre}</p>
                          <p className="text-[11px] text-ink-muted">
                            {m.importaciones?.codigo && <span className="font-mono">{m.importaciones.codigo}</span>}
                            {m.importaciones?.codigo && m.fecha_llegada_estimada && ' · '}
                            {m.fecha_llegada_estimada && (
                              <>llega {new Date(m.fecha_llegada_estimada + 'T00:00:00').toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}</>
                            )}
                          </p>
                        </div>
                        <span className="font-mono text-sm font-medium text-signal">+{m.cantidad}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {esKit ? (
            <>
              {/* Disponibilidad por almacén */}
              <div>
                <h4 className="text-xs font-medium text-ink-muted uppercase tracking-wide mb-2">Disponible por almacén</h4>
                {disponibilidadKit.length === 0 ? (
                  <p className="text-sm text-ink-muted">No hay almacenes registrados.</p>
                ) : (
                  <div className="border border-line rounded-md divide-y divide-line">
                    {disponibilidadKit.map((d) => (
                      <div key={d.almacen_id} className="flex items-center justify-between px-3 py-2">
                        <span className="text-sm text-ink">
                          {d.almacen_nombre}
                          {d.inactivo && <span className="ml-1.5 text-[10px] font-mono uppercase text-ink-muted">inactivo</span>}
                        </span>
                        <span className={`font-mono text-sm font-medium ${d.disponible <= 0 ? 'text-danger' : 'text-ink'}`}>
                          {d.disponible} {producto.unidad}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Receta */}
              <div>
                <h4 className="text-xs font-medium text-ink-muted uppercase tracking-wide mb-2">Componentes del kit</h4>
                <div className="border border-line rounded-md divide-y divide-line">
                  {componentes.map((c, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2">
                      <span className="text-sm text-ink">{c.productos?.nombre}</span>
                      <span className="font-mono text-xs text-ink-muted">{c.cantidad} {c.productos?.unidad}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div>
              <h4 className="text-xs font-medium text-ink-muted uppercase tracking-wide mb-2">Stock por almacén</h4>
              {stockPorAlmacen.length === 0 ? (
                <p className="text-sm text-ink-muted">Sin stock registrado todavía en ningún almacén.</p>
              ) : (
                <div className="border border-line rounded-md divide-y divide-line">
                  {stockPorAlmacen.map((s, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2">
                      <span className="text-sm text-ink">
                        {s.almacenes?.nombre}
                        {s.almacenes?.activo === false && <span className="ml-1.5 text-[10px] font-mono uppercase text-ink-muted">inactivo</span>}
                      </span>
                      <span className={`font-mono text-sm font-medium ${s.cantidad <= 0 ? 'text-danger' : s.cantidad <= producto.stock_minimo ? 'text-signal' : 'text-ink'}`}>
                        {s.cantidad} {producto.unidad}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between px-3 py-2 bg-stone-100">
                    <span className="text-sm font-medium text-ink">Total</span>
                    <span className="font-mono text-sm font-semibold text-ink">
                      {stockPorAlmacen.reduce((a, s) => a + s.cantidad, 0)} {producto.unidad}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Historial de movimientos */}
          <div>
            <h4 className="text-xs font-medium text-ink-muted uppercase tracking-wide mb-2">Últimos movimientos</h4>
            {movimientos.length === 0 ? (
              <p className="text-sm text-ink-muted">Sin movimientos registrados.</p>
            ) : (
              <div className="border border-line rounded-md divide-y divide-line">
                {movimientos.map((m) => (
                  <div key={m.id} className="px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-ink">
                        {m.tipo === 'transferencia'
                          ? `${m.origen?.nombre ?? '?'} → ${m.destino?.nombre ?? '?'}`
                          : `${m.tipo === 'entrada' ? 'Entrada' : 'Salida'} · ${m.almacenes?.nombre ?? '?'}`}
                        {m.anulado_at ? (
                          <span className="ml-1.5 text-[10px] font-mono uppercase text-danger">anulado</span>
                        ) : m.estado === 'en_transito' && (
                          <span className="ml-1.5 text-[10px] font-mono uppercase text-signal">en tránsito</span>
                        )}
                      </span>
                      <span className={`font-mono text-sm font-medium ${m.tipo === 'entrada' ? 'text-success' : m.tipo === 'salida' ? 'text-danger' : 'text-ink'}`}>
                        {m.tipo === 'entrada' ? '+' : m.tipo === 'salida' ? '-' : ''}{m.cantidad}
                      </span>
                    </div>
                    <p className="text-[11px] text-ink-muted mt-0.5">
                      {m.motivo && <>{m.motivo} · </>}
                      {new Date(m.created_at).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}