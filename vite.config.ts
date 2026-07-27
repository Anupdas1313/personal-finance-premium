import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: '/personal-finance-premium/',
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon.svg', 'pwa-192.png', 'pwa-512.png', 'apple-touch-icon.png'],
        workbox: {
          maximumFileSizeToCacheInBytes: 5000000,
          navigateFallback: '/personal-finance-premium/index.html'
        },
        manifest: {
          name: 'Expensify',
          short_name: 'Expensify',
          description: 'Premium offline-first expense tracker and financial dashboard',
          theme_color: '#00A86B',
          background_color: '#ffffff',
          display: 'standalone',
          start_url: '.',
          scope: '.',
          orientation: 'portrait',
          icons: [
            {
              src: 'pwa-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: 'pwa-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: 'pwa-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable'
            }
          ]
        }
      })
    ],
    define: {
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: true,
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'firebase-vendor': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
            'dexie-vendor': ['dexie', 'dexie-react-hooks'],
            'chart-vendor': ['recharts'],
            'ui-vendor': ['framer-motion', 'lucide-react'],
          }
        }
      }
    }
  };
});
