import {
  defineConfig,
} from 'vite'
import {
  fileURLToPath,
} from 'url';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite';

// -- TypeScript workaround
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// -- Configure environment using .env file in project root directory (parent of
// this service directory)
const envFilePath = path.join(path.dirname(__dirname), '.env');

if (fs.existsSync(envFilePath)) {
  dotenv.config({ path: envFilePath });
}

// Port at which to redirect proxy
const SERVER_PORT = process.env.WHITEBOARD_EDITOR_HTTP_PORT || '8080';

// Working hostname
const HOSTNAME : string | null = process.env.WHITEBOARD_EDITOR_DOMAIN || null;

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  server: {
    allowedHosts: (HOSTNAME && [HOSTNAME] || [] ),
    proxy: {
      '/api': {
        target: `http://localhost:${SERVER_PORT}`,
        changeOrigin: true
      },
      '/ws': {
        target: `http://localhost:${SERVER_PORT}`,
        ws: true,
        changeOrigin: true
      }
    }
  }
})
