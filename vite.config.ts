import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    // GEMINI_API_KEY não é mais injetada no bundle do cliente: a chamada ao
    // Gemini roda em /api/extract-equipment (Vercel Serverless Function),
    // onde a chave fica só no servidor. Configure GEMINI_API_KEY (sem
    // prefixo VITE_) nas variáveis de ambiente do projeto na Vercel.
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
