export function getApiBaseUrl(): string {
  // Prefer VITE_API_BASE_URL; fallback to nginx proxy
  const base = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (base && typeof base === "string" && base.trim().length > 0) {
    return base.replace(/\/$/, "");
  }
  
  // Check if we're running in development mode
  if (import.meta.env.DEV) {
    return "/api/v1"; // Use Vite proxy in development
  }
  
  return "http://localhost/api/v1"; // nginx proxy with API path
}

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('access_token');
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const base = getApiBaseUrl();
  const url = `${base}${path}`;

  // Merge headers, giving priority to custom headers
  const headers = {
    ...getAuthHeaders(),
    ...(init && init.headers ? init.headers : {}),
  };

  console.log(`API Call: ${init?.method || 'GET'} ${url}`);
  console.log(`API Call: Headers:`, headers);
  if (headers.Authorization) {
    console.log('API Call: Has auth token');
  }

  const res = await fetch(url, {
    ...init,
    headers,
  });

  console.log(`API Call: Response status: ${res.status} ${res.statusText}`);

  if (!res.ok) {
    // Handle 401 unauthorized - only redirect to login for auth endpoints
    if (res.status === 401 && path.includes('/auth/')) {
      localStorage.removeItem('access_token');
      window.location.href = '/login';
      throw new Error('Unauthorized - please login again');
    }

    // attempt to parse json error
    let message = `${res.status} ${res.statusText}`;
    try {
      const data = await res.json();
      if (data && typeof data.detail === "string") {
        message = data.detail;
      }
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

// Create an API client object for easy use
export const api = {
  get: <T>(path: string) => apiFetch<T>(path, { method: 'GET' }),
  post: <T>(path: string, data?: any) => apiFetch<T>(path, {
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined
  }),
  put: <T>(path: string, data?: any) => apiFetch<T>(path, {
    method: 'PUT',
    body: data ? JSON.stringify(data) : undefined
  }),
  patch: <T>(path: string, data?: any) => apiFetch<T>(path, {
    method: 'PATCH',
    body: data ? JSON.stringify(data) : undefined
  }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
};


