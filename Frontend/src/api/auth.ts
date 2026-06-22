// Point to Django Backend for OTP verification Auth

const DJANGO_BASE_URL = "http://localhost:8000/api";

async function _handleResponse(res: Response): Promise<any> {
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok) {
        const txt = await res.text();
        return { error: `Server error ${res.status}: ${txt}` };
    }
    if (contentType.includes('application/json')) {
        return res.json();
    }
    try {
        return JSON.parse(await res.text());
    } catch {
        return { error: `Unexpected response format (status ${res.status})` };
    }
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

const NODE_BASE_URL = 'http://localhost:5000/api';

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
