import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { SectionHeading } from '../../components/ui/SectionHeading';
import { FiUser, FiMail, FiPhone, FiMapPin, FiShield } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';

export default function FarmerProfilePage() {
  const { t } = useTranslation();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        setUser({ name: 'Farmer', email: 'farmer@example.com', role: 'worker' });
      }
    } else {
      setUser({ name: '', email: '', role: '' });
    }
  }, []);

  if (!user) return null;

  return (
    <div className="space-y-6 pb-20">
      <SectionHeading eyebrow={t("Profile")} title={t("My Profile")} description={t("Manage your personal information and security settings.")} tone="light" />

      <div className="grid gap-6 xl:grid-cols-[1fr_2fr]">
        <Card>
          <div className="flex flex-col items-center text-center">
            <div className="w-24 h-24 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-4xl mb-4 border-4 border-emerald-500/30">
              <FiUser />
            </div>
            <h3 className="text-xl font-bold text-white">{user.name || t('User')}</h3>
            <p className="text-emerald-400 font-semibold text-sm tracking-widest uppercase mt-1">{t(user.role ? user.role.replace('_', ' ') : 'Worker')}</p>
            <p className="text-slate-300 text-sm mt-2 flex items-center gap-2"><FiMail className="text-slate-400"/> {user.email || ''}</p>
            <p className="text-slate-400 text-sm mt-3 flex items-center justify-center gap-2">
               <FiMapPin /> {t("Assigned to: Block A & B")}
            </p>
          </div>
        </Card>

        <div className="space-y-6">
          <Card title={t("Personal Information")} subtitle={t("Update your contact details")}>
            <form className="space-y-6 mt-4">
              <div className="grid gap-6 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-white/80">{t("Full Name")}</span>
                  <div className="relative">
                     <FiUser className="absolute left-4 top-3.5 text-slate-400" />
                     <input type="text" className="farm-input w-full pl-11" defaultValue={user.name || ''} />
                  </div>
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-white/80">{t("Phone Number")}</span>
                  <div className="relative">
                     <FiPhone className="absolute left-4 top-3.5 text-slate-400" />
                     <input type="tel" className="farm-input w-full pl-11" defaultValue={user.phone || ''} />
                  </div>
                </label>
                <label className="block md:col-span-2">
                  <span className="mb-2 block text-sm font-semibold text-white/80">{t("Email Address")}</span>
                  <div className="relative">
                     <FiMail className="absolute left-4 top-3.5 text-slate-400" />
                     <input type="email" className="farm-input w-full pl-11" defaultValue={user.email || ''} />
                  </div>
                </label>
              </div>
              <Button type="button">{t("Update Profile")}</Button>
            </form>
          </Card>

          <Card title={t("Security")} subtitle={t("Change your password")}>
            <form className="space-y-6 mt-4">
               <label className="block">
                 <span className="mb-2 block text-sm font-semibold text-white/80">{t("Current Password")}</span>
                 <div className="relative">
                    <FiShield className="absolute left-4 top-3.5 text-slate-400" />
                    <input type="password" className="farm-input w-full pl-11" placeholder="••••••••" />
                 </div>
               </label>
               <div className="grid gap-6 md:grid-cols-2">
                 <label className="block">
                   <span className="mb-2 block text-sm font-semibold text-white/80">{t("New Password")}</span>
                   <div className="relative">
                      <FiShield className="absolute left-4 top-3.5 text-slate-400" />
                      <input type="password" className="farm-input w-full pl-11" placeholder="••••••••" />
                   </div>
                 </label>
                 <label className="block">
                   <span className="mb-2 block text-sm font-semibold text-white/80">{t("Confirm New Password")}</span>
                   <div className="relative">
                      <FiShield className="absolute left-4 top-3.5 text-slate-400" />
                      <input type="password" className="farm-input w-full pl-11" placeholder="••••••••" />
                   </div>
                 </label>
               </div>
               <Button type="button" variant="secondary">{t("Change Password")}</Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
