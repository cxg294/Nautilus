export interface RequestInstanceState {
  /** the promise of refreshing token */
  refreshTokenPromise: Promise<boolean> | null;
  /** the request error message stack */
  errMsgStack: string[];
  [key: string]: unknown;
}

// Background checks report failures inline instead of interrupting the current page.
declare module 'axios' {
  interface AxiosRequestConfig {
    silentError?: boolean;
  }
}
