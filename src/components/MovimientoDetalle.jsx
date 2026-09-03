export default function MovimientoDetalle({ movimiento, onClose, onConfirmarLlegada }) {
  const m = movimiento
  const esTransferencia = m.tipo === 'transferencia'

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-0 md:p-4">
      <div className="bg-white w-full md:max-w-md md:rounded-lg rounded-t-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-line flex items-center justify-between sticky top-0 bg-white">
          <h3 className="font-semibold text-ink">Detalle del movimiento</h3>
          <button onClick={onClose} className="text-ink-muted hover:text-ink text-xl leading-none">×</button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className={`text-xs font-mono uppercase tracking-wide px-2 py-1 rounded ${m.tipo === 'entrada' ? 'bg-success/10 text-success' : m.tipo === 'salida' ? 'bg-danger/10 text-danger' : 'bg-signal/10 text-signal'
              }`}>
              {m.tipo}
            </span>
            {m.estado === 'en_transito' && (
              <span className="text-xs font-mono uppercase tracking-wide bg-stone-100 text-ink-muted px-2 py-1 rounded">
                en tránsito
              </span>
            )}
          </div>

          <div>
            <p className="text-[10px] text-ink-muted uppercase tracking-wide">Producto</p>
            <p className="text-sm font-medium text-ink">{m.productos?.nombre ?? 'Producto eliminado'}</p>
          </div>

          <div>
            <p className="text-[10px] text-ink-muted uppercase tracking-wide">Cantidad</p>
            <p className="font-mono text-lg font-semibold text-ink">{m.cantidad} {m.productos?.unidad}</p>
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

          {m.tipo === 'entrada' && m.estado === 'en_transito' && (
            <button
              onClick={() => onConfirmarLlegada(m.id)}
              className="w-full bg-ink text-white rounded-md py-2.5 text-sm font-medium hover:bg-ink/90 transition"
            >
              Confirmar llegada al almacén
            </button>
          )}
        </div>
      </div>
    </div>
  )
}