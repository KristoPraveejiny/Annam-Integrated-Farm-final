import { Link, useNavigate } from 'react-router-dom';
import type { InputHTMLAttributes } from 'react';
import { AuthLayout } from './AuthLayout';
import { Button } from '../../components/ui/Button';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { sendSignupOtp, verifySignupOtp } from '../../api/auth';

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
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    // Validate inputs
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      alert(t('Please enter a valid email address'));
      return;
    }
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length !== 10) {
      alert(t('Phone number must contain exactly 10 digits'));
      return;
    }
    if (password.length > 12) {
      alert(t('Password must be at most 12 characters'));
      return;
    }
    if (password !== confirmPassword) {
      alert(t('Passwords do not match'));
      return;
    }
    setIsLoading(true);
    try {
      const response = await sendSignupOtp(email);
      if (response.error) {
        alert(response.error);
      } else {
        setIsOtpSent(true);
        startOtpTimer();
      }
    } catch (err) {
      console.error(err);
      alert(t('Failed to send OTP. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  };


  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const roleMap: Record<string, string> = {
        "Super Admin": "super_admin",
        "Manager": "farm_manager",
        "Farmer": "worker",
        "Customer": "customer",
      } as const;
      const dbRole = roleMap[role as keyof typeof roleMap] || role.toLowerCase();
      
      const response = await verifySignupOtp({ 
        name, 
        email, 
        password, 
        phone, 
        role: dbRole,
        otp 
      });
      
      if (response.error) {
        alert(t(response.error));
      } else {
        alert(t('Account created successfully!'));
        navigate('/login');
      }
    } catch (err) {
      console.error(err);
      alert(t('Failed to verify OTP. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout title={t("Create your farm account")} subtitle={t("Join the platform to manage role-specific dashboards, AI insights, and marketplace operations.")}>
      {!isOtpSent ? (
        <form className="grid gap-4 rounded-[1.5rem] border border-white/15 bg-white/8 p-6 backdrop-blur-2xl sm:grid-cols-2" onSubmit={handleSendOtp}>
          <AuthField label={t("Name")} placeholder={t("Full name")} value={name} onChange={e => setName(e.target.value)} required />
          <AuthField label={t("Email")} type="email" placeholder={t("you@example.com")} value={email} onChange={e => setEmail(e.target.value)} required />
          <AuthField label={t("Phone")} type="tel" placeholder={t("+94 98765 43210")} value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0,10))} maxLength={10} required />
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-white/80">{t("User Role")}</span>
            <select name="role" value={role} onChange={e => setRole(e.target.value)} className="farm-input bg-white/6">
              <option value="Super Admin">{t("Super Admin")}</option>
              <option value="Manager">{t("Manager")}</option>
              <option value="Farmer">{t("Farmer")}</option>
              <option value="Customer">{t("Customer")}</option>
            </select>
          </label>
          <AuthField label={t("Password")} type="password" placeholder={t("••••••••")} value={password} onChange={e => setPassword(e.target.value)} maxLength={12} required />
          <AuthField label={t("Confirm Password")} type="password" placeholder={t("••••••••")} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} maxLength={12} required />
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
        <form className="space-y-4 rounded-[1.5rem] border border-white/15 bg-white/8 p-6 backdrop-blur-2xl" onSubmit={handleVerifyOtp}>
          <h3 className="text-xl font-semibold text-white text-center">{t("Verify Your Email")}</h3>
          <p className="text-white/70 text-center text-sm">{t("We've sent a 6-digit OTP to")} {email}</p>
          <AuthField 
            label={t("Enter OTP")} 
            type="text" 
            placeholder={t("XXXXXX")} 
            value={otp} 
            onChange={e => setOtp(e.target.value)} 
            maxLength={6}
            required           />
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