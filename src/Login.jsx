import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function Resumen() {
  const [stats, setStats] = useState(null)
  const [alertas, setAlertas] = useState([])
  const [transito, setTransito] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    async function cargar() {
      const [{ data: productos }, { data: totales }, { data: kits }, { data: enTransito }] = await Promise.all([
        supabase.from('productos').select('*').eq('activo', true),
        supabase.from('stock_total_producto').select('*'),
        supabase.from('kits_disponibilidad').select('*'),
        supabase.from('movimientos').select('*, productos(nombre, unidad), almacenes:almacen_id(nombre)').eq('estado', 'en_transito'),
      ])

      const mapaTotales = {}
      ;(totales ?? []).forEach((t) => { mapaTotales[t.producto_id] = t.stock_total })

      const simples = (productos ?? []).filter((p) => p.tipo === 'simple')
      const bajos = simples.filter((p) => (mapaTotales[p.id] ?? 0) <= p.stock_minimo)

      const mapaKits = {}
      ;(kits ?? []).forEach((k) => { mapaKits[k.kit_id] = (mapaKits[k.kit_id] ?? 0) + k.disponible })
      const kitsAgotados = (productos ?? []).filter((p) => p.tipo === 'kit' && (mapaKits[p.id] ?? 0) <= 0)

      setStats({
        totalProductos: (productos ?? []).length,
        totalKits: (productos ?? []).filter((p) => p.tipo === 'kit').length,
        stockBajo: bajos.length,
        valorInventario: simples.reduce((acc, p) => acc + (mapaTotales[p.id] ?? 0) * Number(p.precio_venta || 0), 0),
      })
      setAlertas([
        ...bajos.map((p) => ({ nombre: p.nombre, detalle: `${mapaTotales[p.id] ?? 0} ${p.unidad} (mínimo ${p.stock_minimo})` })),
        ...kitsAgotados.map((p) => ({ nombre: p.nombre, detalle: 'No se puede armar ninguno' })),
      ])
      const transitoOrdenado = [...(enTransito ?? [])].sort((a, b) => {
        if (!a.fecha_llegada_estimada) return 1
        if (!b.fecha_llegada_estimada) return -1
        return new Date(a.fecha_llegada_estimada) - new Date(b.fecha_llegada_estimada)
      })

      setTransito(transitoOrdenado)
      setCargando(false)
    }
    cargar()
  }, [])

  if (cargando) return <p className="text-sm text-ink-muted">Cargando...</p>

  return (
    <div>
      <h2 className="text-2xl font-semibold text-ink mb-1">Resumen</h2>
      <p className="text-sm text-ink-muted mb-6">Vista general de tu inventario.</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <Tarjeta label="Productos" valor={stats.totalProductos} />
        <Tarjeta label="Kits" valor={stats.totalKits} />
        <Tarjeta label="Stock bajo" valor={stats.stockBajo} resaltar={stats.stockBajo > 0} />
        <Tarjeta label="Valor inventario" valor={`S/ ${stats.valorInventario.toFixed(2)}`} />
      </div>

      {transito.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-ink-muted uppercase tracking-wide">En tránsito</h3>
            <Link to="/movimientos" className="text-xs font-medium text-signal hover:underline">Ver movimientos →</Link>
          </div>
          <div className="bg-white border border-line rounded-lg divide-y divide-line">
            {transito.map((m) => {
              const dias = m.fecha_llegada_estimada
                ? Math.ceil((new Date(m.fecha_llegada_estimada) - new Date(new Date().toDateString())) / 86400000)
                : null
              return (
                <div key={m.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-ink">{m.productos?.nombre}</p>
                    <p className="text-xs text-ink-muted">
                      Destino: {m.almacenes?.nombre}
                      {m.fecha_llegada_estimada && (
                        <> · llega {new Date(m.fecha_llegada_estimada + 'T00:00:00').toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}</>
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-sm text-signal block">+{m.cantidad}</span>
                    {dias !== null && (
                      <span className={`text-[10px] font-mono ${dias <= 3 ? 'text-danger' : 'text-ink-muted'}`}>
                        {dias <= 0 ? 'hoy' : dias === 1 ? 'mañana' : `en ${dias} días`}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-ink-muted uppercase tracking-wide">Alertas de stock</h3>
        <Link to="/productos" className="text-xs font-medium text-signal hover:underline">Ver productos →</Link>
      </div>

      {alertas.length === 0 ? (
        <div className="bg-white border border-line rounded-lg px-4 py-6 text-center">
          <p className="text-sm text-ink-muted">Todo en orden. Ningún producto está por debajo de su stock mínimo.</p>
        </div>
      ) : (
        <div className="bg-white border border-line rounded-lg divide-y divide-line">
          {alertas.map((a, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3">
              <span className="text-sm font-medium text-ink">{a.nombre}</span>
              <span className="font-mono text-xs text-danger">{a.detalle}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Tarjeta({ label, valor, resaltar }) {
  return (
    <div className="bg-white border border-line rounded-lg p-4">
      <p className="text-xs text-ink-muted uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-semibold font-mono ${resaltar ? 'text-danger' : 'text-ink'}`}>{valor}</p>
    </div>
  )
}
