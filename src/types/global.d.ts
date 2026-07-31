export {};

declare global {
  interface Window {
    vaultAPI: {
      set: (key: string, value: string) => Promise<boolean>;
      get: (key: string) => Promise<string | null>;
      delete: (key: string) => Promise<boolean>;
    };
    cryptoAPI: {
      signPayload: (payload: unknown, secret: string) => Promise<string>;
    };
    updaterAPI: {
      check: () => Promise<void>;
      download: () => Promise<void>;
      install: () => Promise<void>;
      onAvailable: (cb: (info: { version: string }) => void) => void;
      onProgress: (cb: (p: { percent: number }) => void) => void;
      onDownloaded: (cb: (info: { version: string }) => void) => void;
      onError: (cb: (e: { message: string }) => void) => void;
    };
    appAPI: {
      getVersion: () => Promise<string>;
    };
  }
}
