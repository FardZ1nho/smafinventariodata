import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import Paginador from '../components/Paginador'

const POR_PAGINA_ALERTAS = 10

export default function Resumen() {
  const [stats, setStats] = useState(null)
  const [alertas, setAlertas] = useState([])
  const [transito, setTransito] = useState([])
  const [cargando, setCargando] = useState(true)
  const [paginaAlertas, setPaginaAlertas] = useState(1)

  useEffect(() => {
    async function cargar() {
      const [{ data: productos }, { data: totales }, { data: kits }, { data: importacionesPendientes }] = await Promise.all([
        supabase.from('productos').select('*').eq('activo', true),
        supabase.from('stock_total_producto').select('*'),
        supabase.from('kits_disponibilidad').select('*'),
        supabase.from('importaciones_resumen').select('*').in('estado', ['en_transito', 'parcial']),
      ])

      const mapaTotales = {}
      ;(totales ?? []).forEach((t) => { mapaTotales[t.producto_id] = t.stock_total })

      const mapaKits = {}
      ;(kits ?? []).forEach((k) => { mapaKits[k.kit_id] = (mapaKits[k.kit_id] ?? 0) + k.disponible })

      // Para cada producto (simple o kit) calculamos su stock y lo clasificamos:
      // sin_stock (0), stock_bajo (entre 1 y el mínimo), o normal (no genera alerta)
      const conEstado = (productos ?? []).map((p) => {
        const stock = p.tipo === 'kit' ? (mapaKits[p.id] ?? 0) : (mapaTotales[p.id] ?? 0)
        const sinStock = stock <= 0
        const stockBajo = !sinStock && stock <= p.stock_minimo
        return { producto: p, stock, sinStock, stockBajo }
      })

      const sinStock = conEstado.filter((c) => c.sinStock)
      const stockBajo = conEstado.filter((c) => c.stockBajo)

      // Valorización: solo productos simples (los kits no tienen stock propio, contarlos duplicaría piezas).
      // Se valoriza a precio de compra; los que tienen stock pero costo 0 se informan aparte.
      const simplesConStock = (productos ?? []).filter((p) => p.tipo === 'simple' && (mapaTotales[p.id] ?? 0) > 0)

      setStats({
        totalProductos: (productos ?? []).length,
        totalKits: (productos ?? []).filter((p) => p.tipo === 'kit').length,
        sinStock: sinStock.length,
        stockBajo: stockBajo.length,
        valorCosto: simplesConStock.reduce((acc, p) => acc + mapaTotales[p.id] * Number(p.precio_compra || 0), 0),
        valorVenta: simplesConStock.reduce((acc, p) => acc + mapaTotales[p.id] * Number(p.precio_venta || 0), 0),
        sinCosto: simplesConStock.filter((p) => !(Number(p.precio_compra) > 0)).length,
      })

      // Sin stock primero (más crítico), luego stock bajo
      setAlertas([
        ...sinStock.map((c) => ({
          tipo: 'sin_stock',
          id: c.producto.id,
          nombre: c.producto.nombre,
          detalle: c.producto.tipo === 'kit' ? 'No se puede armar ninguno' : '0 en stock',
        })),
        ...stockBajo.map((c) => ({
          tipo: 'stock_bajo',
          id: c.producto.id,
          nombre: c.producto.nombre,
          detalle: `${c.stock} ${c.producto.unidad} (mínimo ${c.producto.stock_minimo})`,
        })),
      ])

      const transitoOrdenado = [...(importacionesPendientes ?? [])].sort((a, b) => {
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

  const totalPaginasAlertas = Math.max(1, Math.ceil(alertas.length / POR_PAGINA_ALERTAS))
  const alertasPaginadas = alertas.slice((paginaAlertas - 1) * POR_PAGINA_ALERTAS, paginaAlertas * POR_PAGINA_ALERTAS)

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-ink mb-1">Resumen</h2>
          <p className="text-sm text-ink-muted">Vista general de tu inventario.</p>
        </div>
        <Link to="/calidad" className="text-xs font-medium text-signal hover:underline whitespace-nowrap mt-1">
          Revisar calidad de datos →
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
        <Tarjeta label="Productos" valor={stats.totalProductos} to="/productos" />
        <Tarjeta label="Kits" valor={stats.totalKits} to="/productos?filtro=kit" />
        <Tarjeta label="Sin stock" valor={stats.sinStock} resaltar={stats.sinStock > 0} critico to="/productos?filtro=sin_stock" />
        <Tarjeta label="Stock bajo" valor={stats.stockBajo} resaltar={stats.stockBajo > 0} to="/productos?filtro=stock_bajo" />
        <Tarjeta
          label="Valor a costo"
          valor={`S/ ${stats.valorCosto.toFixed(2)}`}
          nota={
            <>
              A precio de venta: S/ {stats.valorVenta.toFixed(2)}
              {stats.sinCosto > 0 && (
                <span className="block text-signal">{stats.sinCosto} con stock sin precio de compra</span>
              )}
            </>
          }
        />
      </div>

      {transito.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-ink-muted uppercase tracking-wide">Importaciones en camino</h3>
            <Link to="/importaciones" className="text-xs font-medium text-signal hover:underline">Ver todas →</Link>
          </div>
          <div className="bg-white border border-line rounded-lg divide-y divide-line">
            {transito.map((i) => {
              const dias = i.fecha_llegada_estimada
                ? Math.ceil((new Date(i.fecha_llegada_estimada) - new Date(new Date().toDateString())) / 86400000)
                : null
              return (
                <Link key={i.id} to="/importaciones" className="flex items-center justify-between px-4 py-3 hover:bg-stone-100/60 transition">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-mono font-medium text-ink">{i.codigo}</p>
                      {i.estado === 'parcial' && (
                        <span className="text-[10px] font-mono uppercase tracking-wide bg-signal/10 text-signal px-1.5 py-0.5 rounded">parcial</span>
                      )}
                    </div>
                    <p className="text-xs text-ink-muted">
                      {i.proveedor && <>{i.proveedor} · </>}
                      {i.total_lineas} producto{i.total_lineas === 1 ? '' : 's'}
                      {i.fecha_llegada_estimada && (
                        <> · llega {new Date(i.fecha_llegada_estimada + 'T00:00:00').toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}</>
                      )}
                    </p>
                  </div>
                  {dias !== null && (
                    <span className={`text-[10px] font-mono ${dias <= 3 ? 'text-danger' : 'text-ink-muted'}`}>
                      {dias <= 0 ? 'hoy' : dias === 1 ? 'mañana' : `en ${dias} días`}
                    </span>
                  )}
                </Link>
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
          <p className="text-sm text-ink-muted">Todo en orden. Ningún producto está sin stock o por debajo de su mínimo.</p>
        </div>
      ) : (
        <>
          <div className="bg-white border border-line rounded-lg divide-y divide-line">
            {alertasPaginadas.map((a, i) => (
              <Link key={i} to={`/productos?ver=${a.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-stone-100/60 transition">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`text-[10px] font-mono uppercase tracking-wide px-1.5 py-0.5 rounded ${
                    a.tipo === 'sin_stock' ? 'bg-danger/10 text-danger' : 'bg-signal/10 text-signal'
                  }`}>
                    {a.tipo === 'sin_stock' ? 'sin stock' : 'stock bajo'}
                  </span>
                  <span className="text-sm font-medium text-ink truncate">{a.nombre}</span>
                </div>
                <span className={`font-mono text-xs shrink-0 ${a.tipo === 'sin_stock' ? 'text-danger' : 'text-signal'}`}>
                  {a.detalle}
                </span>
              </Link>
            ))}
          </div>
          <Paginador pagina={paginaAlertas} totalPaginas={totalPaginasAlertas} onCambiar={setPaginaAlertas} />
        </>
      )}
    </div>
  )
}

function Tarjeta({ label, valor, resaltar, critico, nota, to }) {
  const Contenedor = to ? Link : 'div'
  return (
    <Contenedor {...(to ? { to } : {})} className={`block bg-white border border-line rounded-lg p-4 ${to ? 'hover:border-ink-muted/40 hover:shadow-sm transition' : ''}`}>
      <p className="text-xs text-ink-muted uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-semibold font-mono ${resaltar ? (critico ? 'text-danger' : 'text-signal') : 'text-ink'}`}>
        {valor}
      </p>
      {nota && <p className="text-[11px] text-ink-muted mt-1">{nota}</p>}
    </Contenedor>
  )
}