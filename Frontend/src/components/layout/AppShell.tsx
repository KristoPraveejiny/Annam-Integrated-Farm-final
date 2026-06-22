import { useState, useEffect } from 'react';
import type { ComponentType, ReactNode } from 'react';
import { FiBell, FiMenu, FiSearch, FiGlobe, FiChevronDown } from 'react-icons/fi';
import UserProfile from './UserProfile';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { dashboardBadges } from '../../data/mock';
import { Button } from '../ui/Button';

type NavItem = {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
};

type AppShellProps = {
  role: 'super-admin' | 'farm-manager' | 'farmer-worker' | 'customer' | 'guest';
  items: readonly NavItem[];
  children: ReactNode;
};

export function AppShell({ role, items, children }: AppShellProps) {
  const { t, i18n } = useTranslation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [temp, setTemp] = useState<string>('29.5°C');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const unreadCount = notifications.filter(n => !n.read_at).length;

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const tokenRaw = localStorage.getItem('token');
        const token = tokenRaw && tokenRaw.startsWith('"') ? tokenRaw.slice(1, -1) : tokenRaw;
        if (!token) return;
        const response = await fetch('/api/notifications', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setNotifications(data);
        }
      } catch (err) {
        // silent fallback
      }
    };
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30 * 1000);
    return () => clearInterval(interval);
  }, []);

  const markAsRead = async (id: string) => {
    try {
      const tokenRaw = localStorage.getItem('token');
      const token = tokenRaw && tokenRaw.startsWith('"') ? tokenRaw.slice(1, -1) : tokenRaw;
      if (!token) return;
      await fetch(`/api/notifications/${id}/read`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
    } catch (err) {
      console.error('Failed to mark as read', err);
    }
  };

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const response = await fetch('http://127.0.0.1:8000/api/weather-advisory/');
        if (response.ok) {
          const data = await response.json();
          if (data?.weather?.temperature !== undefined) {
            setTemp(`${data.weather.temperature.toFixed(1)}°C`);
          }
        }
      } catch (err) {
        // Silent fallback
      }
    };
    fetchWeather();
    // Poll every 5 minutes
    const interval = setInterval(fetchWeather, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    i18n.changeLanguage(e.target.value);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-900 to-slate-800 text-white">
      <div className="flex min-h-screen">
        <aside className={`fixed inset-y-0 left-0 z-40 w-72 transform border-r border-white/15 bg-slate-950/35 backdrop-blur-2xl transition-transform duration-300 lg:static lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
          <div className="flex h-full flex-col px-5 py-6">
            <div className="mb-8 flex items-center gap-3">
              <div className="grid h-16 w-24 place-items-center overflow-hidden rounded-2xl border border-white/20 bg-white p-1 shadow-[0_16px_35px_rgba(16,185,129,0.2)]">
                <img src="/annam-logo.jpeg" alt="Annam Integrated Farm logo" className="h-full w-full scale-125 object-contain" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.26em] text-emerald-200">Smart Farm</p>
                <h1 className="text-lg font-semibold tracking-tight text-white">{role.replace('-', ' ')}</h1>
              </div>
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto pr-1">
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.label}
                    to={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium tracking-wide transition duration-300 ${isActive ? 'border-white/20 bg-white/12 text-white shadow-[0_10px_25px_rgba(2,6,23,0.15)]' : 'border-transparent text-white/72 hover:border-white/10 hover:bg-white/6 hover:text-white'}`
                    }
                  >
                    <Icon className="text-lg text-emerald-200" />
                    {t(item.label)}
                  </NavLink>
                );
              })}
            </nav>

            <div className="mt-6 rounded-3xl border border-white/15 bg-white/10 p-5 text-white backdrop-blur-2xl shadow-[0_20px_50px_rgba(2,6,23,0.2)]">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/80">{t("System Status")}</p>
              <p className="mt-2 text-lg font-bold">{t(dashboardBadges.online)}</p>
              <p className="mt-3 text-sm text-white/90">{t(dashboardBadges.ai)} {t("and")} {t(dashboardBadges.qr)}.</p>
            </div>
          </div>
        </aside>

        <div className="flex min-h-screen min-w-0 flex-1 flex-col lg:ml-0">
          <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/25 backdrop-blur-2xl">
            <div className="flex items-center gap-4 px-4 py-4 sm:px-6 lg:px-8">
              <Button variant="ghost" className="lg:hidden" onClick={() => setMobileOpen((value) => !value)}>
                <FiMenu />
              </Button>

              <div className="relative flex flex-1 items-center">
                <FiSearch className="pointer-events-none absolute left-4 text-white/45" />
                <input className="farm-input pl-11" placeholder={t("Search")} />
              </div>

              <div className="relative">
                <Button variant="ghost" className="relative" onClick={() => setShowNotifications(!showNotifications)}>
                  <FiBell className="text-lg" />
                  {unreadCount > 0 && (
                    <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-lg">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Button>

                {showNotifications && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                    <div className="absolute right-0 top-full mt-2 w-80 rounded-2xl border border-white/10 bg-slate-900/95 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl z-50">
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-white">{t("Notifications")}</h3>
                        {unreadCount > 0 && (
                          <span className="text-xs text-emerald-400">{unreadCount} {t("unread")}</span>
                        )}
                      </div>
                      <div className="flex max-h-[350px] flex-col gap-2 overflow-y-auto pr-1">
                        {notifications.length === 0 ? (
                          <p className="text-center text-sm text-white/50 py-6">{t("No notifications yet")}</p>
                        ) : (
                          notifications.map(n => (
                            <div 
                              key={n.id} 
                              onClick={() => !n.read_at && markAsRead(n.id)}
                              className={`cursor-pointer rounded-xl p-3 text-sm transition-all duration-300 ${!n.read_at ? 'bg-white/10 border border-white/10 shadow-sm' : 'bg-transparent hover:bg-white/5'}`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <p className={`font-medium ${!n.read_at ? 'text-white' : 'text-white/70'}`}>{n.title}</p>
                                {!n.read_at && <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-400" />}
                              </div>
                              <p className="mt-1 text-xs text-white/60 line-clamp-2">{n.message}</p>
                              <p className="mt-2 text-[10px] text-white/40">
                                {new Date(n.created_at).toLocaleDateString()} at {new Date(n.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <UserProfile />
              <div className="hidden rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white/80 backdrop-blur-2xl md:block">
                {t("Temp")}: {temp}
              </div>

              <div className="hidden sm:flex items-center gap-2">
                <div className="relative group">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-emerald-400 group-hover:text-emerald-300 transition-colors">
                    <FiGlobe className="h-4 w-4" />
                  </div>
                  <select 
                    value={i18n.language} 
                    onChange={handleLanguageChange}
                    className="appearance-none bg-white/10 border border-white/20 text-white text-sm font-medium rounded-full pl-9 pr-10 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 hover:bg-white/15 transition-all cursor-pointer backdrop-blur-md"
                  >
                    <option value="en" className="bg-slate-800">English</option>
                    <option value="ta" className="bg-slate-800">தமிழ்</option>
                    <option value="si" className="bg-slate-800">සිංහල</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-white/50 group-hover:text-white/80 transition-colors">
                    <FiChevronDown className="h-4 w-4" />
                  </div>
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
        </div>
      </div>

      {mobileOpen ? <button type="button" className="fixed inset-0 z-30 bg-slate-950/70 backdrop-blur-sm lg:hidden" aria-label="Close navigation" onClick={() => setMobileOpen(false)} /> : null}
    </div>
  );
}
