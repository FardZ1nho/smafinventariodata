import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const ETIQUETA_ESTADO = {
  en_transito: { texto: 'En tránsito', color: 'text-signal bg-signal/10' },
  parcial: { texto: 'Parcial', color: 'text-signal bg-signal/10' },
  confirmado: { texto: 'Confirmado', color: 'text-success bg-success/10' },
  sin_movimientos: { texto: 'Sin productos', color: 'text-ink-muted bg-stone-100' },
}

export default function ImportacionDetalle({ importacion, onClose, onCambio }) {
  const [lineas, setLineas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [confirmando, setConfirmando] = useState(false)

  async function cargar() {
    setCargando(true)
    const { data } = await supabase
      .from('movimientos')
      .select('*, productos(nombre, unidad), almacenes:almacen_id(nombre)')
      .eq('importacion_id', importacion.id)
      .order('created_at', { ascending: false })
    setLineas(data ?? [])
    setCargando(false)
  }

  useEffect(() => { cargar() }, [importacion.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function confirmarLinea(id) {
    const { error } = await supabase.from('movimientos').update({ estado: 'confirmado' }).eq('id', id)
    if (error) { setError(error.message); return }
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
    if (error) setError(error.message)
    await cargar()
    onCambio()
    setConfirmando(false)
  }

  const pendientes = lineas.filter((l) => l.estado === 'en_transito').length
  const estado = pendientes === 0 && lineas.length > 0 ? 'confirmado' : pendientes < lineas.length ? 'parcial' : 'en_transito'

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-0 md:p-4">
      <div className="bg-white w-full md:max-w-lg md:rounded-lg rounded-t-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-line flex items-start justify-between sticky top-0 bg-white">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="font-semibold text-ink font-mono">{importacion.codigo}</h3>
              <span className={`text-[10px] font-mono uppercase tracking-wide px-1.5 py-0.5 rounded ${ETIQUETA_ESTADO[estado].color}`}>
                {ETIQUETA_ESTADO[estado].texto}
              </span>
            </div>
            <p className="text-xs text-ink-muted">
              {importacion.proveedor && <>{importacion.proveedor} · </>}
              {importacion.fecha_llegada_estimada && (
                <>llega {new Date(importacion.fecha_llegada_estimada + 'T00:00:00').toLocaleDateString('es-PE', { dateStyle: 'medium' })}</>
              )}
            </p>
          </div>
          <button onClick={onClose} className="text-ink-muted hover:text-ink text-xl leading-none">×</button>
        </div>

        <div className="p-5 space-y-4">
          {error && <p className="text-sm text-danger">{error}</p>}

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
                {lineas.map((l) => (
                  <div key={l.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm text-ink truncate">{l.productos?.nombre ?? 'Producto eliminado'}</p>
                      <p className="text-xs text-ink-muted">
                        {l.almacenes?.nombre} · <span className="font-mono">{l.cantidad} {l.productos?.unidad}</span>
                      </p>
                    </div>
                    {l.estado === 'en_transito' ? (
                      <button
                        onClick={() => confirmarLinea(l.id)}
                        className="text-xs font-medium text-signal hover:underline shrink-0"
                      >
                        Confirmar
                      </button>
                    ) : (
                      <span className="text-[10px] font-mono uppercase tracking-wide bg-success/10 text-success px-1.5 py-0.5 rounded shrink-0">
                        llegó
                      </span>
                    )}
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