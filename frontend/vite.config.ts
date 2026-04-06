import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/api': {
        // Local dev → external URL de EasyPanel (puerto 80)
        // Dentro de Docker → http://trabajo_calzalindo-api-nomina:80
        target: 'https://trabajo-calzalindo-api-nomina.ldnquj.easypanel.host',
        changeOrigin: true,
      },
    },
  },
})
