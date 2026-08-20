// Small helpers for reading the signed-in user out of localStorage, so pages
// that are shared between guests and logged-in users behave consistently.

export type StoredUser = {
  id?: string;
  full_name?: string;
  email?: string;
  role?: string;
};

export function getStoredUser(): StoredUser | null {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function isLoggedIn(): boolean {
  return Boolean(localStorage.getItem('token')) && Boolean(getStoredUser());
}

/**
 * Dashboard landing route for a role. Mirrors the redirect the login page uses,
 * so "Back to dashboard" always lands where signing in would have.
 */
export function dashboardPathForRole(role?: string): string {
  if (!role) return '/dashboard/farmer-worker';
  if (role === 'worker') return '/dashboard/farmer-worker';
  return `/dashboard/${role.replace('_', '-')}`;
}
