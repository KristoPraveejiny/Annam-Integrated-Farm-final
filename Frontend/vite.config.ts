import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import os from 'os';

const DEV_PORT = 5173;

/**
 * The machine's LAN IP, so QR codes generated while developing on localhost
 * still point somewhere a phone can reach. Recomputed on every dev server
 * start, so a new DHCP lease can't leave a stale address baked in. Only the
 * host is injected - the client pairs it with whatever port Vite actually
 * settled on, which is not always DEV_PORT.
 */
function lanHost(): string | null {
  for (const addresses of Object.values(os.networkInterfaces())) {
    for (const address of addresses || []) {
      if (address.family === 'IPv4' && !address.internal) {
        return address.address;
      }
    }
  }
  return null;
}

/**
 * Publish the LAN address as a runtime global on the page.
 *
 * `define` is not a workable channel here: the dev server ships an empty
 * defines map, so the value silently never arrives and QR codes quietly fall
 * back to localhost. Injecting a script tag works identically in dev and build.
 */
function lanHostPlugin() {
  return {
    name: 'inject-lan-host',
    transformIndexHtml: {
      order: 'pre' as const,
      handler(html: string) {
        const host = lanHost();
        if (!host) return html;
        return html.replace(
          '<head>',
          `<head>\n    <script>window.__LAN_HOST__=${JSON.stringify(host)};</script>`
        );
      },
    },
  };
}

export default defineConfig({
  plugins: [react(), lanHostPlugin()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    // Listen on the LAN too, so a phone scanning a QR code can reach the site.
    host: true,
    port: DEV_PORT,
    proxy: {
      // Proxy /django-api/* → Django on port 8000
      '/django-api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/django-api/, ''),
      },
      // Proxy /api/* → NodeJS on port 5000
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
      // Proxy /uploads/* → NodeJS on port 5000
      '/uploads': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
    },
  },
});