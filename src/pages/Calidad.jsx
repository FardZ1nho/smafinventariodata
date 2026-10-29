import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { modeloCalidad, opcionesDescarga, traerTodo } from '../lib/reportes'
import BotonDescarga from '../components/BotonDescarga'
import ProductoForm from '../components/ProductoForm'

const POR_SECCION = 8

// Para comparar nombres/SKU sin que importen mayúsculas, tildes ni espacios de más
function normalizar(texto) {
  return (texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

function repetidos(productos, clave) {
  const grupos = {}
  productos.forEach((p) => {
    const k = clave(p)
    if (k) (grupos[k] ??= []).push(p)
  })
  return Object.values(grupos).filter((g) => g.length > 1).flat()
}

const soles = (v) => `S/ ${Number(v || 0).toFixed(2)}`

export default function Calidad() {
  const { perfil } = useAuth()
  const [productos, setProductos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [stock, setStock] = useState({}) // producto_id -> stock total
  const [kitsConPiezas, setKitsConPiezas] = useState(new Set())
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [abiertos, setAbiertos] = useState({}) // titulo -> mostrar todos
  const [productoEditar, setProductoEditar] = useState(null)

  async function cargar() {
    setCargando(true)
    try {
      const [prods, { data: cats }, totales, componentes] = await Promise.all([
        traerTodo(() => supabase.from('productos').select('*').eq('activo', true).order('nombre')),
        supabase.from('categorias').select('*').order('nombre'),
        traerTodo(() => supabase.from('stock_total_producto').select('*').order('producto_id')),
        traerTodo(() => supabase.from('producto_componentes').select('kit_id').order('kit_id')),
      ])
      setProductos(prods)
      setCategorias(cats ?? [])
      setStock(Object.fromEntries(totales.map((t) => [t.producto_id, Number(t.stock_total)])))
      setKitsConPiezas(new Set(componentes.map((c) => c.kit_id)))
    } catch (e) {
      setError(e.message)
    }
    setCargando(false)
  }

  useEffect(() => { cargar() }, [])

  const simples = productos.filter((p) => p.tipo === 'simple')
  const stockDe = (p) => stock[p.id] ?? 0
  const sinCosto = simples
    .filter((p) => !(Number(p.precio_compra) > 0))
    .sort((a, b) => stockDe(b) - stockDe(a))
  const skuRepetido = new Set(repetidos(productos, (p) => normalizar(p.sku)).map((p) => p.id))

  // Cada revisión: qué falta, por qué importa y qué producto lo tiene
  const problemas = [
    {
      titulo: 'Sin precio de compra',
      porque: 'El valor del inventario a costo los cuenta como S/ 0. Los primeros tienen stock: son los más importantes.',
      productos: sinCosto,
      detalle: (p) => `${stockDe(p)} ${p.unidad ?? ''} en stock`,
      grave: true,
    },
    {
      titulo: 'SKU repetido',
      porque: 'Dos productos con el mismo código se confunden al buscar y al registrar movimientos.',
      productos: productos.filter((p) => skuRepetido.has(p.id)).sort((a, b) => normalizar(a.sku).localeCompare(normalizar(b.sku))),
      detalle: (p) => `SKU ${p.sku}`,
      grave: true,
    },
    {
      titulo: 'Nombre repetido',
      porque: 'Pueden ser el mismo producto registrado dos veces, con el stock repartido entre ambos.',
      productos: repetidos(productos, (p) => normalizar(p.nombre)).sort((a, b) => normalizar(a.nombre).localeCompare(normalizar(b.nombre))),
      detalle: (p) => `${p.sku ? `SKU ${p.sku} · ` : ''}${stockDe(p)} en stock`,
      grave: true,
    },
    {
      titulo: 'Kit sin piezas',
      porque: 'Un kit sin componentes nunca tiene disponibilidad.',
      productos: productos.filter((p) => p.tipo === 'kit' && !kitsConPiezas.has(p.id)),
      grave: true,
    },
    {
      titulo: 'Precio de venta menor al de compra',
      porque: 'Puede ser un error de digitación: cada venta sería a pérdida.',
      productos: simples.filter((p) => Number(p.precio_compra) > 0 && Number(p.precio_venta) > 0 && Number(p.precio_venta) < Number(p.precio_compra)),
      detalle: (p) => `Compra ${soles(p.precio_compra)} · Venta ${soles(p.precio_venta)}`,
    },
    {
      titulo: 'Sin precio de venta',
      porque: 'No se puede saber el margen ni el valor a precio de venta.',
      productos: productos.filter((p) => !(Number(p.precio_venta) > 0)),
    },
    {
      titulo: 'Sin SKU',
      porque: 'Sin código es más difícil buscarlo y distinguirlo de productos parecidos.',
      productos: productos.filter((p) => !p.sku?.trim()),
    },
    {
      titulo: 'Sin categoría',
      porque: 'No aparece al filtrar por categoría ni en los reportes agrupados.',
      productos: productos.filter((p) => !p.categoria_id),
    },
    {
      titulo: 'Sin unidad',
      porque: 'Las cantidades se muestran sin saber si son unidades, metros, cajas, etc.',
      productos: productos.filter((p) => !p.unidad?.trim()),
    },
  ]

  const totalProblemas = problemas.reduce((a, p) => a + p.productos.length, 0)
  const productosConProblemas = new Set(problemas.flatMap((p) => p.productos.map((x) => x.id))).size

  return (
    <div className="max-w-3xl">
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-ink mb-1">Calidad de datos</h2>
          <p className="text-sm text-ink-muted">
            Productos activos con datos faltantes o que conviene revisar. Corrígelos con <strong>Editar</strong>.
          </p>
        </div>
        {!cargando && (
          <BotonDescarga
            opciones={opcionesDescarga([{ etiqueta: 'Revisión completa', modelo: async () => modeloCalidad({ problemas, categorias }) }], perfil?.nombre)}
          />
        )}
      </div>

      {error && <p className="text-sm text-danger mb-4">{error}</p>}

      {cargando ? (
        <p className="text-sm text-ink-muted">Revisando {productos.length || ''} productos...</p>
      ) : (
        <>
          <div className="bg-white border border-line rounded-lg p-4 mb-6">
            <p className="text-sm text-ink">
              {totalProblemas === 0
                ? 'Todo en orden: no se encontraron problemas en los productos activos.'
                : <><strong>{productosConProblemas}</strong> de {productos.length} productos tienen al menos un punto por revisar.</>}
            </p>
          </div>

          <div className="space-y-4">
            {problemas.map((p) => {
              const verTodos = abiertos[p.titulo]
              const visibles = verTodos ? p.productos : p.productos.slice(0, POR_SECCION)
              return (
                <section key={p.titulo} className="bg-white border border-line rounded-lg">
                  <div className="px-4 py-3 border-b border-line flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-ink">{p.titulo}</h3>
                      <p className="text-xs text-ink-muted">{p.porque}</p>
                    </div>
                    <span className={`text-xs font-mono px-2 py-0.5 rounded shrink-0 ${
                      p.productos.length === 0 ? 'bg-success/10 text-success' : p.grave ? 'bg-danger/10 text-danger' : 'bg-signal/10 text-signal'
                    }`}>
                      {p.productos.length === 0 ? 'OK' : p.productos.length}
                    </span>
                  </div>
                  {p.productos.length > 0 && (
                    <ul className="divide-y divide-line">
                      {visibles.map((prod) => (
                        <li key={prod.id} className="flex items-center justify-between gap-3 px-4 py-2">
                          <div className="min-w-0">
                            <p className="text-sm text-ink truncate">{prod.nombre}</p>
                            <p className="text-[11px] text-ink-muted">
                              {p.detalle ? p.detalle(prod) : prod.sku ? `SKU ${prod.sku}` : 'Sin SKU'}
                            </p>
                          </div>
                          <button
                            onClick={() => setProductoEditar(prod)}
                            className="text-xs font-medium text-signal hover:underline shrink-0"
                          >
                            Editar
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {p.productos.length > POR_SECCION && (
                    <button
                      onClick={() => setAbiertos({ ...abiertos, [p.titulo]: !verTodos })}
                      className="w-full px-4 py-2 text-xs font-medium text-ink-muted hover:bg-stone-100 border-t border-line"
                    >
                      {verTodos ? 'Ver menos' : `Ver los ${p.productos.length}`}
                    </button>
                  )}
                </section>
              )
            })}
          </div>
        </>
      )}

      {productoEditar && (
        <ProductoForm
          producto={productoEditar}
          categorias={categorias}
          productosSimples={simples}
          onClose={() => setProductoEditar(null)}
          onSaved={() => { setProductoEditar(null); cargar() }}
        />
      )}
    </div>
  )
}
