/**
 * Centralized API client for MATIX
 * Handles JWT Authorization headers, refresh token logic, and error sanitization.
 */
class ApiClient {
  constructor() {
    this.baseUrl = '/api';
  }

  getToken() {
    return localStorage.getItem('matix_token');
  }

  getRefreshToken() {
    return localStorage.getItem('matix_refresh_token');
  }

  setTokens(accessToken, refreshToken) {
    if (accessToken) localStorage.setItem('matix_token', accessToken);
    if (refreshToken) localStorage.setItem('matix_refresh_token', refreshToken);
  }

  clearTokens() {
    localStorage.removeItem('matix_token');
    localStorage.removeItem('matix_refresh_token');
    localStorage.removeItem('matix_user');
  }

  getCurrentUser() {
    const userJson = localStorage.getItem('matix_user');
    try {
      return userJson ? JSON.parse(userJson) : null;
    } catch {
      return null;
    }
  }

  setCurrentUser(user) {
    if (user) {
      localStorage.setItem('matix_user', JSON.stringify(user));
    }
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Handle multipart uploads
    if (options.body instanceof FormData) {
      delete headers['Content-Type'];
    }

    try {
      let response = await fetch(url, { ...options, headers });

      // Handle 401 Unauthorized - Attempt Token Refresh
      if (response.status === 401 && this.getRefreshToken() && !options._retry && !endpoint.includes('/auth/')) {
        const refreshSuccessful = await this.tryRefreshToken();
        if (refreshSuccessful) {
          options._retry = true;
          return this.request(endpoint, options);
        } else {
          this.clearTokens();
          window.location.hash = '#/login';
          throw new Error('Session expired. Please log in again.');
        }
      }

      const isJson = (response.headers.get('content-type') || '').includes('application/json');
      const data = isJson ? await response.json() : null;

      if (!response.ok) {
        const message = data?.message || `Request failed with status ${response.status}`;
        const error = new Error(message);
        error.code = data?.code || 'HTTP_ERROR';
        error.status = response.status;
        error.data = data;
        throw error;
      }

      return data;
    } catch (err) {
      throw err;
    }
  }

  async tryRefreshToken() {
    try {
      const refreshToken = this.getRefreshToken();
      if (!refreshToken) return false;

      const res = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) return false;
      const data = await res.json();
      if (data.success && data.data.accessToken) {
        this.setTokens(data.data.accessToken);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  // HTTP Helper Methods
  get(endpoint, params = {}) {
    const query = new URLSearchParams(params).toString();
    const fullEndpoint = query ? `${endpoint}?${query}` : endpoint;
    return this.request(fullEndpoint, { method: 'GET' });
  }

  post(endpoint, body = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
  }

  postFormData(endpoint, formData) {
    return this.request(endpoint, {
      method: 'POST',
      body: formData,
    });
  }

  putFormData(endpoint, formData) {
    return this.request(endpoint, {
      method: 'PUT',
      body: formData,
    });
  }

  patch(endpoint, body = {}) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }

  // Export Download Helper
  async downloadExport(type, format) {
    const token = this.getToken();
    const response = await fetch(`${this.baseUrl}/reports/export?type=${type}&format=${format}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) throw new Error('Export failed');

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `matix_${type}_export_${Date.now()}.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(downloadUrl);
  }
}

export const api = new ApiClient();
