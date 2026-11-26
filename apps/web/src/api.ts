const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';

export async function fetchApi(endpoint: string, options: RequestInit = {}) {
  const token = localStorage.getItem('tracepilot_token');
  
  // Normalize endpoint if caller includes /api/v1 prefix
  const cleanEndpoint = endpoint.startsWith('/api/v1')
    ? endpoint.slice('/api/v1'.length)
    : endpoint;

  const response = await fetch(`${API_URL}${cleanEndpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    let errorMsg = response.statusText;
    try {
      const errBody = await response.json();
      if (errBody && errBody.message) {
        errorMsg = errBody.message;
      }
    } catch (e) {
      // Ignore parse errors for error bodies
    }
    throw new Error(`API Error: ${errorMsg}`);
  }
  
  return response.json();
}

export const fetchWithAuth = fetchApi;