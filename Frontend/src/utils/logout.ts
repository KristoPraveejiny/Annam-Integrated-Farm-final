/**
 * Clears the local session. Shared by the sidebar Logout entry and the header
 * user menu so the two can never drift apart.
 *
 * The server call is best effort — with JWTs the session lives in localStorage,
 * so clearing it is what actually logs the user out.
 */
export async function clearSession() {
  try {
    const tokenRaw = localStorage.getItem('token');
    const token = tokenRaw && tokenRaw.startsWith('"') && tokenRaw.endsWith('"')
      ? tokenRaw.slice(1, -1)
      : tokenRaw;

    if (token) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  } catch {
    // Offline or server down: still log out locally.
  } finally {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }
}
