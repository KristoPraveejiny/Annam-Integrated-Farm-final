import { useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { FiAlertTriangle, FiDownload } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';

declare global {
  interface Window {
    /** Dev machine's LAN IPv4, injected by the inject-lan-host Vite plugin. */
    __LAN_HOST__?: string;
  }
}


/**
 * The origin a scanned QR should point at.
 *
 * Derived from the page the QR is rendered on, so opening the site at
 * http://192.168.1.5:5173 produces codes that a phone on the same network can
 * actually reach - no configuration, no stored URL to go stale when the
 * machine's IP changes. VITE_PUBLIC_ORIGIN overrides it once deployed.
 */
export function publicOrigin(): string {
  const configured = import.meta.env.VITE_PUBLIC_ORIGIN as string | undefined;
  if (configured) return configured.replace(/\/$/, '');

  const current = typeof window === 'undefined' ? '' : window.location.origin;

  // Browsing on localhost would otherwise bake "localhost" into the code, which
  // resolves to the phone itself when scanned. Swap in the dev machine's LAN
  // address (injected by vite.config.ts) while keeping the port actually in use.
  const lanHost = typeof window === 'undefined' ? null : window.__LAN_HOST__;
  if (current && isLocalOrigin(current) && lanHost) {
    const { protocol, port } = window.location;
    return `${protocol}//${lanHost}${port ? `:${port}` : ''}`;
  }

  return current;
}

export function productUrl(productId: string): string {
  return `${publicOrigin()}/product/${productId}`;
}

/** A localhost QR scans fine on this machine but is unreachable from a phone. */
function isLocalOrigin(origin: string) {
  return /localhost|127\.0\.0\.1|\[::1\]/i.test(origin);
}

type ProductQrProps = {
  productId: string;
  productName?: string;
  size?: number;
  /** Show the download button and the URL under the code. */
  detailed?: boolean;
};

export function ProductQr({ productId, productName, size = 96, detailed = false }: ProductQrProps) {
  const { t } = useTranslation();
  const holderRef = useRef<HTMLDivElement>(null);
  const url = productUrl(productId);
  const local = isLocalOrigin(publicOrigin());

  const download = () => {
    const canvas = holderRef.current?.querySelector('canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `qr-${(productName || 'product').toLowerCase().replace(/\s+/g, '-')}.png`;
    link.click();
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div ref={holderRef} className="rounded-2xl border border-emerald-100 bg-white p-2">
        <QRCodeCanvas
          value={url}
          size={size}
          level="M"
          // Quiet zone: scanners need the white border to lock on.
          includeMargin
        />
      </div>

      {detailed && (
        <>
          <p className="max-w-full break-all text-center text-[11px] text-slate-400">{url}</p>
          <button
            type="button"
            onClick={download}
            className="inline-flex items-center gap-2 rounded-full border border-emerald-200 px-4 py-2 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-50"
          >
            <FiDownload /> {t('Download QR')}
          </button>
        </>
      )}

      {local && (
        <p className="flex items-start gap-1.5 text-center text-[11px] leading-snug text-amber-600">
          <FiAlertTriangle className="mt-0.5 shrink-0" />
          <span>{t('Open this site using your computer\'s network address to make this code scannable from a phone.')}</span>
        </p>
      )}
    </div>
  );
}
