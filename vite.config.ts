import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: null,
        includeAssets: ['apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png', 'pwa-maskable-512x512.png', 'default-avatar.svg'],
        devOptions: {
          enabled: false
        },
        manifest: {
          id: '/',
          name: 'SARA AI Assistant',
          short_name: 'SARA',
          description: 'SARA - Personal AI Companion & Voice Assistant',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'portrait',
          theme_color: '#060B14',
          background_color: '#060B14',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable'
            }
          ],
          shortcuts: [
            {
              name: 'Voice Call with Sara',
              short_name: 'Voice Call',
              description: 'Start an instant live voice call with Sara',
              url: '/?action=voice_call',
              icons: [{ src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' }]
            },
            {
              name: 'Camera Vision',
              short_name: 'Camera',
              description: 'Show Sara what you are looking at via camera',
              url: '/?action=camera',
              icons: [{ src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' }]
            },
            {
              name: 'Live News Feed',
              short_name: 'News Feed',
              description: 'Get real-time verified news and headlines',
              url: '/?action=news',
              icons: [{ src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' }]
            }
          ],
          share_target: {
            action: '/',
            method: 'GET',
            params: {
              title: 'share_title',
              text: 'share_text',
              url: 'share_url'
            }
          }
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
