// Redimensiona y comprime una imagen en el navegador antes de subirla,
// para no gastar espacio de almacenamiento con fotos pesadas de celular.
export function comprimirImagen(archivo, maxDimension = 1200, calidad = 0.8) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader()
    lector.onerror = () => reject(new Error('No se pudo leer la imagen.'))
    lector.onload = (e) => {
      const img = new Image()
      img.onerror = () => reject(new Error('No se pudo procesar la imagen.'))
      img.onload = () => {
        let { width, height } = img
        if (width > height && width > maxDimension) {
          height = Math.round(height * (maxDimension / width))
          width = maxDimension
        } else if (height > maxDimension) {
          width = Math.round(width * (maxDimension / height))
          height = maxDimension
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error('No se pudo comprimir la imagen.'))),
          'image/jpeg',
          calidad
        )
      }
      img.src = e.target.result
    }
    lector.readAsDataURL(archivo)
  })
}

// Sube la imagen ya comprimida al bucket de Supabase Storage y devuelve la URL pública
export async function subirFotoProducto(supabase, archivo) {
  const comprimida = await comprimirImagen(archivo)
  const nombreArchivo = `${crypto.randomUUID()}.jpg`

  const { error } = await supabase.storage
    .from('productos-fotos')
    .upload(nombreArchivo, comprimida, { contentType: 'image/jpeg' })

  if (error) throw error

  const { data } = supabase.storage.from('productos-fotos').getPublicUrl(nombreArchivo)
  return data.publicUrl
}