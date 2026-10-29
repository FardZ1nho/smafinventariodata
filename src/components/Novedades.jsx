import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'

// Aviso de novedades: aparece una sola vez por usuario (en cada dispositivo) después de una actualización.
// Para un aviso nuevo en el futuro, cambiar VERSION y el contenido de PASOS.
const VERSION = '2026-10-29'

const RESUMEN = [
  ['Importaciones', 'Al confirmar se indica cuántas unidades llegaron. Queda registrado quién recibió y cuándo.'],
  ['Descargas', 'PDF y Excel de importaciones, inventario, movimientos, fichas de producto y calidad de datos.'],
  ['Movimientos', 'Un administrador puede anular un movimiento equivocado sin borrarlo; el stock se corrige solo.'],
  ['Calidad de datos', 'Nueva pantalla que lista productos sin costo, sin SKU, duplicados y otros datos por revisar.'],
  ['Resumen', 'Las tarjetas y alertas se pueden tocar. El valor del inventario ahora se calcula a costo.'],
  ['Almacenes y categorías', 'Se pueden editar, muestran cuántos productos tienen y no se eliminan si están en uso.'],
  ['Transferencias', 'Ya no se puede elegir el mismo almacén como origen y destino.'],
  ['Historial', 'El filtro por fechas usa la hora de Lima y cada movimiento muestra quién lo registró.'],
  ['Acceso', 'La sesión se cierra sola a las 24 horas. Nuevo enlace "¿Olvidaste tu contraseña?" en el login.'],
]

const PASOS = [
  {
    titulo: 'El sistema se actualizó',
    texto: 'Estos son los cambios. En los siguientes pasos te mostramos cómo se ven.',
    vista: (
      <div className="border border-line rounded-md overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-ink text-white">
            <tr>
              <th className="px-2.5 py-1.5 font-medium w-32">Dónde</th>
              <th className="px-2.5 py-1.5 font-medium">Qué cambió</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {RESUMEN.map(([donde, que]) => (
              <tr key={donde} className="align-top">
                <td className="px-2.5 py-1.5 font-medium text-ink">{donde}</td>
                <td className="px-2.5 py-1.5 text-ink-muted">{que}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ),
  },
  {
    titulo: 'Recepción de importaciones',
    texto: 'En Importaciones, al pulsar "Confirmar" en un producto escribe cuántas unidades llegaron. Si llegaron menos, el stock suma solo lo recibido y queda anotada la diferencia. Cada línea muestra quién la recibió y cuándo.',
    vista: (
      <div className="border border-line rounded-md divide-y divide-line bg-white text-left">
        <div className="px-3 py-2.5">
          <p className="text-sm text-ink">Plancha Bull Float 1.20 m</p>
          <p className="text-xs text-ink-muted">Almacén Centro · <span className="font-mono">10 und</span></p>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-ink-muted">Llegaron</span>
            <span className="w-14 rounded-md border border-signal ring-2 ring-signal/30 px-2 py-0.5 text-sm font-mono text-center">8</span>
            <span className="text-xs text-ink-muted">de 10</span>
            <span className="ml-auto text-xs font-medium bg-ink text-white rounded px-2.5 py-1">Recibir</span>
          </div>
        </div>
        <div className="px-3 py-2.5 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-ink">Mango de aluminio</p>
            <p className="text-xs text-ink-muted">Almacén Centro · <span className="font-mono">8 und</span><span className="text-signal"> de 10 pedidas</span></p>
            <p className="text-[11px] text-ink-muted">Recibido 28 oct 2026, 15:30 · María</p>
          </div>
          <span className="text-[10px] font-mono uppercase tracking-wide bg-success/10 text-success px-1.5 py-0.5 rounded">llegó</span>
        </div>
      </div>
    ),
  },
  {
    titulo: 'Descargar en PDF o Excel',
    texto: 'Busca el botón "Descargar" en Importaciones, Productos, Movimientos, la ficha de cada producto y Calidad de datos. Lo que descargas respeta los filtros que tengas puestos. En una importación en camino descargas la hoja para contar la mercadería; cuando ya llegó, la constancia de recepción.',
    vista: (
      <div className="flex justify-end">
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-line bg-white text-xs font-medium text-ink">
            <svg aria-hidden="true" viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 2v8M4.5 6.5 8 10l3.5-3.5M3 13h10" />
            </svg>
            Descargar <span className="text-ink-muted">▾</span>
          </span>
          <div className="mt-1 w-56 bg-white border border-line rounded-md shadow-lg py-1 text-left">
            <p className="px-3 pt-2 pb-1 text-[10px] font-mono uppercase tracking-wide text-ink-muted">PDF</p>
            <p className="px-3 py-1.5 text-xs text-ink bg-stone-100">Todos los almacenes</p>
            <p className="px-3 py-1.5 text-xs text-ink">Solo Almacén Centro</p>
            <p className="px-3 pt-2 pb-1 text-[10px] font-mono uppercase tracking-wide text-ink-muted border-t border-line mt-1">Excel</p>
            <p className="px-3 py-1.5 text-xs text-ink">Todos los almacenes</p>
            <p className="px-3 py-1.5 text-xs text-ink">Solo Almacén Centro</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    titulo: 'Anular un movimiento',
    texto: 'Si un movimiento se registró mal, un administrador puede abrirlo y pulsar "Anular este movimiento" indicando el motivo. No se borra: queda tachado con la marca ANULADO, quién lo anuló y por qué, y el stock vuelve a como estaba. Si el stock quedaría negativo, el sistema no lo permite.',
    vista: (
      <div className="space-y-2 text-left">
        <div className="bg-white border border-line rounded-md px-3 py-2.5 flex items-center justify-between gap-3 opacity-60">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-ink line-through">Tornillo hexagonal 1/2</p>
              <span className="text-[10px] font-mono uppercase tracking-wide bg-danger/10 text-danger px-1.5 py-0.5 rounded">anulado</span>
            </div>
            <p className="text-xs text-ink-muted">Almacén Centro · Venta · 28 oct</p>
          </div>
          <span className="font-mono text-sm font-medium text-danger">-20</span>
        </div>
        <div className="rounded-md bg-danger/5 border border-danger/20 px-3 py-2.5">
          <p className="text-sm text-ink">Anulado el 28 oct 2026, 18:10 por Patrick</p>
          <p className="text-xs text-ink-muted">Motivo: Cantidad registrada por error</p>
        </div>
      </div>
    ),
  },
  {
    titulo: 'Calidad de datos',
    texto: 'Nueva opción en el menú (en el celular, desde el enlace del Resumen). Lista los productos con datos faltantes o dudosos: sin precio de compra, SKU o nombre repetido, sin categoría, entre otros. Cada uno tiene un botón "Editar" para corregirlo ahí mismo.',
    vista: (
      <div className="bg-white border border-line rounded-md text-left">
        <div className="px-3 py-2.5 border-b border-line flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink">Sin precio de compra</p>
            <p className="text-xs text-ink-muted">El valor del inventario a costo los cuenta como S/ 0.</p>
          </div>
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-danger/10 text-danger">12</span>
        </div>
        {['C00101 · 8 und en stock', 'Adaptador 4" · 3 und en stock'].map((t) => (
          <div key={t} className="flex items-center justify-between px-3 py-2 border-b border-line last:border-0">
            <p className="text-xs text-ink-muted">{t}</p>
            <span className="text-xs font-medium text-signal">Editar</span>
          </div>
        ))}
        <div className="px-3 py-2.5 border-t border-line flex items-center justify-between">
          <p className="text-sm font-semibold text-ink">SKU repetido</p>
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-success/10 text-success">OK</span>
        </div>
      </div>
    ),
  },
  {
    titulo: 'Más rápido y más claro',
    texto: 'Toca una tarjeta del Resumen para ver esos productos ya filtrados, o una alerta para abrir la ficha del producto. El valor del inventario ahora se calcula con el precio de compra. Almacenes y categorías se pueden editar.',
    vista: (
      <div className="grid grid-cols-3 gap-2 text-left">
        <div className="bg-white border border-line rounded-md p-2.5 ring-2 ring-signal/30">
          <p className="text-[10px] text-ink-muted uppercase tracking-wide">Sin stock</p>
          <p className="text-lg font-semibold font-mono text-danger">113</p>
          <p className="text-[10px] text-signal">Ver productos →</p>
        </div>
        <div className="bg-white border border-line rounded-md p-2.5">
          <p className="text-[10px] text-ink-muted uppercase tracking-wide">Stock bajo</p>
          <p className="text-lg font-semibold font-mono text-signal">89</p>
        </div>
        <div className="bg-white border border-line rounded-md p-2.5">
          <p className="text-[10px] text-ink-muted uppercase tracking-wide">Valor a costo</p>
          <p className="text-sm font-semibold font-mono text-ink">S/ 52,310</p>
          <p className="text-[10px] text-ink-muted">Venta: S/ 76,024</p>
        </div>
      </div>
    ),
  },
  {
    titulo: 'Tu acceso',
    texto: 'Por seguridad, la sesión se cierra sola 24 horas después de entrar: cada día vuelves a iniciar sesión. Si olvidas tu contraseña, usa "¿Olvidaste tu contraseña?" en el login y te llegará un correo para crear una nueva.',
    vista: (
      <div className="bg-white border border-line rounded-md p-4 text-left max-w-xs mx-auto">
        <p className="text-sm text-signal bg-signal/10 rounded-md px-3 py-2 mb-3 text-xs">
          Tu sesión se cerró porque pasaron 24 horas desde que ingresaste.
        </p>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-ink">Contraseña</span>
          <span className="text-[11px] text-signal underline">¿Olvidaste tu contraseña?</span>
        </div>
        <div className="rounded-md border border-line px-3 py-1.5 text-xs text-ink-muted">••••••••</div>
      </div>
    ),
  },
]

function claveVista(userId) {
  return `novedades_vistas_${VERSION}_${userId}`
}

export default function Novedades() {
  const { user } = useAuth()
  const [abierto, setAbierto] = useState(false)
  const [paso, setPaso] = useState(0)

  useEffect(() => {
    if (!user?.id) return
    let visto = false
    try { visto = localStorage.getItem(claveVista(user.id)) === '1' } catch { /* sin almacenamiento */ }
    setAbierto(!visto)
    setPaso(0)
  }, [user?.id])

  // Escape también cierra
  useEffect(() => {
    if (!abierto) return
    function tecla(e) { if (e.key === 'Escape') cerrar() }
    document.addEventListener('keydown', tecla)
    return () => document.removeEventListener('keydown', tecla)
  })

  function cerrar() {
    try { localStorage.setItem(claveVista(user.id), '1') } catch { /* sin almacenamiento: volverá a aparecer */ }
    setAbierto(false)
  }

  if (!abierto) return null
  const actual = PASOS[paso]
  const ultimo = paso === PASOS.length - 1

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-[60] p-0 md:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="novedades-titulo"
        className="bg-stone w-full md:max-w-xl md:rounded-lg rounded-t-2xl max-h-[92vh] flex flex-col"
      >
        <div className="px-5 pt-5 pb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-signal mb-1">
              Novedades · {paso + 1} de {PASOS.length}
            </p>
            <h3 id="novedades-titulo" className="text-lg font-semibold text-ink">{actual.titulo}</h3>
          </div>
          <button onClick={cerrar} aria-label="Cerrar" className="text-ink-muted hover:text-ink text-xl leading-none">×</button>
        </div>

        <div className="px-5 pb-4 overflow-y-auto space-y-4">
          <p className="text-sm text-ink-muted">{actual.texto}</p>
          <div aria-hidden={paso > 0 ? 'true' : undefined} className="bg-stone-100/60 border border-line rounded-lg p-3 select-none">
            {paso > 0 && <p className="text-[10px] font-mono uppercase tracking-wide text-ink-muted mb-2">Vista previa · datos de ejemplo</p>}
            {actual.vista}
          </div>
        </div>

        <div className="px-5 py-3 border-t border-line bg-white md:rounded-b-lg flex items-center justify-between gap-3">
          <div className="flex gap-1.5" aria-hidden="true">
            {PASOS.map((p, i) => (
              <span key={p.titulo} className={`h-1.5 rounded-full transition-all ${i === paso ? 'w-5 bg-signal' : 'w-1.5 bg-line'}`} />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {paso > 0 && (
              <button onClick={() => setPaso(paso - 1)} className="px-3 py-2 rounded-md text-sm text-ink-muted hover:bg-stone-100">
                Atrás
              </button>
            )}
            <button
              onClick={() => (ultimo ? cerrar() : setPaso(paso + 1))}
              className="bg-ink text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-ink/90 transition"
            >
              {ultimo ? 'Entendido' : 'Siguiente'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
