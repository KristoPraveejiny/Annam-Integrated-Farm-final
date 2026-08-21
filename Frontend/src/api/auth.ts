// Point to Django Backend for OTP verification Auth

// Proxied by Vite: the '/django-api' prefix is stripped, so this resolves to
// Django's /api/... - relative so it works from a phone as well as localhost.
const DJANGO_BASE_URL = "/django-api/api";

async function _handleResponse(res: Response): Promise<any> {
    const contentType = res.headers.get('content-type') || '';
    let data: any = null;

    if (contentType.includes('application/json')) {
        data = await res.json().catch(() => null);
    } else {
        const txt = await res.text();
        try {
            data = JSON.parse(txt);
        } catch {
            data = txt ? { error: txt } : null;
        }
    }

    if (!res.ok) {
        // Surface the server's own message (e.g. "awaiting admin approval") rather
        // than a raw "Server error 403: {...}" dump.
        const message = (data && (data.error || data.detail || data.message)) || `Request failed (${res.status})`;
        return { error: message };
    }

    return data ?? {};
}

export async function sendSignupOtp(email: string) {
    const res = await fetch(`${DJANGO_BASE_URL}/send-signup-otp/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ email })
    });
    return _handleResponse(res);
}

export async function verifySignupOtp(data: any) {
    const res = await fetch(`${DJANGO_BASE_URL}/verify-signup-otp/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(data)
    });
    return _handleResponse(res);
}

export async function sendLoginOtp(email: string, password?: string) {
    const res = await fetch(`${DJANGO_BASE_URL}/send-login-otp/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ email, password })
    });
    return _handleResponse(res);
}

export async function verifyLoginOtp(email: string, otp: string) {
    const res = await fetch(`${DJANGO_BASE_URL}/verify-login-otp/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ email, otp })
    });
    return _handleResponse(res);
}

const NODE_BASE_URL = '/api';

export async function sendPasswordResetOtp(email: string) {
    const res = await fetch(`${NODE_BASE_URL}/auth/password-reset/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email }),
    });
    return _handleResponse(res);
}

export async function confirmPasswordReset(email: string, otp: string, newPassword: string, confirmPassword: string) {
    const res = await fetch(`${NODE_BASE_URL}/auth/password-reset/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email, otp, newPassword, confirmPassword }),
    });
    return _handleResponse(res);
}
