import { MenuItem, OrderWithItems, CreateOrderRequest } from '../types';

// Environment-based configuration
const API_BASE = (import.meta as any).env?.VITE_API_URL || '/api';
const REQUEST_TIMEOUT = 10000; // 10 seconds
const MAX_RETRIES = 3;

// Custom error class for better error handling
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Logger for production debugging
const logger = {
  error: (message: string, error: any) => {
    console.error(`[API Error] ${message}`, error);
    // In production, send to error tracking service (e.g., Sentry)
    if ((import.meta as any).env?.PROD) {
      // window.Sentry?.captureException(error);
    }
  },
  info: (message: string, data?: any) => {
    if ((import.meta as any).env?.DEV) {
      console.log(`[API Info] ${message}`, data);
    }
  }
};

// Fetch with timeout
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout: number = REQUEST_TIMEOUT
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new ApiError('Request timeout', 408);
    }
    throw error;
  }
}

// Retry logic for transient failures
async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retries: number = MAX_RETRIES
): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetchWithTimeout(url, options);
      
      // Don't retry client errors (4xx), only server errors (5xx)
      if (!response.ok && response.status >= 500 && i < retries - 1) {
        logger.info(`Retry ${i + 1}/${retries} for ${url}`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
        continue;
      }
      
      return response;
    } catch (error) {
      if (i === retries - 1) throw error;
      logger.info(`Retry ${i + 1}/${retries} for ${url} after error`);
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  throw new ApiError('Max retries exceeded');
}

// Enhanced request handler
async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  
  // Add authentication token if available
  const token = localStorage.getItem('auth_token');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...options.headers,
  };

  try {
    logger.info(`Request: ${options.method || 'GET'} ${url}`);
    
    const response = await fetchWithRetry(url, {
      ...options,
      headers,
    });

    // Parse response
    const contentType = response.headers.get('content-type');
    let data: any;
    
    try {
      if (contentType?.includes('application/json')) {
        const text = await response.text();
        data = text ? JSON.parse(text) : null;
      } else {
        data = await response.text();
      }
    } catch (parseError) {
      logger.error('Failed to parse response', parseError);
      throw new ApiError('Invalid server response', response.status);
    }

    // Handle errors
    if (!response.ok) {
      const errorMessage = data?.error || data?.message || `HTTP ${response.status}`;
      logger.error(`API Error: ${errorMessage}`, { url, status: response.status, data });
      throw new ApiError(errorMessage, response.status, data);
    }

    logger.info(`Response: ${options.method || 'GET'} ${url}`, data);
    return data;
    
  } catch (error: any) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    // Network error
    logger.error('Network error', { url, error });
    throw new ApiError(
      'Network error. Please check your connection.',
      0,
      error
    );
  }
}

// API methods
export const api = {
  // Generic HTTP methods
  async get<T>(endpoint: string): Promise<T> {
    return request<T>(endpoint, { method: 'GET' });
  },

  async post<T>(endpoint: string, data?: any): Promise<T> {
    return request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  },

  async patch<T>(endpoint: string, data?: any): Promise<T> {
    return request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  },

  async delete<T>(endpoint: string): Promise<T> {
    return request<T>(endpoint, { method: 'DELETE' });
  },

  // Menu endpoints
  async getMenu(): Promise<MenuItem[]> {
    return request<MenuItem[]>('/menu');
  },

  async getCategories(): Promise<string[]> {
    return request<string[]>('/menu/categories');
  },

  // Orders endpoints
  async getOrders(status?: string): Promise<OrderWithItems[]> {
    const endpoint = status ? `/orders?status=${status}` : '/orders';
    return request<OrderWithItems[]>(endpoint);
  },

  async getOrder(id: number): Promise<OrderWithItems> {
    return request<OrderWithItems>(`/orders/${id}`);
  },

  async createOrder(orderData: CreateOrderRequest): Promise<OrderWithItems> {
    return request<OrderWithItems>('/orders', {
      method: 'POST',
      body: JSON.stringify(orderData),
    });
  },

  async updateOrderStatus(orderId: number, status: string): Promise<OrderWithItems> {
    return request<OrderWithItems>(`/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  // Tables endpoints
  async getTables() {
    return request('/tables');
  },

  async getTableQRCode(tableNumber: number) {
    return request(`/tables/${tableNumber}/qrcode`);
  },
};
