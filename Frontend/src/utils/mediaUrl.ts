/**
 * Resolve an uploaded file path to something the browser can load.
 *
 * Uploads are served by the Node backend but proxied by Vite at /uploads, so a
 * relative path works from localhost and from a phone on the local network
 * alike. A hardcoded http://localhost:5000 would point the phone at itself.
 */
export function resolveMediaUrl(path?: string | null): string {
  if (!path) return '';

  // Already absolute, a blob preview, or an inline data URI - leave it alone.
  if (/^(https?:|blob:|data:)/i.test(path)) return path;

  return path.startsWith('/') ? path : `/${path}`;
}
