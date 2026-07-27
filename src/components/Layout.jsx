import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const linksBase = [
  { to: '/', label: 'Resumen', icon: IconHome },
  { to: '/productos', label: 'Productos', icon: IconBox },
  { to: '/movimientos', label: 'Movimientos', icon: IconArrows },
  { to: '/importaciones', label: 'Importaciones', icon: IconShip },
  { to: '/almacenes', label: 'Almacenes', icon: IconWarehouse },
  { to: '/categorias', label: 'Categorías', icon: IconTag },
]

export default function Layout() {
  const { user, signOut, esAdmin } = useAuth()
  const links = esAdmin
    ? [...linksBase, { to: '/auditoria', label: 'Auditoría', icon: IconShield }]
    : linksBase

  return (
    <div className="min-h-screen bg-stone md:flex">
      {/* Sidebar - solo desktop */}
      <aside className="hidden md:flex md:w-60 md:flex-col md:border-r md:border-line md:bg-white md:h-screen md:sticky md:top-0">
        <div className="px-5 py-6">
          <div className="inline-flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-sm bg-signal" />
            <span className="font-mono text-[11px] tracking-widest uppercase text-ink-muted">Control de stock</span>
          </div>
          <h1 className="text-xl font-semibold text-ink mt-1">Inventario</h1>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition ${
                  isActive ? 'bg-ink text-white' : 'text-ink-muted hover:bg-stone-100 hover:text-ink'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-line">
          <p className="text-xs text-ink-muted truncate mb-2">{user?.email}</p>
          <button
            onClick={signOut}
            className="text-sm font-medium text-danger hover:underline"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Contenido */}
      <div className="flex-1 flex flex-col">
        <header className="md:hidden flex items-center justify-between px-4 py-4 bg-white border-b border-line sticky top-0 z-10">
          <div className="inline-flex items-center gap-2">
            <span className="w-2 h-2 rounded-sm bg-signal" />
            <span className="font-semibold text-ink">Inventario</span>
          </div>
          <button onClick={signOut} className="text-xs font-medium text-danger">
            Salir
          </button>
        </header>

        <main className="flex-1 px-4 py-5 md:px-8 md:py-8 pb-24 md:pb-8">
          <Outlet />
        </main>
      </div>

      {/* Barra inferior - solo celular */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-line flex z-10">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
                isActive ? 'text-signal' : 'text-ink-muted'
              }`
            }
          >
            <Icon className="w-5 h-5" />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

function IconHome(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M3 11.5 12 4l9 7.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function IconBox(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M21 8 12 3 3 8l9 5 9-5Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 8v8l9 5 9-5V8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 13v8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function IconArrows(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M7 7h11l-3-3M17 17H6l3 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function IconShip(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M3 14h18l-2 6H5l-2-6Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 14V6h8l3 4M9 6V3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function IconWarehouse(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M3 21V10l9-6 9 6v11" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 21h18M7 21v-6h4v6M15 12h3M15 15h3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function IconShield(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M12 3 4 6v6c0 4.4 3.4 8.4 8 9 4.6-.6 8-4.6 8-9V6l-8-3Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m9 12 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function IconTag(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M20.6 12.6 12.7 20.5a2 2 0 0 1-2.8 0l-6.4-6.4a2 2 0 0 1 0-2.8L11.4 3.4A2 2 0 0 1 12.8 3H19a2 2 0 0 1 2 2v6.2a2 2 0 0 1-.4 1.4Z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="15" cy="8" r="1.5" />
    </svg>
  )
}