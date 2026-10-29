import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import Paginador from '../components/Paginador'
import ImportacionDetalle from '../components/ImportacionDetalle'
import BotonDescarga from '../components/BotonDescarga'
import { modeloListadoImportaciones, opcionesDescarga } from '../lib/reportes'
import { useAuth } from '../context/AuthContext'

const POR_PAGINA = 10

const ETIQUETA_ESTADO = {
  en_transito: { texto: 'En tránsito', color: 'text-signal bg-signal/10' },
  parcial: { texto: 'Parcial', color: 'text-signal bg-signal/10' },
  confirmado: { texto: 'Confirmado', color: 'text-success bg-success/10' },
  sin_movimientos: { texto: 'Sin productos', color: 'text-ink-muted bg-stone-100' },
}

export default function Importaciones() {
  const { perfil } = useAuth()
  const [importaciones, setImportaciones] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todas')
  const [pagina, setPagina] = useState(1)
  const [detalle, setDetalle] = useState(null)

  async function cargar() {
    setCargando(true)
    const { data, error } = await supabase
      .from('importaciones_resumen')
      .select('*')
      .order('fecha_llegada_estimada', { ascending: true, nullsFirst: false })
    if (error) setError(error.message)
    setImportaciones(data ?? [])
    setCargando(false)
  }

  useEffect(() => { cargar() }, [])

  function actualizarFiltro(setter, valor) {
    setter(valor)
    setPagina(1)
  }

  const filtradas = importaciones.filter((i) => {
    const coincideTexto =
      i.codigo.toLowerCase().includes(busqueda.toLowerCase()) ||
      (i.proveedor ?? '').toLowerCase().includes(busqueda.toLowerCase())
    const coincideEstado = filtroEstado === 'todas' || i.estado === filtroEstado
    return coincideTexto && coincideEstado
  })

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA))
  const paginadas = filtradas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA)

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-ink mb-1">Importaciones</h2>
          <p className="text-sm text-ink-muted">Lotes de productos agrupados por código de importación.</p>
        </div>
        <BotonDescarga
          opciones={opcionesDescarga([{
            etiqueta: 'Listado de importaciones',
            modelo: async () => modeloListadoImportaciones({
              importaciones: filtradas,
              filtros: [
                filtroEstado === 'todas' ? 'Todos los estados' : `Estado: ${ETIQUETA_ESTADO[filtroEstado].texto}`,
                busqueda && `Búsqueda: "${busqueda}"`,
                `${filtradas.length} de ${importaciones.length} importaciones`,
              ].filter(Boolean).join(' · '),
            }),
          }], perfil?.nombre)}
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <input
          value={busqueda}
          onChange={(e) => actualizarFiltro(setBusqueda, e.target.value)}
          placeholder="Buscar por código o proveedor..."
          className="flex-1 rounded-md border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/40 focus:border-signal"
        />
        <div className="flex rounded-md bg-stone-100 p-1 w-fit flex-wrap">
          {['todas', 'en_transito', 'parcial', 'confirmado'].map((e) => (
            <button
              key={e}
              onClick={() => actualizarFiltro(setFiltroEstado, e)}
              className={`px-3 py-1.5 text-xs font-medium rounded transition ${filtroEstado === e ? 'bg-white shadow-sm text-ink' : 'text-ink-muted'}`}
            >
              {e === 'todas' ? 'Todas' : ETIQUETA_ESTADO[e].texto}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-danger mb-4">{error}</p>}

      {cargando ? (
        <p className="text-sm text-ink-muted">Cargando...</p>
      ) : paginadas.length === 0 ? (
        <p className="text-sm text-ink-muted">No hay importaciones con esos filtros.</p>
      ) : (
        <>
          <div className="bg-white border border-line rounded-lg divide-y divide-line">
            {paginadas.map((i) => {
              const dias = i.fecha_llegada_estimada
                ? Math.ceil((new Date(i.fecha_llegada_estimada) - new Date(new Date().toDateString())) / 86400000)
                : null
              return (
                <button
                  key={i.id}
                  onClick={() => setDetalle(i)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-stone-100/60 transition"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-mono font-medium text-ink">{i.codigo}</span>
                      <span className={`text-[10px] font-mono uppercase tracking-wide px-1.5 py-0.5 rounded ${ETIQUETA_ESTADO[i.estado].color}`}>
                        {ETIQUETA_ESTADO[i.estado].texto}
                      </span>
                    </div>
                    <p className="text-xs text-ink-muted mt-0.5">
                      {i.proveedor && <>{i.proveedor} · </>}
                      {i.total_lineas} producto{i.total_lineas === 1 ? '' : 's'} · {i.total_unidades} unidades
                      {i.unidades_esperadas != null && i.unidades_esperadas !== i.total_unidades && (
                        <span className="text-signal"> de {i.unidades_esperadas} pedidas</span>
                      )}
                      {i.estado === 'confirmado' && i.ultima_recepcion ? (
                        <> · recibido {new Date(i.ultima_recepcion).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}</>
                      ) : i.fecha_llegada_estimada && (
                        <> · llega {new Date(i.fecha_llegada_estimada + 'T00:00:00').toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}</>
                      )}
                    </p>
                  </div>
                  {dias !== null && i.estado !== 'confirmado' && (
                    <span className={`text-xs font-mono shrink-0 ${dias <= 3 ? 'text-danger' : 'text-ink-muted'}`}>
                      {dias <= 0 ? 'hoy' : dias === 1 ? 'mañana' : `en ${dias} días`}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          <Paginador pagina={pagina} totalPaginas={totalPaginas} onCambiar={setPagina} />
        </>
      )}

      {detalle && (
        <ImportacionDetalle
          importacion={detalle}
          onClose={() => setDetalle(null)}
          onCambio={cargar}
        />
      )}
    </div>
  )
}