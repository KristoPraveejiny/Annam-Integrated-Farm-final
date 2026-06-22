import { Link } from 'react-router-dom';
import type { InputHTMLAttributes } from 'react';
import { AuthLayout } from './AuthLayout';
import { Button } from '../../components/ui/Button';
import { useTranslation } from 'react-i18next';

export default function OtpVerificationPage() {
  const { t } = useTranslation();
  return (
    <AuthLayout title={t("Verify your OTP")} subtitle={t("Enter the one-time passcode sent to your registered contact to continue.")}>
      <form className="space-y-4 rounded-[1.5rem] border border-white/15 bg-white/8 p-6 backdrop-blur-2xl">
        <AuthField label={t("OTP Code")} placeholder={t("Enter 6-digit OTP")} />
        <Button className="w-full">{t("Verify OTP")}</Button>
        <p className="text-center text-sm text-white/70"><Link to="/login" className="font-semibold text-emerald-200">{t("Return to login")}</Link></p>
      </form>
    </AuthLayout>
  );
}

function AuthField({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-white/80">{label}</span>
      <input {...props} className="farm-input tracking-[0.35em]" />
    </label>
  );
}