import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { nombresUsuarios } from '../lib/usuarios'
import { modeloImportacion, opcionesDescarga } from '../lib/reportes'
import { useAuth } from '../context/AuthContext'
import BotonDescarga from './BotonDescarga'

const ETIQUETA_ESTADO = {
  en_transito: { texto: 'En tránsito', color: 'text-signal bg-signal/10' },
  parcial: { texto: 'Parcial', color: 'text-signal bg-signal/10' },
  confirmado: { texto: 'Confirmado', color: 'text-success bg-success/10' },
  sin_movimientos: { texto: 'Sin productos', color: 'text-ink-muted bg-stone-100' },
}

export default function ImportacionDetalle({ importacion, onClose, onCambio }) {
  const { perfil } = useAuth()
  const [lineas, setLineas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [confirmando, setConfirmando] = useState(false)
  const [nombres, setNombres] = useState({})
  // Línea en edición para indicar la cantidad que llegó: { id, cantidad }
  const [recibiendo, setRecibiendo] = useState(null)

  async function cargar() {
    setCargando(true)
    const { data } = await supabase
      .from('movimientos')
      .select('*, productos(nombre, unidad, sku), almacenes:almacen_id(nombre)')
      .eq('importacion_id', importacion.id)
      .order('created_at', { ascending: false })
    setLineas(data ?? [])
    setNombres(await nombresUsuarios((data ?? []).map((l) => l.recibido_por)))
    setCargando(false)
  }

  useEffect(() => { cargar() }, [importacion.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function confirmarLinea(id, cantidad) {
    // Solo si sigue en tránsito: evita cambiar la cantidad de algo ya recibido
    const { error } = await supabase
      .from('movimientos')
      .update({ estado: 'confirmado', cantidad })
      .eq('id', id)
      .eq('estado', 'en_transito')
    if (error) { setError(error.message); return }
    setRecibiendo(null)
    await cargar()
    onCambio()
  }

  async function confirmarTodo() {
    setConfirmando(true)
    const { error } = await supabase
      .from('movimientos')
      .update({ estado: 'confirmado' })
      .eq('importacion_id', importacion.id)
      .eq('estado', 'en_transito')
      .is('anulado_at', null)
    if (error) setError(error.message)
    await cargar()
    onCambio()
    setConfirmando(false)
  }

  // Las líneas anuladas se muestran, pero no cuentan para el estado de la importación
  const vigentes = lineas.filter((l) => !l.anulado_at)
  const pendientes = vigentes.filter((l) => l.estado === 'en_transito').length
  const estado = vigentes.length === 0 ? 'sin_movimientos' : pendientes === 0 ? 'confirmado' : pendientes < vigentes.length ? 'parcial' : 'en_transito'

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-0 md:p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="importacion-detalle-titulo" className="bg-white w-full md:max-w-lg md:rounded-lg rounded-t-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-line flex items-start justify-between sticky top-0 bg-white">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 id="importacion-detalle-titulo" className="font-semibold text-ink font-mono">{importacion.codigo}</h3>
              <span className={`text-[10px] font-mono uppercase tracking-wide px-1.5 py-0.5 rounded ${ETIQUETA_ESTADO[estado].color}`}>
                {ETIQUETA_ESTADO[estado].texto}
              </span>
            </div>
            <p className="text-xs text-ink-muted">
              {importacion.proveedor && <>{importacion.proveedor} · </>}
              {estado === 'confirmado' && importacion.ultima_recepcion ? (
                <>recibido {new Date(importacion.ultima_recepcion).toLocaleDateString('es-PE', { dateStyle: 'medium' })}</>
              ) : importacion.fecha_llegada_estimada && (
                <>llegada prevista {new Date(importacion.fecha_llegada_estimada + 'T00:00:00').toLocaleDateString('es-PE', { dateStyle: 'medium' })}</>
              )}
            </p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="text-ink-muted hover:text-ink text-xl leading-none">×</button>
        </div>

        <div className="p-5 space-y-4">
          {error && <p className="text-sm text-danger">{error}</p>}

          {!cargando && vigentes.length > 0 && (
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-ink-muted">
                {estado === 'confirmado' ? 'Constancia con lo recibido, fechas y responsables.'
                  : estado === 'parcial' ? 'Documento con lo recibido y lo pendiente.'
                  : 'Hoja para contar la mercadería cuando llegue.'}
              </p>
              <BotonDescarga
                opciones={opcionesDescarga([{
                  etiqueta: estado === 'confirmado' ? 'Constancia de recepción' : 'Hoja de recepción',
                  modelo: () => modeloImportacion({ importacion, lineas, estado }),
                }], perfil?.nombre)}
              />
            </div>
          )}

          {pendientes > 0 && (
            <button
              onClick={confirmarTodo}
              disabled={confirmando}
              className="w-full bg-ink text-white rounded-md py-2.5 text-sm font-medium hover:bg-ink/90 transition disabled:opacity-50"
            >
              {confirmando ? 'Confirmando...' : `Confirmar toda la importación (${pendientes} pendiente${pendientes === 1 ? '' : 's'})`}
            </button>
          )}

          <div>
            <h4 className="text-xs font-medium text-ink-muted uppercase tracking-wide mb-2">
              Productos del lote ({lineas.length})
            </h4>
            {cargando ? (
              <p className="text-sm text-ink-muted">Cargando...</p>
            ) : lineas.length === 0 ? (
              <p className="text-sm text-ink-muted">Esta importación todavía no tiene productos.</p>
            ) : (
              <div className="border border-line rounded-md divide-y divide-line">
                {lineas.map((l) => {
                  const editando = recibiendo?.id === l.id
                  const cantidadValida = editando && Number.isInteger(Number(recibiendo.cantidad)) && Number(recibiendo.cantidad) >= 1
                  return (
                    <div key={l.id} className={`px-3 py-2.5 ${l.anulado_at ? 'opacity-60' : ''}`}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className={`text-sm text-ink truncate ${l.anulado_at ? 'line-through' : ''}`} title={l.productos?.nombre}>{l.productos?.nombre ?? 'Producto eliminado'}</p>
                          <p className="text-xs text-ink-muted">
                            {l.almacenes?.nombre} · <span className="font-mono">{l.cantidad} {l.productos?.unidad}</span>
                            {l.cantidad_esperada != null && (
                              <span className="text-signal"> de {l.cantidad_esperada} pedidas</span>
                            )}
                          </p>
                          {l.estado === 'confirmado' && l.recibido_at && (
                            <p className="text-[11px] text-ink-muted">
                              Recibido {new Date(l.recibido_at).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' })}
                              {nombres[l.recibido_por] && <> · {nombres[l.recibido_por]}</>}
                            </p>
                          )}
                        </div>
                        {l.anulado_at ? (
                          <span className="text-[10px] font-mono uppercase tracking-wide bg-danger/10 text-danger px-1.5 py-0.5 rounded shrink-0">
                            anulado
                          </span>
                        ) : l.estado === 'en_transito' ? (
                          !editando && (
                            <button
                              onClick={() => setRecibiendo({ id: l.id, cantidad: l.cantidad })}
                              className="text-xs font-medium text-signal hover:underline shrink-0"
                            >
                              Confirmar
                            </button>
                          )
                        ) : (
                          <span className="text-[10px] font-mono uppercase tracking-wide bg-success/10 text-success px-1.5 py-0.5 rounded shrink-0">
                            llegó
                          </span>
                        )}
                      </div>

                      {editando && (
                        <div className="mt-2 flex items-center gap-2">
                          <label htmlFor={`recibido-${l.id}`} className="text-xs text-ink-muted shrink-0">Llegaron</label>
                          <input
                            id={`recibido-${l.id}`}
                            type="number" min="1" step="1"
                            value={recibiendo.cantidad}
                            onChange={(e) => setRecibiendo({ ...recibiendo, cantidad: e.target.value })}
                            className="w-20 rounded-md border border-line px-2 py-1 text-sm font-mono text-center focus:outline-none focus:ring-2 focus:ring-signal/40 focus:border-signal"
                          />
                          <span className="text-xs text-ink-muted">de {l.cantidad}</span>
                          <button
                            onClick={() => confirmarLinea(l.id, Number(recibiendo.cantidad))}
                            disabled={!cantidadValida}
                            className="ml-auto text-xs font-medium bg-ink text-white rounded px-2.5 py-1 hover:bg-ink/90 disabled:opacity-50"
                          >
                            Recibir
                          </button>
                          <button onClick={() => setRecibiendo(null)} className="text-xs text-ink-muted hover:underline">
                            Cancelar
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}