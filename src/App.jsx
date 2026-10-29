import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import RutaProtegida from './components/RutaProtegida'
import RutaAdmin from './components/RutaAdmin'
import Layout from './components/Layout'
import Login from './pages/Login'
import Restablecer from './pages/Restablecer'
import Calidad from './pages/Calidad'
import Resumen from './pages/Resumen'
import Productos from './pages/Productos'
import Movimientos from './pages/Movimientos'
import Categorias from './pages/Categorias'
import Almacenes from './pages/Almacenes'
import Auditoria from './pages/Auditoria'
import Importaciones from './pages/Importaciones'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/restablecer" element={<Restablecer />} />
          <Route
            path="/"
            element={
              <RutaProtegida>
                <Layout />
              </RutaProtegida>
            }
          >
            <Route index element={<Resumen />} />
            <Route path="productos" element={<Productos />} />
            <Route path="movimientos" element={<Movimientos />} />
            <Route path="importaciones" element={<Importaciones />} />
            <Route path="almacenes" element={<Almacenes />} />
            <Route path="categorias" element={<Categorias />} />
            <Route path="calidad" element={<Calidad />} />
            <Route path="auditoria" element={<RutaAdmin><Auditoria /></RutaAdmin>} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}