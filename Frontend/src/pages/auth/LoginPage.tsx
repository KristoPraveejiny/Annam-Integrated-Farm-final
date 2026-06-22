import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import type { InputHTMLAttributes } from 'react';
import { AuthLayout } from './AuthLayout';
import { Button } from '../../components/ui/Button';
import { useTranslation } from 'react-i18next';

import { sendLoginOtp, verifyLoginOtp } from '../../api/auth';

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
  const navigate = useNavigate();

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const response = await sendLoginOtp(email, password);
      if (response.error) {
        alert(t(response.error));
      } else {
        setIsOtpSent(true);
        startOtpTimer();
      }
    } catch (err) {
      console.error(err);
      alert(t('Failed to send OTP. Please ensure the Django server is running and configured.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const response = await verifyLoginOtp(email, otp);
      if (response.token) {
        localStorage.setItem('token', response.token);
        if (response.user) {
          localStorage.setItem('user', JSON.stringify(response.user));
        }
        const role = response.user?.role;
        const dashRole = role?.replace('_', '-') === 'worker' ? 'farmer-worker' : role?.replace('_', '-');
        navigate(`/dashboard/${dashRole || 'farmer'}`);
      } else {
        alert(t(response.error) || t('Login failed'));
      }
    } catch (err) {
      console.error(err);
      alert(t('An error occurred during login'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout title={t("Welcome back")} subtitle={t("Sign in to access your smart farm dashboard, alerts, analytics, and marketplace tools.")}>
      {!isOtpSent ? (
        <form className="space-y-4 rounded-[1.5rem] border border-white/15 bg-white/8 p-6 backdrop-blur-2xl" onSubmit={handleSendOtp}>
          <AuthField label={t("Email")} type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
          <AuthField label={t("Password")} type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
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
        <form className="space-y-4 rounded-[1.5rem] border border-white/15 bg-white/8 p-6 backdrop-blur-2xl" onSubmit={handleVerifyOtp}>
          <h3 className="text-xl font-semibold text-white text-center">{t("Verify Your Email")}</h3>
          <p className="text-white/70 text-center text-sm">{t("We've sent a 6-digit OTP to")} {email}</p>
          <AuthField 
            label={t("Enter OTP")} 
            type="text" 
            placeholder="XXXXXX" 
            value={otp} 
            onChange={e => setOtp(e.target.value)} 
            maxLength={6}
            required 
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
              onClick={handleSendOtp} 
              disabled={isLoading || otpTimer > 0}
              className="text-sm font-semibold text-emerald-200 hover:underline"
            >
              {t("Resend OTP")}
            </button>
          </div>
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