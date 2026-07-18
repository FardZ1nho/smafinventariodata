# Inventario

App de inventario (React + Vite + Tailwind + Supabase).

## Cómo correr el proyecto en tu computadora

1. Instala las dependencias:
   ```
   npm install
   ```

2. El archivo `.env` ya tiene tus credenciales de Supabase (URL y anon key).
   Si alguna vez necesitas cambiarlas, edítalo así:
   ```
   VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
   VITE_SUPABASE_ANON_KEY=tu_clave_publica
   ```

3. Corre el servidor de desarrollo:
   ```
   npm run dev
   ```
   Se abrirá en `http://localhost:5173`

4. Para ver la app en tu CELULAR mientras desarrollas:
   - Asegúrate de que el celular y la computadora estén en la MISMA red WiFi.
   - Corre `npm run dev` (ya está configurado para aceptar conexiones de red).
   - En la terminal aparecerá una URL tipo `Network: http://192.168.x.x:5173`
   - Abre esa URL en el navegador de tu celular.

## Estructura del proyecto

```
src/
  lib/supabaseClient.js     -> conexión a Supabase
  context/AuthContext.jsx   -> maneja la sesión del usuario
  components/
    Layout.jsx               -> navegación (sidebar/barra inferior)
    ProductoForm.jsx          -> formulario crear/editar producto (y kits)
    RutaProtegida.jsx         -> bloquea rutas si no hay sesión
  pages/
    Login.jsx
    Resumen.jsx               -> dashboard con alertas
    Productos.jsx
    Movimientos.jsx           -> entradas/salidas
    Categorias.jsx
```

## Publicar en internet (para que funcione desde cualquier lugar)

Cuando quieras que el sistema sea accesible desde cualquier celular/PC sin
depender de tu WiFi local, puedes subirlo gratis a Vercel o Netlify.
Pregúntame cuando llegues a ese paso y te guío.
