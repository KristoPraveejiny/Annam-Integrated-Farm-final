/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Origin the product QR codes should point at. Optional: when unset the QR
   * uses the origin of the page it is rendered on, which is what makes the
   * codes work over the local network during development.
   */
  readonly VITE_PUBLIC_ORIGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
