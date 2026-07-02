import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
  react(),
  tailwindcss(),
  VitePWA({
    registerType: 'autoUpdate',
    includeAssets: [
      'favicon.ico',
      'apple-touch-icon.png',
      'icon-192.png',
      'icon-512.png'
    ],
    manifest: {
      name: 'Mahya Apparel Finance',
      short_name: 'Mahya Finance',
      description: 'Aplikasi Keuangan Mahya Apparel',
      theme_color: '#14C5F4',
      background_color: '#FFFFFF',
      display: 'standalone',
      orientation: 'portrait',
      start_url: '/',
      icons: [
        {
          src: 'icon-192.png',
          sizes: '192x192',
          type: 'image/png'
        },
        {
          src: 'icon-512.png',
          sizes: '512x512',
          type: 'image/png'
        },
        {
          src: 'icon-512.png',
          sizes: '512x512',
          purpose: 'maskable',
          type: 'image/png'
        }
      ]
    }
  }),
],
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
