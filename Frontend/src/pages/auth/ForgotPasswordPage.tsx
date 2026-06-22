import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { InputHTMLAttributes } from 'react';
import { AuthLayout } from './AuthLayout';
import { Button } from '../../components/ui/Button';
import { confirmPasswordReset, sendPasswordResetOtp } from '../../api/auth';
import { useTranslation } from 'react-i18next';

function isStrongPassword(password: string) {
  return password.length >= 8 && password.length <= 12 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);
}

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');
    try {
      const response = await sendPasswordResetOtp(email);
      if (response.error) {
        setError(response.error);
      } else {
        setStep('reset');
        setMessage(t('OTP sent to your registered email address.'));
      }
    } catch {
      setError(t('Failed to send OTP. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    if (!isStrongPassword(newPassword)) {
      setError(t('Password must be 8-12 characters and include uppercase, lowercase, number, and special character.'));
      setLoading(false);
      return;
    }

    try {
      const response = await confirmPasswordReset(email, otp, newPassword, confirmPassword);
      if (response.error) {
        setError(response.error);
      } else {
        setMessage(t('Password reset successful. You can now sign in.'));
        setTimeout(() => navigate('/login'), 1200);
      }
    } catch {
      setError(t('Failed to reset password. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title={t("Reset your password")} subtitle={t("We will send a secure OTP to your registered email and let you create a new password.")}>
      {step === 'request' ? (
        <form className="space-y-4 rounded-[1.5rem] border border-white/15 bg-white/8 p-6 backdrop-blur-2xl" onSubmit={handleSendOtp}>
          <AuthField label={t("Registered Email")} type="email" placeholder={t("you@example.com")} value={email} onChange={(e) => setEmail(e.target.value)} required />
          {message ? <p className="rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{message}</p> : null}
          {error ? <p className="rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</p> : null}
          <Button className="w-full" type="submit" disabled={loading}>
            {loading ? t('Sending OTP...') : t('Send OTP')}
          </Button>
        </form>
      ) : (
        <form className="space-y-4 rounded-[1.5rem] border border-white/15 bg-white/8 p-6 backdrop-blur-2xl" onSubmit={handleResetPassword}>
          <AuthField label={t("Registered Email")} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <AuthField label={t("OTP Code")} placeholder={t("Enter 6-digit OTP")} value={otp} onChange={(e) => setOtp(e.target.value)} maxLength={6} required />
          <AuthField label={t("New Password")} type="password" placeholder={t("Create a strong password")} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
          <AuthField label={t("Confirm New Password")} type="password" placeholder={t("Re-enter new password")} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
          <p className="text-xs leading-6 text-white/70">{t("Password must be 8-12 characters and include uppercase, lowercase, number, and special character.")}</p>
          {message ? <p className="rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{message}</p> : null}
          {error ? <p className="rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</p> : null}
          <Button className="w-full" type="submit" disabled={loading}>
            {loading ? t('Resetting...') : t('Reset Password')}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}

function AuthField({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-white/80">{label}</span>
      <input {...props} className="farm-input" />
    </label>
  );
}
