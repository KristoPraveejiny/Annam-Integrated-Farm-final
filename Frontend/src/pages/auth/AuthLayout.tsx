import { ReactNode } from 'react';
import { FiArrowLeft, FiFeather } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

type AuthLayoutProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
};

export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  const { t } = useTranslation();
  return (
    <div className="glass-bg min-h-screen bg-[linear-gradient(160deg,#04130c_0%,#0c2d1b_42%,#071420_100%)] p-4 text-white sm:p-6">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-7xl items-center">
        <div className="grid w-full gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="relative overflow-hidden rounded-[2rem] border border-white/15 bg-white/8 p-8 backdrop-blur-2xl shadow-[0_25px_70px_rgba(2,6,23,0.28)] sm:p-10">
            <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-white/80 hover:text-white">
              <FiArrowLeft /> {t("Back to landing")}
            </Link>
            <div className="mt-10 flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/15 bg-white/10 text-white backdrop-blur-xl shadow-[0_12px_32px_rgba(16,185,129,0.18)]">
                <FiFeather />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-200">{t("Smart Farm")}</p>
                <h1 className="text-2xl font-black">{t("Management Platform")}</h1>
              </div>
            </div>
            <h2 className="mt-10 text-4xl font-black leading-tight md:text-5xl">{title}</h2>
            <p className="mt-4 max-w-lg text-base leading-7 text-emerald-50/90">{subtitle}</p>
            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl border border-white/15 bg-white/10 p-4 backdrop-blur-xl">
                <p className="text-sm font-semibold text-white/70">{t("Secure")}</p>
                <p className="mt-2 text-lg font-bold">{t("Role-based farm access")}</p>
              </div>
              <div className="rounded-3xl border border-white/15 bg-white/10 p-4 backdrop-blur-xl">
                <p className="text-sm font-semibold text-white/70">{t("Fast")}</p>
                <p className="mt-2 text-lg font-bold">{t("friendly workflow")}</p>
              </div>
            </div>
          </div>
          <div className="glass-panel rounded-[2rem] border-white/15 bg-white/8 p-4 text-white shadow-[0_25px_70px_rgba(2,6,23,0.26)] sm:p-6">{children}</div>
        </div>
      </div>
    </div>
  );
}