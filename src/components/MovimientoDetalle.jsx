import { useEffect, useState } from 'react'
import { nombresUsuarios } from '../lib/usuarios'

// onConfirmarLlegada / onAnular devuelven un mensaje de error, o nada si salió bien.
// onAnular es null para quien no es administrador.
export default function MovimientoDetalle({ movimiento, onClose, onConfirmarLlegada, onAnular }) {
  const m = movimiento
  const esTransferencia = m.tipo === 'transferencia'
  const anulado = Boolean(m.anulado_at)
  const [nombres, setNombres] = useState({})
  const [cantidadRecibida, setCantidadRecibida] = useState(m.cantidad)
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState('')
  const [anulando, setAnulando] = useState(false)
  const [motivoAnulacion, setMotivoAnulacion] = useState('')

  // Consulta aparte: si el usuario no se puede leer (permisos), el detalle sigue funcionando
  useEffect(() => {
    nombresUsuarios([m.usuario_id, m.recibido_por, m.anulado_por]).then(setNombres)
  }, [m.usuario_id, m.recibido_por, m.anulado_por])

  const cantidadValida = Number.isInteger(Number(cantidadRecibida)) && Number(cantidadRecibida) >= 1

  async function ejecutar(accion) {
    setError('')
    setProcesando(true)
    const mensaje = await accion()
    if (mensaje) setError(mensaje)
    setProcesando(false)
  }

  const efectoAnulacion = m.tipo === 'entrada'
    ? (m.estado === 'confirmado' ? `Se restarán ${m.cantidad} ${m.productos?.unidad ?? ''} de ${m.almacenes?.nombre ?? 'su almacén'}.` : 'Esta entrada aún no sumó stock: solo quedará anulada.')
    : m.tipo === 'salida'
      ? `Se devolverán ${m.cantidad} ${m.productos?.unidad ?? ''} a ${m.almacenes?.nombre ?? 'su almacén'}${m.productos?.tipo === 'kit' ? ' (las piezas del kit, según su receta actual)' : ''}.`
      : `Se devolverán ${m.cantidad} ${m.productos?.unidad ?? ''} de ${m.destino?.nombre ?? '?'} a ${m.origen?.nombre ?? '?'}.`

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-0 md:p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="movimiento-detalle-titulo" className="bg-white w-full md:max-w-md md:rounded-lg rounded-t-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-line flex items-center justify-between sticky top-0 bg-white">
          <h3 id="movimiento-detalle-titulo" className="font-semibold text-ink">Detalle del movimiento</h3>
          <button onClick={onClose} aria-label="Cerrar" className="text-ink-muted hover:text-ink text-xl leading-none">×</button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className={`text-xs font-mono uppercase tracking-wide px-2 py-1 rounded ${m.tipo === 'entrada' ? 'bg-success/10 text-success' : m.tipo === 'salida' ? 'bg-danger/10 text-danger' : 'bg-signal/10 text-signal'
              }`}>
              {m.tipo}
            </span>
            {anulado ? (
              <span className="text-xs font-mono uppercase tracking-wide bg-danger/10 text-danger px-2 py-1 rounded">
                anulado
              </span>
            ) : m.estado === 'en_transito' && (
              <span className="text-xs font-mono uppercase tracking-wide bg-stone-100 text-ink-muted px-2 py-1 rounded">
                en tránsito
              </span>
            )}
          </div>

          {anulado && (
            <div className="rounded-md bg-danger/5 border border-danger/20 px-3 py-2.5 space-y-1">
              <p className="text-sm text-ink">
                Anulado el {new Date(m.anulado_at).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' })}
                {nombres[m.anulado_por] && <> por {nombres[m.anulado_por]}</>}
              </p>
              {m.motivo_anulacion && <p className="text-xs text-ink-muted">Motivo: {m.motivo_anulacion}</p>}
              <p className="text-xs text-ink-muted">Su efecto en el stock ya fue revertido.</p>
            </div>
          )}

          <div>
            <p className="text-[10px] text-ink-muted uppercase tracking-wide">Producto</p>
            <p className="text-sm font-medium text-ink">{m.productos?.nombre ?? 'Producto eliminado'}</p>
          </div>

          <div>
            <p className="text-[10px] text-ink-muted uppercase tracking-wide">
              {m.cantidad_esperada != null ? 'Cantidad recibida' : m.estado === 'en_transito' ? 'Cantidad pedida' : 'Cantidad'}
            </p>
            <p className="font-mono text-lg font-semibold text-ink">{m.cantidad} {m.productos?.unidad}</p>
            {m.cantidad_esperada != null && (
              <p className="text-xs text-signal">
                Pedido: {m.cantidad_esperada} · {m.cantidad < m.cantidad_esperada
                  ? `faltaron ${m.cantidad_esperada - m.cantidad}`
                  : `sobraron ${m.cantidad - m.cantidad_esperada}`}
              </p>
            )}
          </div>

          {esTransferencia ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] text-ink-muted uppercase tracking-wide">Desde</p>
                <p className="text-sm text-ink">{m.origen?.nombre ?? '—'}</p>
              </div>
              <div>
                <p className="text-[10px] text-ink-muted uppercase tracking-wide">Hacia</p>
                <p className="text-sm text-ink">{m.destino?.nombre ?? '—'}</p>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-[10px] text-ink-muted uppercase tracking-wide">Almacén</p>
              <p className="text-sm text-ink">{m.almacenes?.nombre ?? '—'}</p>
            </div>
          )}

          {m.importaciones?.codigo && (
            <div>
              <p className="text-[10px] text-ink-muted uppercase tracking-wide">Código de importación</p>
              <p className="text-sm font-mono text-ink">{m.importaciones.codigo}</p>
            </div>
          )}

          {m.estado === 'en_transito' && m.fecha_llegada_estimada && (
            <div>
              <p className="text-[10px] text-ink-muted uppercase tracking-wide">Llegada estimada</p>
              <p className="text-sm text-ink">
                {new Date(m.fecha_llegada_estimada + 'T00:00:00').toLocaleDateString('es-PE', { dateStyle: 'long' })}
              </p>
            </div>
          )}

          {m.motivo && (
            <div>
              <p className="text-[10px] text-ink-muted uppercase tracking-wide">Motivo</p>
              <p className="text-sm text-ink">{m.motivo}</p>
            </div>
          )}
          {m.numero_comprobante && (
            <div>
              <p className="text-[10px] text-ink-muted uppercase tracking-wide">N° de comprobante</p>
              <p className="text-sm font-mono text-ink">{m.numero_comprobante}</p>
            </div>
          )}
          {m.nota && (
            <div>
              <p className="text-[10px] text-ink-muted uppercase tracking-wide">Nota</p>
              <p className="text-sm text-ink">{m.nota}</p>
            </div>
          )}

          <div>
            <p className="text-[10px] text-ink-muted uppercase tracking-wide">Fecha</p>
            <p className="text-sm text-ink">
              {new Date(m.created_at).toLocaleString('es-PE', { dateStyle: 'long', timeStyle: 'short' })}
            </p>
          </div>

          <div>
            <p className="text-[10px] text-ink-muted uppercase tracking-wide">Registrado por</p>
            <p className="text-sm text-ink">{nombres[m.usuario_id] ?? '—'}</p>
          </div>

          {m.tipo === 'entrada' && m.recibido_at && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] text-ink-muted uppercase tracking-wide">Recibido el</p>
                <p className="text-sm text-ink">
                  {new Date(m.recibido_at).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-ink-muted uppercase tracking-wide">Recibido por</p>
                <p className="text-sm text-ink">{nombres[m.recibido_por] ?? '—'}</p>
              </div>
            </div>
          )}

          {error && <p role="alert" className="text-sm text-danger">{error}</p>}

          {!anulado && m.tipo === 'entrada' && m.estado === 'en_transito' && (
            <div className="border-t border-line pt-4 space-y-2">
              <label htmlFor="cantidad-recibida" className="block text-sm font-medium text-ink">
                Cantidad que llegó
              </label>
              <input
                id="cantidad-recibida"
                type="number" min="1" step="1"
                value={cantidadRecibida}
                onChange={(e) => setCantidadRecibida(e.target.value)}
                className="w-full rounded-md border border-line px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-signal/40 focus:border-signal"
              />
              {cantidadValida && Number(cantidadRecibida) !== m.cantidad && (
                <p className="text-xs text-signal">
                  Se pidieron {m.cantidad}. Quedará registrada la diferencia y el stock sumará {cantidadRecibida}.
                </p>
              )}
              <button
                onClick={() => ejecutar(() => onConfirmarLlegada(m.id, Number(cantidadRecibida)))}
                disabled={!cantidadValida || procesando}
                className="w-full bg-ink text-white rounded-md py-2.5 text-sm font-medium hover:bg-ink/90 transition disabled:opacity-50"
              >
                {procesando ? 'Confirmando...' : 'Confirmar llegada al almacén'}
              </button>
            </div>
          )}

          {!anulado && onAnular && (
            <div className="border-t border-line pt-4">
              {!anulando ? (
                <button
                  onClick={() => { setAnulando(true); setError('') }}
                  className="text-xs font-medium text-danger hover:underline"
                >
                  Anular este movimiento
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-ink">Anular movimiento</p>
                  <p className="text-xs text-ink-muted">
                    {efectoAnulacion} El movimiento no se borra: queda marcado como anulado, con tu nombre, la fecha y el motivo.
                  </p>
                  <label htmlFor="motivo-anulacion" className="block text-xs font-medium text-ink">Motivo (obligatorio)</label>
                  <input
                    id="motivo-anulacion"
                    value={motivoAnulacion}
                    onChange={(e) => setMotivoAnulacion(e.target.value)}
                    placeholder="ej. Cantidad registrada por error"
                    className="w-full rounded-md border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-danger/30 focus:border-danger"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => ejecutar(() => onAnular(m.id, motivoAnulacion.trim()))}
                      disabled={!motivoAnulacion.trim() || procesando}
                      className="flex-1 bg-danger text-white rounded-md py-2 text-sm font-medium hover:bg-danger/90 transition disabled:opacity-50"
                    >
                      {procesando ? 'Anulando...' : 'Confirmar anulación'}
                    </button>
                    <button
                      onClick={() => { setAnulando(false); setMotivoAnulacion('') }}
                      className="px-3 rounded-md border border-line text-sm text-ink-muted hover:bg-stone-100"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}