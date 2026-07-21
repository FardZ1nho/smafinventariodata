export default function Paginador({ pagina, totalPaginas, onCambiar }) {
  if (totalPaginas <= 1) return null

  return (
    <div className="flex items-center justify-between mt-4">
      <button
        onClick={() => onCambiar(pagina - 1)}
        disabled={pagina <= 1}
        className="text-sm font-medium text-ink disabled:text-ink-muted/40 disabled:cursor-not-allowed hover:underline"
      >
        ← Anterior
      </button>
      <span className="text-xs font-mono text-ink-muted">
        Página {pagina} de {totalPaginas}
      </span>
      <button
        onClick={() => onCambiar(pagina + 1)}
        disabled={pagina >= totalPaginas}
        className="text-sm font-medium text-ink disabled:text-ink-muted/40 disabled:cursor-not-allowed hover:underline"
      >
        Siguiente →
      </button>
    </div>
  )
}
