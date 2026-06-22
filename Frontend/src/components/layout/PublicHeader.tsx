import { Button } from '../ui/Button';
import { useTranslation } from 'react-i18next';
import { FiGlobe, FiChevronDown } from 'react-icons/fi';

type PublicHeaderProps = {
  active?: 'home' | 'about' | 'marketplace' | 'contact';
};

const linkBase = 'text-sm font-medium transition-colors hover:text-emerald-600';
const linkActive = 'text-emerald-700';
const linkInactive = 'text-slate-600';

export function PublicHeader({ active }: PublicHeaderProps) {
  const { t, i18n } = useTranslation();
  const isActive = (name: NonNullable<PublicHeaderProps['active']>) => active === name;

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    i18n.changeLanguage(e.target.value);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 shadow-[0_8px_24px_rgba(15,23,42,0.04)] backdrop-blur-xl">
      <div className="section-shell flex items-center justify-between py-4">
        <a href="/" className="flex items-center gap-4">
          <div className="grid h-16 w-24 place-items-center overflow-hidden rounded-2xl border border-emerald-100 bg-white p-1 shadow-[0_14px_35px_rgba(15,23,42,0.08)]">
            <img src="/annam-logo.jpeg" alt="Annam Integrated Farm logo" className="h-full w-full scale-125 object-contain" />
          </div>
          <div className="hidden md:block">
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-emerald-600">Smart Farm</p>
            <p className="text-sm font-medium text-slate-600">Management & Advisory System</p>
          </div>
        </a>

        <nav className="hidden items-center gap-8 md:flex">
          <a className={`${linkBase} ${isActive('home') ? linkActive : linkInactive}`} href="/">{t("Home", "Home")}</a>
          <a className={`${linkBase} ${isActive('about') ? linkActive : linkInactive}`} href="/about">{t("About", "About")}</a>

          <a className={`${linkBase} ${isActive('marketplace') ? linkActive : linkInactive}`} href="/marketplace">{t("Marketplace")}</a>
          <a className={`${linkBase} ${isActive('contact') ? linkActive : linkInactive}`} href="/#contact">{t("Contact", "Contact")}</a>
        </nav>

        <div className="flex items-center gap-4">
          <a href="/login"><Button theme="light" variant="ghost">{t("Login")}</Button></a>
          <a href="/register"><Button theme="light">{t("Register")}</Button></a>
          <div className="relative group">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-emerald-600 group-hover:text-emerald-700 transition-colors">
              <FiGlobe className="h-4 w-4" />
            </div>
            <select 
              value={i18n.language} 
              onChange={handleLanguageChange}
              className="appearance-none bg-white border-2 border-emerald-500 text-slate-700 text-sm font-semibold rounded-full pl-9 pr-10 py-2 focus:outline-none focus:ring-4 focus:ring-emerald-500/20 hover:bg-emerald-50 transition-all cursor-pointer shadow-sm"
            >
              <option value="en">English</option>
              <option value="ta">தமிழ்</option>
              <option value="si">සිංහල</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-emerald-600 group-hover:text-emerald-700 transition-colors">
              <FiChevronDown className="h-4 w-4" />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
