import { useEffect, useRef, useState } from 'react'

// Botón de descarga. Con `opciones` muestra un menú: [{ etiqueta, generar, grupo? }]
// (las opciones con el mismo `grupo` se muestran juntas bajo ese título).
// Sin opciones, ejecuta `generar` directamente.
export default function BotonDescarga({ generar, opciones, texto = 'Descargar', className = '' }) {
  const [generando, setGenerando] = useState(false)
  const [error, setError] = useState('')
  const [menuAbierto, setMenuAbierto] = useState(false)
  const contenedor = useRef(null)

  useEffect(() => {
    if (!menuAbierto) return
    function cerrar(e) {
      if (!contenedor.current?.contains(e.target)) setMenuAbierto(false)
    }
    function escape(e) {
      if (e.key === 'Escape') setMenuAbierto(false)
    }
    document.addEventListener('mousedown', cerrar)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', cerrar)
      document.removeEventListener('keydown', escape)
    }
  }, [menuAbierto])

  async function ejecutar(fn) {
    setMenuAbierto(false)
    setError('')
    setGenerando(true)
    try {
      await fn()
    } catch (e) {
      console.error(e)
      setError('No se pudo generar el archivo. Intenta de nuevo.')
    }
    setGenerando(false)
  }

  return (
    <div ref={contenedor} className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => (opciones ? setMenuAbierto((v) => !v) : ejecutar(generar))}
        disabled={generando}
        aria-haspopup={opciones ? 'menu' : undefined}
        aria-expanded={opciones ? menuAbierto : undefined}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-line bg-white text-xs font-medium text-ink hover:bg-stone-100 transition disabled:opacity-50 whitespace-nowrap"
      >
        <svg aria-hidden="true" viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 2v8M4.5 6.5 8 10l3.5-3.5M3 13h10" />
        </svg>
        {generando ? 'Generando...' : texto}
        {opciones && <span aria-hidden="true" className="text-ink-muted">▾</span>}
      </button>

      {menuAbierto && (
        <div role="menu" className="absolute right-0 z-30 mt-1 min-w-48 bg-white border border-line rounded-md shadow-lg py-1">
          {opciones.map((o, i) => (
            <div key={`${o.grupo ?? ''}-${o.etiqueta}`}>
              {o.grupo && o.grupo !== opciones[i - 1]?.grupo && (
                <p className={`px-3 pt-2 pb-1 text-[10px] font-mono uppercase tracking-wide text-ink-muted ${i > 0 ? 'border-t border-line mt-1' : ''}`}>
                  {o.grupo}
                </p>
              )}
              <button
                role="menuitem"
                type="button"
                onClick={() => ejecutar(o.generar)}
                className="block w-full text-left px-3 py-2 text-xs text-ink hover:bg-stone-100"
              >
                {o.etiqueta}
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <p role="alert" className="absolute right-0 mt-1 text-[11px] text-danger whitespace-nowrap">{error}</p>}
    </div>
  )
}
