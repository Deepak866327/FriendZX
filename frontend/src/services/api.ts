import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL, HTTP_STATUS_CODES } from '@/utils/constants';
import { storage } from '@/utils/storage';
import { ApiError, ErrorResponse } from '@/types/errors';

// ── In-memory access token (tab-isolated via sessionStorage) ─────────────────
// Initialised from sessionStorage so the token survives page refreshes without
// needing a round-trip to /refresh (which would use the domain-wide cookie and
// could return a different user if another tab has since logged in).
let _accessToken: string | null = storage.getToken();

export function setApiToken(token: string | null): void {
  _accessToken = token;
  // Persist to sessionStorage so the token survives F5 within the same tab.
  // sessionStorage is tab-scoped, so Tab 1's token is completely independent
  // from Tab 2's even when both are logged in as different users.
  if (token) {
    storage.setToken(token);
  } else {
    storage.removeToken();
  }
}

export function getApiToken(): string | null {
  return _accessToken;
}

// ── Axios instance ────────────────────────────────────────────────────────────

class ApiClient {
  private client: AxiosInstance;
  private isRefreshing = false;
  private refreshQueue: ((token: string) => void)[] = [];

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      withCredentials: true, // sends the HttpOnly refresh_token cookie
    });

    this.client.interceptors.request.use(
      (config) => {
        if (_accessToken) {
          config.headers.Authorization = `Bearer ${_accessToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error),
    );

    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError<ErrorResponse>) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
        const status = error.response?.status;
        const url = originalRequest?.url ?? '';
        const isRefreshUrl = url.includes('/auth/refresh');

        if (status === HTTP_STATUS_CODES.UNAUTHORIZED && !originalRequest._retry && !isRefreshUrl) {
          if (this.isRefreshing) {
            return new Promise<any>((resolve) => {
              this.refreshQueue.push((newToken) => {
                originalRequest.headers.Authorization = `Bearer ${newToken}`;
                resolve(this.client(originalRequest));
              });
            });
          }

          originalRequest._retry = true;
          this.isRefreshing = true;

          try {
            const { data } = await this.client.post<{ token: string; user: any }>('/auth/refresh');
            setApiToken(data.token);
            storage.setUser(data.user);
            this.refreshQueue.forEach((cb) => cb(data.token));
            this.refreshQueue = [];
            originalRequest.headers.Authorization = `Bearer ${data.token}`;
            return this.client(originalRequest);
          } catch {
            setApiToken(null);
            storage.clearAuth();
            this.refreshQueue = [];
            window.dispatchEvent(new CustomEvent('auth:unauthorized'));
            return Promise.reject(this.handleError(error));
          } finally {
            this.isRefreshing = false;
          }
        }

        return Promise.reject(this.handleError(error));
      },
    );
  }

  private handleError(error: AxiosError<ErrorResponse>): ApiError {
    const status = error.response?.status || 500;
    const message = error.response?.data?.error || error.message;
    return new ApiError(status, message, error.response?.data);
  }

  get<T>(url: string, config?: any) { return this.client.get<T>(url, config); }
  post<T>(url: string, data?: any, config?: any) { return this.client.post<T>(url, data, config); }
  put<T>(url: string, data?: any, config?: any) { return this.client.put<T>(url, data, config); }
  delete<T>(url: string, config?: any) { return this.client.delete<T>(url, config); }
  patch<T>(url: string, data?: any, config?: any) { return this.client.patch<T>(url, data, config); }
}

export const apiClient = new ApiClient();
