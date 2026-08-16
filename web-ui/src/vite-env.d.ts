/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 生产构建后端基址（构建时注入 http://127.0.0.1:8900/api/v1；dev 默认走 /api/v1 proxy） */
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}