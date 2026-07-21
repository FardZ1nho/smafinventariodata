import { useEffect, useRef, useState } from 'react'

export default function SelectorProducto({ productos, value, onChange, placeholder = 'Buscar producto...' }) {
  const [query, setQuery] = useState('')
  const [abierto, setAbierto] = useState(false)
  const contenedorRef = useRef(null)

  const productoSeleccionado = productos.find((p) => p.id === value)

  // Si cambia el producto seleccionado desde afuera, sincroniza el texto mostrado
  useEffect(() => {
    setQuery(productoSeleccionado ? productoSeleccionado.nombre : '')
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cierra el desplegable si se hace click afuera
  useEffect(() => {
    function handleClickFuera(e) {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target)) {
        setAbierto(false)
        setQuery(productoSeleccionado ? productoSeleccionado.nombre : '')
      }
    }
    document.addEventListener('mousedown', handleClickFuera)
    return () => document.removeEventListener('mousedown', handleClickFuera)
  }, [productoSeleccionado])

  const filtrados = query.trim() === ''
    ? productos
    : productos.filter((p) =>
        p.nombre.toLowerCase().includes(query.toLowerCase()) ||
        (p.sku ?? '').toLowerCase().includes(query.toLowerCase())
      )

  function seleccionar(p) {
    onChange(p.id)
    setQuery(p.nombre)
    setAbierto(false)
  }

  return (
    <div ref={contenedorRef} className="relative">
      <input
        value={query}
        onChange={(e) => { setQuery(e.target.value); setAbierto(true); if (value) onChange('') }}
        onFocus={() => setAbierto(true)}
        placeholder={placeholder}
        className="w-full rounded-md border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/40 focus:border-signal"
      />
      {abierto && (
        <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto bg-white border border-line rounded-md shadow-md">
          {filtrados.length === 0 ? (
            <p className="px-3 py-2 text-sm text-ink-muted">Sin resultados.</p>
          ) : (
            filtrados.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => seleccionar(p)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-stone-100 transition"
              >
                <p className="text-ink leading-snug">
                  {p.nombre}{p.tipo === 'kit' ? <span className="text-ink-muted"> (kit)</span> : ''}
                </p>
                {p.sku && <p className="font-mono text-xs text-ink-muted mt-0.5">{p.sku}</p>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}