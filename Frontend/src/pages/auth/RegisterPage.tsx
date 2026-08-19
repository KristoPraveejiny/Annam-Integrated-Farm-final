import { Link, useNavigate } from 'react-router-dom';
import type { InputHTMLAttributes } from 'react';
import { AuthLayout } from './AuthLayout';
import { Button } from '../../components/ui/Button';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { notifyError, notifySuccess } from '../../utils/notifications';

import { sendSignupOtp, verifySignupOtp } from '../../api/auth';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Self-registration is limited to these roles; Super Admin and Farm Manager
// accounts are created by an administrator.
const SELECTABLE_ROLES = ['Farmer', 'Customer'] as const;

export default function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('Farmer');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [otpTimer, setOtpTimer] = useState<number>(0);
  const [otpExpired, setOtpExpired] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');

  // Start timer after OTP is sent
  const startOtpTimer = () => {
    setOtpTimer(300); // 5 minutes = 300 seconds
    setOtpExpired(false);
  };

  // Countdown effect
  useEffect(() => {
    if (otpTimer > 0) {
      const id = setTimeout(() => setOtpTimer(otpTimer - 1), 1000);
      return () => clearTimeout(id);
    }
  }, [otpTimer]);

  // Mark OTP as expired when timer reaches zero
  useEffect(() => {
    if (otpTimer === 0 && isOtpSent) {
      setOtpExpired(true);
    }
  }, [otpTimer, isOtpSent]);

  // Format timer display
  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const clearError = (field: string) => {
    setErrors(current => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const validateDetails = () => {
    const nextErrors: Record<string, string> = {};

    if (!name.trim()) {
      nextErrors.name = t('Full name is required');
    }

    if (!email.trim()) {
      nextErrors.email = t('Email is required');
    } else if (!EMAIL_REGEX.test(email.trim())) {
      nextErrors.email = t('Please enter a valid email address');
    }

    const phoneDigits = phone.replace(/\D/g, '');
    if (!phoneDigits) {
      nextErrors.phone = t('Phone number is required');
    } else if (phoneDigits.length !== 10) {
      nextErrors.phone = t('Phone number must contain exactly 10 digits');
    }

    if (!role) {
      nextErrors.role = t('Please select a user role');
    } else if (!SELECTABLE_ROLES.includes(role as (typeof SELECTABLE_ROLES)[number])) {
      nextErrors.role = t('Please select a valid user role');
    }

    if (!password) {
      nextErrors.password = t('Password is required');
    } else if (password.length < 8 || password.length > 12) {
      nextErrors.password = t('Password must be between 8 and 12 characters');
    } else if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      nextErrors.password = t('Password must include an uppercase letter, a lowercase letter, a number, and a special character');
    }

    if (!confirmPassword) {
      nextErrors.confirmPassword = t('Please confirm your password');
    } else if (password !== confirmPassword) {
      nextErrors.confirmPassword = t('Passwords do not match');
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const requestOtp = async () => {
    setIsLoading(true);
    try {
      const response = await sendSignupOtp(email.trim());
      if (response.error) {
        setFormError(response.error);
        notifyError(response.error);
        return false;
      }
      startOtpTimer();
      return true;
    } catch (err) {
      console.error(err);
      const message = t('Failed to send OTP. Please try again.');
      setFormError(message);
      notifyError(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!validateDetails()) return;

    const sent = await requestOtp();
    if (sent) setIsOtpSent(true);
  };

  const handleResendOtp = async () => {
    setFormError('');
    await requestOtp();
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const nextErrors: Record<string, string> = {};
    if (!otp.trim()) {
      nextErrors.otp = t('OTP is required');
    } else if (!/^\d{6}$/.test(otp.trim())) {
      nextErrors.otp = t('OTP must be exactly 6 digits');
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setIsLoading(true);
    try {
      // Self-registration is limited to Farmer and Customer; privileged roles are
      // assigned by an administrator, not chosen at sign-up.
      const roleMap: Record<string, string> = {
        "Farmer": "worker",
        "Customer": "customer",
      } as const;
      const dbRole = roleMap[role as keyof typeof roleMap] || role.toLowerCase();

      const response = await verifySignupOtp({
        name: name.trim(),
        email: email.trim(),
        password,
        phone: phone.replace(/\D/g, ''),
        role: dbRole,
        otp: otp.trim(),
      });

      if (response.error) {
        setFormError(response.error);
        notifyError(response.error);
      } else {
        notifySuccess(
          response.notice ||
            t('Your account has been created and sent to the administrator for approval. You will be able to sign in once it has been activated.'),
        );
        navigate('/login');
      }
    } catch (err) {
      console.error(err);
      const message = t('Failed to verify OTP. Please try again.');
      setFormError(message);
      notifyError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout title={t("Create your farm account")} subtitle={t("Join the platform to manage role-specific dashboards, AI insights, and marketplace operations.")}>
      {!isOtpSent ? (
        <form noValidate className="grid gap-4 rounded-[1.5rem] border border-white/15 bg-white/8 p-6 backdrop-blur-2xl sm:grid-cols-2" onSubmit={handleSendOtp}>
          <div className="sm:col-span-2 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            {t('All fields are required. New accounts must be approved by an administrator before you can sign in.')}
          </div>
          {formError ? <div className="sm:col-span-2"><FormAlert message={formError} /></div> : null}

          <AuthField
            label={t("Name")}
            placeholder={t("Full name")}
            value={name}
            onChange={e => { setName(e.target.value); clearError('name'); setFormError(''); }}
            error={errors.name}
          />
          <AuthField
            label={t("Email")}
            type="email"
            placeholder={t("you@example.com")}
            value={email}
            onChange={e => { setEmail(e.target.value); clearError('email'); setFormError(''); }}
            error={errors.email}
          />
          <AuthField
            label={t("Phone")}
            type="tel"
            inputMode="numeric"
            placeholder={t("+94 98765 43210")}
            value={phone}
            onChange={e => { setPhone(e.target.value.replace(/\D/g, '').slice(0, 10)); clearError('phone'); setFormError(''); }}
            maxLength={10}
            error={errors.phone}
          />
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-white/80">{t("User Role")}</span>
            <select
              name="role"
              value={role}
              onChange={e => { setRole(e.target.value); clearError('role'); setFormError(''); }}
              className={`farm-input bg-white/6 ${errors.role ? '!border-rose-400/70' : ''}`}
            >
              {SELECTABLE_ROLES.map(option => (
                <option key={option} value={option}>{t(option)}</option>
              ))}
            </select>
            {errors.role ? <span className="mt-1.5 block text-xs font-semibold text-rose-300">{errors.role}</span> : null}
          </label>
          <AuthField
            label={t("Password")}
            type="password"
            placeholder={t("••••••••")}
            value={password}
            onChange={e => { setPassword(e.target.value); clearError('password'); setFormError(''); }}
            maxLength={12}
            error={errors.password}
          />
          <AuthField
            label={t("Confirm Password")}
            type="password"
            placeholder={t("••••••••")}
            value={confirmPassword}
            onChange={e => { setConfirmPassword(e.target.value); clearError('confirmPassword'); setFormError(''); }}
            maxLength={12}
            error={errors.confirmPassword}
          />
          <div className="sm:col-span-2">
            <Button className="w-full" type="submit" disabled={isLoading}>
              {isLoading ? t('Sending OTP...') : t('Sign Up')}
            </Button>
          </div>
          <p className="text-center text-sm text-white/70 sm:col-span-2">
            {t("Already have an account?")} <Link to="/login" className="font-semibold text-emerald-200">{t("Login")}</Link>
          </p>
        </form>
      ) : (
        <form noValidate className="space-y-4 rounded-[1.5rem] border border-white/15 bg-white/8 p-6 backdrop-blur-2xl" onSubmit={handleVerifyOtp}>
          <h3 className="text-xl font-semibold text-white text-center">{t("Verify Your Email")}</h3>
          <p className="text-white/70 text-center text-sm">{t("We've sent a 6-digit OTP to")} {email}</p>
          {formError ? <FormAlert message={formError} /> : null}
          <AuthField
            label={t("Enter OTP")}
            type="text"
            inputMode="numeric"
            placeholder={t("XXXXXX")}
            value={otp}
            onChange={e => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); clearError('otp'); setFormError(''); }}
            maxLength={6}
            error={errors.otp}
          />
          {otpTimer > 0 && (
            <p className="text-center text-sm text-white/70">
              {t("Time remaining:")} {formatTimer(otpTimer)}
            </p>
          )}
          {otpExpired && (
            <p className="text-center text-sm text-red-500">
              {t("OTP has expired. Please request a new OTP.")}
            </p>
          )}
          <Button className="w-full" type="submit" disabled={isLoading || otpExpired}>
            {isLoading ? t('Verifying...') : t('Verify OTP & Create Account')}
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
