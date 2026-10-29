// Generación de PDF descargables. jsPDF se carga solo al descargar, para no pesar en la app.
// Las fuentes estándar de PDF no tienen todos los símbolos: usar texto simple (sin flechas ni emojis).

const EMPRESA = 'SMAF'
const COLOR_TINTA = [36, 33, 28]
const COLOR_TENUE = [114, 107, 96]
const COLOR_LINEA = [222, 218, 207]
const COLOR_FONDO = [242, 240, 234]
const COLOR_ACENTO = [184, 121, 26]
const MARGEN = 14

const FORMATO_DIA = { day: '2-digit', month: '2-digit', year: 'numeric' }

export function fechaHora(valor) {
  return valor ? new Date(valor).toLocaleString('es-PE', { ...FORMATO_DIA, hour: '2-digit', minute: '2-digit' }) : ''
}

export function fechaCorta(valor) {
  if (!valor) return ''
  // Las fechas sin hora (YYYY-MM-DD) se interpretan en hora local para no correrse un día
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(valor) ? new Date(valor + 'T00:00:00') : new Date(valor)
  return fecha.toLocaleDateString('es-PE', FORMATO_DIA)
}

export function soles(valor) {
  return `S/ ${Number(valor || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function numero(valor) {
  return Number(valor || 0).toLocaleString('es-PE', { maximumFractionDigits: 2 })
}

// Nombre de archivo seguro: "Recepcion IMPO 22" -> "Recepcion_IMPO_22_2026-10-28.pdf"
export function nombreArchivo(base, extension = 'pdf') {
  const hoy = new Date()
  const fecha = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`
  const limpio = base.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').replace(/_+/g, '_')
  return `${limpio}_${fecha}.${extension}`
}

// Texto de una celda según el tipo de su columna (el Excel recibe el valor sin formatear)
function formatear(valor, tipo) {
  if (valor === null || valor === undefined || valor === '') return ''
  if (typeof valor !== 'number' && (tipo === 'numero' || tipo === 'moneda')) return String(valor)
  switch (tipo) {
    case 'numero': return numero(valor)
    case 'moneda': return soles(valor)
    case 'fechaHora': return fechaHora(valor)
    case 'fecha': return fechaCorta(valor)
    default: return String(valor)
  }
}

const ALINEACION = { numero: 'right', moneda: 'right' }

// Arma el PDF de un modelo de reporte (ver reportes.js) y lo descarga
export async function guardarPdf(modelo, generadoPor) {
  const pdf = await crearPdf({ titulo: modelo.titulo, subtitulo: modelo.subtitulo, horizontal: modelo.horizontal, generadoPor })
  if (modelo.datos?.length) {
    pdf.datos(modelo.datos.map(([etiqueta, valor]) => [etiqueta, typeof valor === 'number' ? numero(valor) : valor]), modelo.datosColumnas)
  }
  for (const s of modelo.secciones ?? []) {
    if (s.tipo === 'tabla') {
      if (s.titulo) pdf.seccion(s.titulo)
      pdf.tabla({
        columnas: s.columnas.map((c) => ({ titulo: c.titulo, ancho: c.ancho, alinear: c.alinear ?? ALINEACION[c.tipo] })),
        filas: s.filas.map((f) => s.columnas.map((c, i) => formatear(f[i], c.tipo))),
        pie: s.pie && s.columnas.map((c, i) => formatear(s.pie[i], c.tipo)),
        vacio: s.vacio,
      })
    } else if (s.tipo === 'nota') {
      pdf.nota(s.texto, { color: s.color })
    } else if (s.tipo === 'firmas') {
      pdf.firmas(s.etiquetas)
    }
  }
  pdf.guardar(modelo.archivo)
}

/**
 * Crea un documento con encabezado. Devuelve helpers para ir agregando contenido de arriba hacia abajo.
 * @param {{ titulo: string, subtitulo?: string, horizontal?: boolean, generadoPor?: string }} opciones
 */
export async function crearPdf({ titulo, subtitulo, horizontal = false, generadoPor }) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc = new jsPDF({ orientation: horizontal ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' })
  const ancho = doc.internal.pageSize.getWidth()
  const alto = doc.internal.pageSize.getHeight()
  let y = MARGEN

  // Encabezado
  doc.setFillColor(...COLOR_ACENTO)
  doc.rect(MARGEN, y, 2.5, 2.5, 'F')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...COLOR_TENUE)
  doc.text(`${EMPRESA} · CONTROL DE STOCK`, MARGEN + 4.5, y + 2.2)
  y += 10
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(...COLOR_TINTA)
  doc.text(titulo, MARGEN, y)
  y += 6
  if (subtitulo) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    doc.setTextColor(...COLOR_TENUE)
    const lineas = doc.splitTextToSize(subtitulo, ancho - MARGEN * 2)
    doc.text(lineas, MARGEN, y)
    y += lineas.length * 4.5
  }
  doc.setDrawColor(...COLOR_LINEA)
  doc.line(MARGEN, y, ancho - MARGEN, y)
  y += 6

  function espacio(necesario) {
    if (y + necesario > alto - 18) {
      doc.addPage()
      y = MARGEN
    }
  }

  return {
    doc,

    // Bloque de datos clave en columnas: [['Proveedor', 'ACME'], ['Estado', 'Confirmado']]
    datos(pares, columnas = 3) {
      const visibles = pares.filter(([, valor]) => valor !== undefined && valor !== null && valor !== '')
      const anchoCol = (ancho - MARGEN * 2) / columnas
      for (let i = 0; i < visibles.length; i += columnas) {
        espacio(12)
        visibles.slice(i, i + columnas).forEach(([etiqueta, valor], j) => {
          const x = MARGEN + j * anchoCol
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(7)
          doc.setTextColor(...COLOR_TENUE)
          doc.text(etiqueta.toUpperCase(), x, y)
          doc.setFontSize(10)
          doc.setTextColor(...COLOR_TINTA)
          doc.text(doc.splitTextToSize(String(valor), anchoCol - 4)[0], x, y + 4.5)
        })
        y += 11
      }
      y += 2
    },

    seccion(texto) {
      espacio(14)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(...COLOR_TINTA)
      doc.text(texto, MARGEN, y)
      y += 3
    },

    nota(texto, { color } = {}) {
      espacio(8)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(...(color === 'acento' ? COLOR_ACENTO : COLOR_TENUE))
      const lineas = doc.splitTextToSize(texto, ancho - MARGEN * 2)
      doc.text(lineas, MARGEN, y + 3)
      y += lineas.length * 4 + 3
    },

    // columnas: [{ titulo, alinear?: 'right' | 'center', ancho? }]; filas: arrays de textos
    tabla({ columnas, filas, pie, vacio = 'Sin registros.' }) {
      if (filas.length === 0) {
        this.nota(vacio)
        return
      }
      const estilosColumna = {}
      columnas.forEach((c, i) => {
        estilosColumna[i] = { halign: c.alinear ?? 'left', ...(c.ancho ? { cellWidth: c.ancho } : {}) }
      })
      autoTable(doc, {
        startY: y + 1,
        margin: { left: MARGEN, right: MARGEN, bottom: 18 },
        head: [columnas.map((c) => c.titulo)],
        body: filas,
        foot: pie ? [pie] : undefined,
        showFoot: 'lastPage',
        theme: 'grid',
        styles: { font: 'helvetica', fontSize: 8.5, textColor: COLOR_TINTA, lineColor: COLOR_LINEA, lineWidth: 0.2, cellPadding: 1.8, overflow: 'linebreak' },
        headStyles: { fillColor: COLOR_TINTA, textColor: 255, fontStyle: 'bold', fontSize: 8 },
        footStyles: { fillColor: COLOR_FONDO, textColor: COLOR_TINTA, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [250, 249, 246] },
        columnStyles: estilosColumna,
        didParseCell: (data) => {
          // El pie hereda la alineación de su columna
          if (data.section === 'foot' || data.section === 'head') data.cell.styles.halign = columnas[data.column.index]?.alinear ?? 'left'
        },
      })
      y = doc.lastAutoTable.finalY + 7
    },

    // Líneas de firma al final del documento
    firmas(etiquetas) {
      espacio(30)
      y += 14
      const anchoFirma = (ancho - MARGEN * 2 - (etiquetas.length - 1) * 12) / etiquetas.length
      etiquetas.forEach((etiqueta, i) => {
        const x = MARGEN + i * (anchoFirma + 12)
        doc.setDrawColor(...COLOR_TENUE)
        doc.line(x, y, x + anchoFirma, y)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(...COLOR_TENUE)
        doc.text(etiqueta, x, y + 4)
        doc.text('Nombre, firma y fecha', x, y + 8)
      })
      y += 12
    },

    guardar(base) {
      const total = doc.getNumberOfPages()
      const generado = `Generado el ${fechaHora(new Date())}${generadoPor ? ` por ${generadoPor}` : ''}`
      for (let i = 1; i <= total; i++) {
        doc.setPage(i)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7.5)
        doc.setTextColor(...COLOR_TENUE)
        doc.setDrawColor(...COLOR_LINEA)
        doc.line(MARGEN, alto - 12, ancho - MARGEN, alto - 12)
        doc.text(`${EMPRESA} · ${titulo} · ${generado}`, MARGEN, alto - 8)
        doc.text(`Página ${i} de ${total}`, ancho - MARGEN, alto - 8, { align: 'right' })
      }
      doc.save(nombreArchivo(base))
    },
  }
}
