/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly POCKETBASE_URL?: string;
  readonly PUBLIC_POCKETBASE_URL: string;
  readonly PUBLIC_WHATSAPP_NUMBER: string;
  readonly PUBLIC_SITE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare namespace App {
  interface Locals {
    adminPB?: import("pocketbase").default;
    admin?: import("pocketbase").RecordModel;
  }
}

declare global {
  interface Window {
    __showToast?: (opts: {
      type?: 'success' | 'error' | 'info' | 'undo';
      message: string;
      action?: { label: string; onClick: () => void | Promise<void> };
      duration?: number;
    }) => HTMLElement | null;
    __toastSystemWired?: boolean;
  }
}
