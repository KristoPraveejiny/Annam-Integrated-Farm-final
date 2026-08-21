import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import type { InputHTMLAttributes } from 'react';
import { AuthLayout } from './AuthLayout';
import { Button } from '../../components/ui/Button';
import { useTranslation } from 'react-i18next';
import { notifyError } from '../../utils/notifications';

import { sendLoginOtp, verifyLoginOtp } from '../../api/auth';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const { t } = useTranslation();
  // OTP timer state
  const [otpTimer, setOtpTimer] = useState<number>(0);
  const [otpExpired, setOtpExpired] = useState<boolean>(false);

  // Start timer (5 minutes)
  const startOtpTimer = () => {
    setOtpTimer(300);
    setOtpExpired(false);
  };

  // Format timer display
  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const [email, setEmail] = useState('');
  // Countdown effect for OTP timer
  useEffect(() => {
    if (otpTimer <= 0) {
      setOtpExpired(true);
      return;
    }
    const interval = setInterval(() => {
      setOtpTimer(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setOtpExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [otpTimer]);

  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const navigate = useNavigate();

  const clearError = (field: string) => {
    setErrors(current => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const validateCredentials = () => {
    const nextErrors: Record<string, string> = {};

    if (!email.trim()) {
      nextErrors.email = t('Email is required');
    } else if (!EMAIL_REGEX.test(email.trim())) {
      nextErrors.email = t('Please enter a valid email address');
    }

    if (!password) {
      nextErrors.password = t('Password is required');
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const validateOtp = () => {
    const nextErrors: Record<string, string> = {};

    if (!otp.trim()) {
      nextErrors.otp = t('OTP is required');
    } else if (!/^\d{6}$/.test(otp.trim())) {
      nextErrors.otp = t('OTP must be exactly 6 digits');
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!validateCredentials()) return;

    setIsLoading(true);
    try {
      const response = await sendLoginOtp(email.trim(), password);
      if (response.error) {
        setFormError(response.error);
        notifyError(response.error);
      } else {
        setIsOtpSent(true);
        startOtpTimer();
      }
    } catch (err) {
      console.error(err);
      const message = t('Unable to reach the authentication server. Please try again.');
      setFormError(message);
      notifyError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setFormError('');
    if (!validateCredentials()) return;

    setIsLoading(true);
    try {
      const response = await sendLoginOtp(email.trim(), password);
      if (response.error) {
        setFormError(response.error);
        notifyError(response.error);
      } else {
        startOtpTimer();
      }
    } catch (err) {
      console.error(err);
      const message = t('Unable to reach the authentication server. Please try again.');
      setFormError(message);
      notifyError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!validateOtp()) return;

    setIsLoading(true);
    try {
      const response = await verifyLoginOtp(email.trim(), otp.trim());
      if (response.token) {
        localStorage.setItem('token', response.token);
        if (response.user) {
          localStorage.setItem('user', JSON.stringify(response.user));
        }
        // A customer sent here mid-purchase (e.g. from a scanned product page)
        // goes back to what they were buying rather than to their dashboard.
        const returnTo = sessionStorage.getItem('redirectAfterLogin');
        if (returnTo) {
          sessionStorage.removeItem('redirectAfterLogin');
          navigate(returnTo);
          return;
        }

        const role = response.user?.role;
        const dashRole = role?.replace('_', '-') === 'worker' ? 'farmer-worker' : role?.replace('_', '-');
        navigate(`/dashboard/${dashRole || 'farmer'}`);
      } else {
        const message = response.error || t('Login failed');
        setFormError(message);
        notifyError(message);
      }
    } catch (err) {
      console.error(err);
      const message = t('An error occurred during login');
      setFormError(message);
      notifyError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout title={t("Welcome back")} subtitle={t("Sign in to access your smart farm dashboard, alerts, analytics, and marketplace tools.")}>
      {!isOtpSent ? (
        <form noValidate className="space-y-4 rounded-[1.5rem] border border-white/15 bg-white/10 p-6 backdrop-blur-2xl" onSubmit={handleSendOtp}>
          {formError ? <FormAlert message={formError} /> : null}
          <AuthField
            label={t("Email")}
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={e => { setEmail(e.target.value); clearError('email'); setFormError(''); }}
            error={errors.email}
          />
          <AuthField
            label={t("Password")}
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={e => { setPassword(e.target.value); clearError('password'); setFormError(''); }}
            error={errors.password}
          />
          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 text-white/70">
              <input type="checkbox" className="rounded border-white/30 bg-white/10" /> {t("Remember me")}
            </label>
            <Link to="/forgot-password" className="font-semibold text-emerald-200">{t("Forgot password?")}</Link>
          </div>
          <Button className="w-full" type="submit" disabled={isLoading}>
            {isLoading ? t('Sending OTP...') : t('Login & Send OTP')}
          </Button>
          <p className="text-center text-sm text-white/70">{t("New user?")} <Link to="/register" className="font-semibold text-emerald-200">{t("Create account")}</Link></p>
        </form>
      ) : (
        <form noValidate className="space-y-4 rounded-[1.5rem] border border-white/15 bg-white/10 p-6 backdrop-blur-2xl" onSubmit={handleVerifyOtp}>
          <h3 className="text-xl font-semibold text-white text-center">{t("Verify Your Email")}</h3>
          <p className="text-white/70 text-center text-sm">{t("We've sent a 6-digit OTP to")} {email}</p>
          {formError ? <FormAlert message={formError} /> : null}
          <AuthField
            label={t("Enter OTP")}
            type="text"
            inputMode="numeric"
            placeholder="XXXXXX"
            value={otp}
            onChange={e => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); clearError('otp'); setFormError(''); }}
            maxLength={6}
            error={errors.otp}
          />
          {otpTimer > 0 && (
            <p className="text-center text-sm text-white/70">{t("Time remaining:")} {formatTimer(otpTimer)}</p>
          )}
          {otpExpired && (
            <p className="text-center text-sm text-red-500">{t("OTP has expired. Please request a new OTP.")}</p>
          )}
          <Button className="w-full" type="submit" disabled={isLoading || otpExpired}>
            {isLoading ? t('Verifying...') : t('Verify OTP & Login')}
          </Button>
          <div className="text-center">
            <button
              type="button"
              onClick={handleResendOtp}
              disabled={isLoading || otpTimer > 0}
              className="text-sm font-semibold text-emerald-200 hover:underline disabled:opacity-50"
            >
              {t("Resend OTP")}
            </button>
          </div>
        </form>
      )}
    </AuthLayout>
  );
}

function FormAlert({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-rose-400/30 bg-rose-500/15 px-4 py-3 text-sm font-medium leading-relaxed text-rose-100">
      {message}
    </div>
  );
}

function AuthField({ label, error, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-white/80">{label}</span>
      <input
        {...props}
        aria-invalid={Boolean(error)}
        className={`farm-input ${error ? '!border-rose-400/70' : ''}`}
      />
      {error ? <span className="mt-1.5 block text-xs font-semibold text-rose-300">{error}</span> : null}
    </label>
  );
}
