import axios, { AxiosInstance, AxiosError } from 'axios';
import { API_BASE_URL, HTTP_STATUS_CODES } from '@/utils/constants';
import { storage } from '@/utils/storage';
import { ApiError, ErrorResponse } from '@/types/errors';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
    });

    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        const token = storage.getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError<ErrorResponse>) => {
        const status = error.response?.status;
        const msg    = (error.response?.data as any)?.error || '';
        const isAuthErr =
          status === HTTP_STATUS_CODES.UNAUTHORIZED ||
          (status === 403 && (msg.includes('token') || msg.includes('Token')));

        if (isAuthErr) {
          storage.clearAuth();
          window.dispatchEvent(new CustomEvent('auth:unauthorized'));
        }
        return Promise.reject(this.handleError(error));
      }
    );
  }

  private handleError(error: AxiosError<ErrorResponse>): ApiError {
    const status = error.response?.status || 500;
    const message = error.response?.data?.error || error.message;

    return new ApiError(status, message, error.response?.data);
  }

  get<T>(url: string, config?: any) {
    return this.client.get<T>(url, config);
  }

  post<T>(url: string, data?: any, config?: any) {
    return this.client.post<T>(url, data, config);
  }

  put<T>(url: string, data?: any, config?: any) {
    return this.client.put<T>(url, data, config);
  }

  delete<T>(url: string, config?: any) {
    return this.client.delete<T>(url, config);
  }

  patch<T>(url: string, data?: any, config?: any) {
    return this.client.patch<T>(url, data, config);
  }
}

export const apiClient = new ApiClient();