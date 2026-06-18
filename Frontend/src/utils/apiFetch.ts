/**
 * A wrapper around fetch() that:
 * 1. Automatically attaches the Authorization header from localStorage
 * 2. If the server returns 401 (expired/invalid token), clears localStorage and redirects to /login
 */
export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const tokenRaw = localStorage.getItem('token');
  const token = tokenRaw && tokenRaw.startsWith('"') && tokenRaw.endsWith('"')
    ? tokenRaw.slice(1, -1)
    : tokenRaw;

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, { ...options, headers });

  if (response.status === 401) {
    // Token is invalid or expired — clear session and send to login
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
    // Return the response so callers don't crash (they won't execute further anyway)
    return response;
  }

  return response;
}
