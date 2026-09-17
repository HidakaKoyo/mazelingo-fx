// Ambient typings for the extension's `chrome` API when accessed inside
// `page.evaluate` callbacks in Playwright E2E tests. The runtime `chrome` is
// Provided by the browser; these minimal types cover only what the tests touch.
declare const chrome: {
  storage: {
    local: {
      set(items: Readonly<Record<string, unknown>>): Promise<void>;
      get(
        keys: string | readonly string[] | Readonly<Record<string, unknown>>,
      ): Promise<Readonly<Record<string, unknown>>>;
    };
  };
  runtime: {
    lastError?: { message?: string };
    sendMessage(msg: unknown): Promise<unknown>;
    sendMessage(msg: unknown, callback: (response: unknown) => void): void;
    getURL(path: string): string;
  };
  tabs: {
    query(
      query: Readonly<{
        active: boolean;
        currentWindow: boolean;
      }>,
    ): Promise<{ id?: number; url?: string }[]>;
  };
};
