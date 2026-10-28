import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { rundotGameLibrariesPlugin } from '@series-inc/rundot-game-sdk/vite'

// NOTE: the RUN Playground plugin (rundotGamePlaygroundPlugin) is intentionally NOT enabled here.
// It needs a RUN login. Without it the SDK runs in its built-in MockHost, which is what
// `npm run dev`, tests and the static web preview use. Add it (see DEPLOY.md) to test against
// the real RUN backend.
export default defineConfig({
  plugins: [react(), rundotGameLibrariesPlugin()],
  base: './',
  server: { allowedHosts: true },
  esbuild: { target: 'es2022' },
  optimizeDeps: { esbuildOptions: { target: 'es2022' } },
  build: { target: 'es2022', outDir: 'dist', chunkSizeWarningLimit: 900, sourcemap: false },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
})
