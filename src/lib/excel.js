// Exportación a Excel (.xlsx). La librería se carga solo al descargar.
// Recibe el mismo "modelo" de reporte que el PDF (ver reportes.js):
//   * Hoja "Resumen": título, filtros, datos clave y notas.
//   * Una hoja por cada tabla, con encabezado fijo y valores con tipo (número, moneda, fecha)
//     para que se puedan sumar, ordenar y filtrar en Excel.

import { nombreArchivo } from './pdf'

const ENCABEZADO = { fontWeight: 'bold', backgroundColor: '#24211C', color: '#FFFFFF' }
const PIE = { fontWeight: 'bold', backgroundColor: '#F2F0EA' }

// write-excel-file convierte las fechas como si fueran UTC: se corrige a la hora local
// para que Excel muestre la misma hora que la app.
function fechaLocal(valor) {
  const fecha = new Date(valor)
  return new Date(fecha.getTime() - fecha.getTimezoneOffset() * 60000)
}

function fechaSinHora(valor) {
  const [anio, mes, dia] = String(valor).slice(0, 10).split('-').map(Number)
  return new Date(Date.UTC(anio, mes - 1, dia))
}

function celda(valor, tipo, estilo = {}) {
  if (valor === null || valor === undefined || valor === '') return { value: null, ...estilo }
  switch (tipo) {
    case 'numero':
      return typeof valor === 'number' ? { value: valor, type: Number, ...estilo } : { value: String(valor), ...estilo }
    case 'moneda':
      return typeof valor === 'number' ? { value: valor, type: Number, format: '#,##0.00', ...estilo } : { value: String(valor), ...estilo }
    case 'fechaHora':
      return { value: fechaLocal(valor), type: Date, format: 'dd/mm/yyyy hh:mm', ...estilo }
    case 'fecha':
      return { value: fechaSinHora(valor), type: Date, format: 'dd/mm/yyyy', ...estilo }
    default:
      // '@' = texto: evita que Excel convierta SKU como "00123" en número
      return { value: String(valor), type: String, format: '@', ...estilo }
  }
}

function anchoColumna(columna, filas, indice) {
  if (columna.anchoExcel) return columna.anchoExcel
  if (columna.tipo === 'fechaHora') return 17
  if (columna.tipo === 'fecha') return 12
  if (columna.tipo === 'moneda') return 14
  const largoMaximo = Math.max(columna.titulo.length, ...filas.slice(0, 200).map((f) => String(f[indice] ?? '').length))
  return Math.min(Math.max(largoMaximo + 2, 8), 60)
}

// Nombre de hoja válido: máximo 31 caracteres, sin : \ / ? * [ ] y sin repetirse
function nombreHoja(texto, usados) {
  const base = texto.replace(/[:\\/?*[\]]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 28) || 'Datos'
  let nombre = base
  for (let i = 2; usados.has(nombre.toLowerCase()); i++) nombre = `${base.slice(0, 26)} ${i}`
  usados.add(nombre.toLowerCase())
  return nombre
}

export async function guardarExcel(modelo, generadoPor) {
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  const usados = new Set()

  const resumen = [
    [{ value: modelo.titulo, fontWeight: 'bold', fontSize: 14 }],
    ...(modelo.subtitulo ? [[{ value: modelo.subtitulo }]] : []),
    [{ value: `Generado el ${new Date().toLocaleString('es-PE')}${generadoPor ? ` por ${generadoPor}` : ''}` }],
    [],
    ...(modelo.datos ?? [])
      .filter(([, valor]) => valor !== undefined && valor !== null && valor !== '')
      .map(([etiqueta, valor]) => [
        { value: etiqueta, fontWeight: 'bold' },
        typeof valor === 'number' ? { value: valor, type: Number } : { value: String(valor) },
      ]),
  ]
  const notas = (modelo.secciones ?? []).filter((s) => s.tipo === 'nota').map((s) => [{ value: s.texto }])
  if (notas.length) resumen.push([], ...notas)

  const hojas = [{ data: resumen, sheet: nombreHoja('Resumen', usados), columns: [{ width: 28 }, { width: 50 }] }]

  for (const seccion of (modelo.secciones ?? []).filter((s) => s.tipo === 'tabla')) {
    const { columnas, filas, pie } = seccion
    const data = [
      columnas.map((c) => ({ value: c.titulo, ...ENCABEZADO })),
      ...filas.map((fila) => columnas.map((c, i) => celda(fila[i], c.tipo))),
      ...(pie ? [columnas.map((c, i) => celda(pie[i], c.tipo, PIE))] : []),
    ]
    hojas.push({
      data,
      sheet: nombreHoja(seccion.hoja ?? seccion.titulo ?? 'Datos', usados),
      columns: columnas.map((c, i) => ({ width: anchoColumna(c, filas, i) })),
      stickyRowsCount: 1,
    })
  }

  await writeXlsxFile(hojas, { fontFamily: 'Calibri', fontSize: 11 }).toFile(nombreArchivo(modelo.archivo, 'xlsx'))
}
