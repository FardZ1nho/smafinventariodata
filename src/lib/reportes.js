import { supabase } from './supabaseClient'
import { nombresUsuarios } from './usuarios'
import { guardarPdf, fechaCorta, fechaHora } from './pdf'
import { guardarExcel } from './excel'

// Cada reporte se describe una sola vez como "modelo" y se descarga en PDF o Excel:
// {
//   titulo, subtitulo, archivo, horizontal?,
//   datos: [[etiqueta, valor]], datosColumnas?,
//   secciones: [
//     { tipo: 'tabla', titulo?, hoja?, columnas: [{ titulo, tipo, ancho?, anchoExcel? }], filas, pie?, vacio? },
//     { tipo: 'nota', texto, color? },
//     { tipo: 'firmas', etiquetas },
//   ]
// }
// Tipos de columna: 'texto' (por defecto), 'numero', 'moneda', 'fecha' (YYYY-MM-DD), 'fechaHora'.
// Las celdas llevan el valor sin formatear: el PDF lo formatea y el Excel lo guarda como número/fecha.

export async function descargar(formato, modelo, generadoPor) {
  if (formato === 'excel') await guardarExcel(modelo, generadoPor)
  else await guardarPdf(modelo, generadoPor)
}

// Opciones de menú PDF + Excel para BotonDescarga.
// variantes: [{ etiqueta, modelo: () => Promise<modelo> }]
export function opcionesDescarga(variantes, generadoPor) {
  return ['pdf', 'excel'].flatMap((formato) =>
    variantes.map((v) => ({
      grupo: formato === 'pdf' ? 'PDF' : 'Excel',
      etiqueta: v.etiqueta,
      generar: async () => descargar(formato, await v.modelo(), generadoPor),
    }))
  )
}

const ESTADO_IMPORTACION = {
  en_transito: 'En tránsito',
  parcial: 'Parcial',
  confirmado: 'Confirmado',
  sin_movimientos: 'Sin productos',
}

const TIPO_MOVIMIENTO = { entrada: 'Entrada', salida: 'Salida', transferencia: 'Transferencia' }

// Supabase devuelve como máximo 1000 filas por consulta: se piden por tramos hasta tenerlas todas.
// `construir` debe devolver una consulta nueva cada vez (sin .range()).
export async function traerTodo(construir, maximo = 20000) {
  const tramo = 1000
  const filas = []
  for (let desde = 0; desde < maximo; desde += tramo) {
    const { data, error } = await construir().range(desde, desde + tramo - 1)
    if (error) throw error
    filas.push(...(data ?? []))
    if (!data || data.length < tramo) break
  }
  return filas
}

// ---------- Importaciones ----------

// Ficha de una importación. Su título depende del estado:
// en tránsito -> hoja para verificar al llegar; confirmada -> constancia; parcial -> ambas secciones.
export async function modeloImportacion({ importacion, lineas: todas, estado }) {
  const lineas = todas.filter((l) => !l.anulado_at)
  const nombres = await nombresUsuarios(lineas.map((l) => l.recibido_por))
  const pendientes = lineas.filter((l) => l.estado === 'en_transito')
  const recibidas = lineas.filter((l) => l.estado === 'confirmado')
  const pedido = (l) => l.cantidad_esperada ?? l.cantidad
  const suma = (lista, fn) => lista.reduce((a, l) => a + fn(l), 0)

  const titulo = estado === 'confirmado' ? 'Constancia de recepción' : estado === 'parcial' ? 'Recepción parcial' : 'Hoja de recepción'
  const secciones = []

  if (pendientes.length > 0) {
    secciones.push({
      tipo: 'tabla',
      titulo: estado === 'parcial' ? `Pendiente de recibir (${pendientes.length})` : `Productos esperados (${pendientes.length})`,
      hoja: 'Pendiente',
      columnas: [
        { titulo: '#', tipo: 'numero', ancho: 8 },
        { titulo: 'SKU', ancho: 24 },
        { titulo: 'Producto' },
        { titulo: 'Almacén destino', ancho: 32 },
        { titulo: 'Pedido', tipo: 'numero', ancho: 16 },
        { titulo: 'Unid.', ancho: 12 },
        { titulo: 'Recibido', ancho: 18 },
        { titulo: 'Observaciones', ancho: 30, anchoExcel: 30 },
      ],
      filas: pendientes.map((l, i) => [
        i + 1, l.productos?.sku || '', l.productos?.nombre ?? 'Producto eliminado', l.almacenes?.nombre ?? '',
        l.cantidad, l.productos?.unidad ?? '', '', '',
      ]),
      pie: ['', '', 'Total', '', suma(pendientes, (l) => l.cantidad), '', '', ''],
    })
  }

  if (recibidas.length > 0) {
    secciones.push({
      tipo: 'tabla',
      titulo: `Recibido (${recibidas.length})`,
      hoja: 'Recibido',
      columnas: [
        { titulo: '#', tipo: 'numero', ancho: 8 },
        { titulo: 'SKU', ancho: 22 },
        { titulo: 'Producto' },
        { titulo: 'Almacén', ancho: 26 },
        { titulo: 'Pedido', tipo: 'numero', ancho: 14 },
        { titulo: 'Recibido', tipo: 'numero', ancho: 16 },
        { titulo: 'Dif.', tipo: 'numero', ancho: 11 },
        { titulo: 'Fecha', tipo: 'fechaHora', ancho: 26 },
        { titulo: 'Recibió', ancho: 26 },
      ],
      filas: recibidas.map((l, i) => [
        i + 1, l.productos?.sku || '', l.productos?.nombre ?? 'Producto eliminado', l.almacenes?.nombre ?? '',
        pedido(l), l.cantidad, l.cantidad - pedido(l), l.recibido_at, nombres[l.recibido_por] ?? '',
      ]),
      pie: ['', '', 'Total', '', suma(recibidas, pedido), suma(recibidas, (l) => l.cantidad), suma(recibidas, (l) => l.cantidad - pedido(l)), '', ''],
    })
    if (recibidas.some((l) => l.cantidad_esperada != null)) {
      secciones.push({ tipo: 'nota', texto: 'Dif.: unidades recibidas menos unidades pedidas. Un número negativo indica faltante.', color: 'acento' })
    }
  }

  if (todas.length > lineas.length) {
    secciones.push({ tipo: 'nota', texto: `${todas.length - lineas.length} línea(s) anulada(s) no se incluyen en este documento.` })
  }

  secciones.push({
    tipo: 'firmas',
    etiquetas: estado === 'confirmado' ? ['Recibido por (almacén)', 'Revisado por'] : ['Entregado por (transportista)', 'Recibido por (almacén)'],
  })

  return {
    titulo,
    subtitulo: estado === 'confirmado'
      ? `Importación ${importacion.codigo}. Registro de la mercadería recibida en almacén.`
      : `Importación ${importacion.codigo}. Use este documento para contar la mercadería al llegar y anote las diferencias.`,
    archivo: `${titulo} ${importacion.codigo}`,
    datos: [
      ['Código', importacion.codigo],
      ['Proveedor', importacion.proveedor || '-'],
      ['Estado', ESTADO_IMPORTACION[estado] ?? estado],
      ['Llegada prevista', fechaCorta(importacion.fecha_llegada_estimada) || '-'],
      ['Última recepción', recibidas.length ? fechaHora(importacion.ultima_recepcion ?? recibidas[0].recibido_at) : 'Pendiente'],
      ['Productos', lineas.length],
      ['Unidades pedidas', suma(lineas, pedido)],
      ['Unidades recibidas', suma(recibidas, (l) => l.cantidad)],
      ['Unidades pendientes', suma(pendientes, (l) => l.cantidad)],
    ],
    secciones,
  }
}

export function modeloListadoImportaciones({ importaciones, filtros }) {
  return {
    titulo: 'Listado de importaciones',
    subtitulo: filtros,
    archivo: 'Importaciones',
    horizontal: true,
    secciones: [{
      tipo: 'tabla',
      hoja: 'Importaciones',
      columnas: [
        { titulo: 'Código', ancho: 34 },
        { titulo: 'Proveedor' },
        { titulo: 'Estado', ancho: 26 },
        { titulo: 'Productos', tipo: 'numero', ancho: 20 },
        { titulo: 'Unid. pedidas', tipo: 'numero', ancho: 24 },
        { titulo: 'Unid. recibidas', tipo: 'numero', ancho: 26 },
        { titulo: 'Llegada prevista', tipo: 'fecha', ancho: 28 },
        { titulo: 'Recibido', tipo: 'fechaHora', ancho: 32 },
      ],
      filas: importaciones.map((i) => [
        i.codigo,
        i.proveedor || '',
        ESTADO_IMPORTACION[i.estado] ?? i.estado,
        i.total_lineas,
        i.unidades_esperadas ?? i.total_unidades,
        i.estado === 'en_transito' ? 0 : i.total_unidades,
        i.fecha_llegada_estimada,
        i.ultima_recepcion,
      ]),
      pie: ['Total', `${importaciones.length} importaciones`, '', importaciones.reduce((a, i) => a + i.total_lineas, 0), '', '', '', ''],
      vacio: 'No hay importaciones con esos filtros.',
    }],
  }
}

// ---------- Inventario ----------

// productos: la lista ya filtrada en pantalla. almacen: null para todos, o { id, nombre }.
export async function modeloInventario({ productos, categorias, almacenes, almacen, filtros }) {
  const [stock, kits] = await Promise.all([
    traerTodo(() => supabase.from('stock_almacen').select('producto_id, almacen_id, cantidad').order('id')),
    traerTodo(() => supabase.from('kits_disponibilidad').select('kit_id, almacen_id, disponible').order('kit_id').order('almacen_id')),
  ])

  const idsActivos = new Set(almacenes.map((a) => a.id))
  // stockDe[producto][almacen] = cantidad (para kits, unidades que se pueden armar)
  const stockDe = {}
  stock.forEach((s) => { (stockDe[s.producto_id] ??= {})[s.almacen_id] = s.cantidad })
  kits.forEach((k) => { (stockDe[k.kit_id] ??= {})[k.almacen_id] = Number(k.disponible) })

  const nombreCategoria = Object.fromEntries(categorias.map((c) => [c.id, c.nombre]))
  const cantidadEn = (p, almacenId) => stockDe[p.id]?.[almacenId] ?? 0
  const totalDe = (p) => Object.values(stockDe[p.id] ?? {}).reduce((a, c) => a + c, 0)
  const inactivosDe = (p) => Object.entries(stockDe[p.id] ?? {}).filter(([id]) => !idsActivos.has(id)).reduce((a, [, c]) => a + c, 0)
  const hayInactivos = !almacen && productos.some((p) => p.tipo !== 'kit' && inactivosDe(p) !== 0)

  const filas = productos.map((p) => {
    const esKit = p.tipo === 'kit'
    const stockReporte = almacen ? cantidadEn(p, almacen.id) : esKit ? almacenes.reduce((a, al) => a + cantidadEn(p, al.id), 0) : totalDe(p)
    const costo = Number(p.precio_compra || 0)
    const estado = stockReporte <= 0 ? 'Sin stock' : stockReporte <= p.stock_minimo ? 'Bajo' : ''
    return { p, esKit, stockReporte, costo, estado, valor: esKit ? null : stockReporte * costo }
  })

  const titulo = almacen ? `Inventario: ${almacen.nombre}` : 'Inventario por almacén'
  const valorTotal = filas.reduce((a, f) => a + (f.valor ?? 0), 0)
  const columnasAlmacen = almacen ? [] : almacenes.map((a) => ({ titulo: a.nombre, tipo: 'numero' }))

  return {
    titulo,
    subtitulo: filtros,
    archivo: titulo,
    horizontal: !almacen,
    datosColumnas: 5,
    datos: [
      ['Productos listados', filas.length],
      ['Sin stock', filas.filter((f) => f.estado === 'Sin stock').length],
      ['Stock bajo', filas.filter((f) => f.estado === 'Bajo').length],
      ['Valor a costo', `S/ ${valorTotal.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
      ['Con stock sin costo', filas.filter((f) => !f.esKit && f.stockReporte > 0 && !(f.costo > 0)).length],
    ],
    secciones: [
      {
        tipo: 'tabla',
        hoja: 'Inventario',
        columnas: [
          { titulo: 'SKU', ancho: 22 },
          { titulo: 'Producto' },
          { titulo: 'Tipo', ancho: 14 },
          { titulo: 'Categoría', ancho: 26 },
          ...columnasAlmacen,
          ...(hayInactivos ? [{ titulo: 'Alm. inactivos', tipo: 'numero' }] : []),
          { titulo: almacen ? 'Stock' : 'Total', tipo: 'numero', ancho: 16 },
          { titulo: 'Unid.', ancho: 12 },
          { titulo: 'Mín.', tipo: 'numero', ancho: 12 },
          { titulo: 'Estado', ancho: 17 },
          { titulo: 'Costo unit.', tipo: 'moneda', ancho: 22 },
          { titulo: 'Valor a costo', tipo: 'moneda', ancho: 26 },
        ],
        filas: filas.map(({ p, esKit, stockReporte, costo, estado, valor }) => [
          p.sku || '',
          p.nombre,
          esKit ? 'Kit' : 'Simple',
          nombreCategoria[p.categoria_id] ?? '',
          ...(almacen ? [] : almacenes.map((a) => cantidadEn(p, a.id))),
          ...(hayInactivos ? [esKit ? 0 : inactivosDe(p)] : []),
          stockReporte,
          p.unidad ?? '',
          Number(p.stock_minimo ?? 0),
          estado,
          esKit ? '' : costo > 0 ? costo : 'Sin costo',
          valor,
        ]),
        pie: [
          'Total', `${filas.length} productos`, '', '',
          ...columnasAlmacen.map(() => ''),
          ...(hayInactivos ? [''] : []),
          '', '', '', '', '', valorTotal,
        ],
        vacio: 'No hay productos con esos filtros.',
      },
      {
        tipo: 'nota',
        texto: 'Valor a costo = stock x precio de compra, solo productos simples. Los kits muestran cuántas unidades se pueden armar con las piezas disponibles y no se suman al valor, para no contar dos veces las piezas.',
      },
    ],
  }
}

// ---------- Movimientos ----------

// construirConsulta: devuelve la consulta del historial con los filtros de pantalla (sin paginar)
export async function modeloMovimientos({ construirConsulta, filtros }) {
  const maximo = 10000
  const movimientos = await traerTodo(construirConsulta, maximo)
  const nombres = await nombresUsuarios(movimientos.flatMap((m) => [m.usuario_id, m.anulado_por]))
  const vigentes = movimientos.filter((m) => !m.anulado_at && m.estado !== 'en_transito')
  const suma = (tipo) => vigentes.filter((m) => m.tipo === tipo).reduce((a, m) => a + m.cantidad, 0)
  const anulados = movimientos.filter((m) => m.anulado_at).length

  const secciones = []
  if (movimientos.length >= maximo) {
    secciones.push({ tipo: 'nota', texto: `Se muestran los ${maximo} movimientos más recientes. Use filtros de fecha para acotar el reporte.`, color: 'acento' })
  }
  secciones.push({
    tipo: 'tabla',
    hoja: 'Movimientos',
    columnas: [
      { titulo: 'Fecha', tipo: 'fechaHora', ancho: 26 },
      { titulo: 'Tipo', ancho: 22 },
      { titulo: 'Estado', ancho: 20 },
      { titulo: 'SKU', ancho: 20 },
      { titulo: 'Producto' },
      { titulo: 'Cant.', tipo: 'numero', ancho: 14 },
      { titulo: 'Almacén', ancho: 38 },
      { titulo: 'Motivo / referencia', ancho: 44 },
      { titulo: 'Usuario', ancho: 26 },
    ],
    filas: movimientos.map((m) => {
      const signo = m.tipo === 'salida' ? -1 : 1
      const referencia = [
        m.motivo,
        m.numero_comprobante && `Comp. ${m.numero_comprobante}`,
        m.importaciones?.codigo && `Imp. ${m.importaciones.codigo}`,
        m.cantidad_esperada != null && `Pedido ${m.cantidad_esperada}`,
        m.anulado_at && `Anulado por ${nombres[m.anulado_por] ?? '?'}: ${m.motivo_anulacion ?? ''}`,
      ].filter(Boolean).join(' · ')
      return [
        m.created_at,
        TIPO_MOVIMIENTO[m.tipo] ?? m.tipo,
        m.anulado_at ? 'ANULADO' : m.estado === 'en_transito' ? 'En tránsito' : 'Confirmado',
        m.productos?.sku || '',
        m.productos?.nombre ?? 'Producto eliminado',
        m.tipo === 'transferencia' ? m.cantidad : signo * m.cantidad,
        m.tipo === 'transferencia' ? `${m.origen?.nombre ?? '?'} a ${m.destino?.nombre ?? '?'}` : (m.almacenes?.nombre ?? ''),
        referencia,
        nombres[m.usuario_id] ?? '',
      ]
    }),
    vacio: 'No hay movimientos con esos filtros.',
  })
  if (anulados > 0) {
    secciones.push({ tipo: 'nota', texto: `${anulados} movimiento(s) anulado(s) aparecen en la lista pero no se suman en los totales.` })
  }

  return {
    titulo: 'Historial de movimientos',
    subtitulo: filtros,
    archivo: 'Movimientos',
    horizontal: true,
    datosColumnas: 5,
    datos: [
      ['Movimientos', movimientos.length],
      ['Unidades que entraron', suma('entrada')],
      ['Unidades que salieron', suma('salida')],
      ['Unidades transferidas', suma('transferencia')],
      ['Anulados', anulados],
    ],
    secciones,
  }
}

// ---------- Ficha de producto ----------

export function modeloProducto({ producto, categoria, stockPorAlmacen, disponibilidadKit, componentes, movimientos }) {
  const esKit = producto.tipo === 'kit'
  const total = esKit
    ? disponibilidadKit.reduce((a, d) => a + Number(d.disponible), 0)
    : stockPorAlmacen.reduce((a, s) => a + s.cantidad, 0)
  const soles = (v) => `S/ ${Number(v || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const secciones = esKit
    ? [
        {
          tipo: 'tabla', titulo: 'Disponible por almacén', hoja: 'Disponible',
          columnas: [{ titulo: 'Almacén' }, { titulo: 'Disponible', tipo: 'numero', ancho: 30 }],
          filas: disponibilidadKit.map((d) => [`${d.almacen_nombre}${d.inactivo ? ' (inactivo)' : ''}`, Number(d.disponible)]),
        },
        {
          tipo: 'tabla', titulo: 'Componentes del kit', hoja: 'Componentes',
          columnas: [{ titulo: 'Pieza' }, { titulo: 'Cantidad por kit', tipo: 'numero', ancho: 34 }, { titulo: 'Unid.', ancho: 16 }],
          filas: componentes.map((c) => [c.productos?.nombre ?? '', c.cantidad, c.productos?.unidad ?? '']),
        },
      ]
    : [{
        tipo: 'tabla', titulo: 'Stock por almacén', hoja: 'Stock',
        columnas: [{ titulo: 'Almacén' }, { titulo: 'Cantidad', tipo: 'numero', ancho: 30 }],
        filas: stockPorAlmacen.map((s) => [`${s.almacenes?.nombre ?? ''}${s.almacenes?.activo === false ? ' (inactivo)' : ''}`, s.cantidad]),
        pie: ['Total', total],
        vacio: 'Sin stock registrado.',
      }]

  secciones.push({
    tipo: 'tabla',
    titulo: `Últimos movimientos (${movimientos.length})`,
    hoja: 'Movimientos',
    columnas: [
      { titulo: 'Fecha', tipo: 'fechaHora', ancho: 28 },
      { titulo: 'Tipo', ancho: 30 },
      { titulo: 'Almacén' },
      { titulo: 'Cant.', tipo: 'numero', ancho: 16 },
      { titulo: 'Motivo', ancho: 46 },
    ],
    filas: movimientos.map((m) => [
      m.created_at,
      `${TIPO_MOVIMIENTO[m.tipo] ?? m.tipo}${m.anulado_at ? ' (ANULADO)' : m.estado === 'en_transito' ? ' (tránsito)' : ''}`,
      m.tipo === 'transferencia' ? `${m.origen?.nombre ?? '?'} a ${m.destino?.nombre ?? '?'}` : (m.almacenes?.nombre ?? ''),
      m.tipo === 'salida' ? -m.cantidad : m.cantidad,
      [m.motivo, m.numero_comprobante].filter(Boolean).join(' · '),
    ]),
    vacio: 'Sin movimientos registrados.',
  })

  return {
    titulo: producto.nombre,
    subtitulo: `Ficha de ${esKit ? 'kit' : 'producto'}${producto.sku ? ` · SKU ${producto.sku}` : ''}`,
    archivo: `Ficha ${producto.sku || producto.nombre}`,
    datos: [
      ['SKU', producto.sku || '-'],
      ['Categoría', categoria?.nombre || 'Sin categoría'],
      ['Unidad', producto.unidad || '-'],
      ['Precio compra', Number(producto.precio_compra) > 0 ? soles(producto.precio_compra) : 'Sin costo'],
      ['Precio venta', soles(producto.precio_venta)],
      ['Stock mínimo', Number(producto.stock_minimo ?? 0)],
      [esKit ? 'Disponible para armar' : 'Stock total', total],
      ...(esKit ? [] : [['Valor a costo', soles(total * Number(producto.precio_compra || 0))]]),
    ],
    secciones,
  }
}

// ---------- Calidad de datos ----------

// problemas: [{ titulo, productos, detalle?: (p) => texto }] calculados en la página de Calidad
export function modeloCalidad({ problemas, categorias }) {
  const nombreCategoria = Object.fromEntries(categorias.map((c) => [c.id, c.nombre]))
  return {
    titulo: 'Revisión de calidad de datos',
    subtitulo: 'Productos activos con datos faltantes o inconsistentes.',
    archivo: 'Calidad de datos',
    datos: problemas.map((p) => [p.titulo, p.productos.length]),
    secciones: problemas.filter((p) => p.productos.length > 0).map((p) => ({
      tipo: 'tabla',
      titulo: `${p.titulo} (${p.productos.length})`,
      hoja: p.titulo,
      columnas: [
        { titulo: 'SKU', ancho: 26 },
        { titulo: 'Producto' },
        { titulo: 'Categoría', ancho: 34 },
        { titulo: 'Detalle', ancho: 50 },
      ],
      filas: p.productos.map((prod) => [prod.sku || '', prod.nombre, nombreCategoria[prod.categoria_id] ?? '', p.detalle?.(prod) ?? '']),
    })),
  }
}
