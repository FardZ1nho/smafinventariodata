import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import RutaProtegida from './components/RutaProtegida'
import Layout from './components/Layout'
import Login from './pages/Login'
import Resumen from './pages/Resumen'
import Productos from './pages/Productos'
import Movimientos from './pages/Movimientos'
import Categorias from './pages/Categorias'
import Almacenes from './pages/Almacenes'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
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
            <Route path="almacenes" element={<Almacenes />} />
            <Route path="categorias" element={<Categorias />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
