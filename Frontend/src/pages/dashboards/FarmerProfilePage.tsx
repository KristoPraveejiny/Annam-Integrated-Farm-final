import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { SectionHeading } from '../../components/ui/SectionHeading';
import { FiUser, FiMail, FiPhone, FiMapPin, FiShield } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../../utils/apiFetch';

type Feedback = { type: 'success' | 'error'; message: string } | null;

const EMPTY_PASSWORDS = { currentPassword: '', newPassword: '', confirmPassword: '' };

function FormFeedback({ feedback }: { feedback: Feedback }) {
  if (!feedback) return null;
  return (
    <p className={`text-sm font-semibold ${feedback.type === 'success' ? 'text-emerald-300' : 'text-rose-300'}`}>
      {feedback.message}
    </p>
  );
}

export default function FarmerProfilePage() {
  const { t } = useTranslation();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState({ name: '', email: '', phone: '' });
  const [passwords, setPasswords] = useState(EMPTY_PASSWORDS);
  const [profileFeedback, setProfileFeedback] = useState<Feedback>(null);
  const [passwordFeedback, setPasswordFeedback] = useState<Feedback>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Seed from localStorage so the page paints immediately, then refresh from the
  // server so a profile edited elsewhere isn't shown stale.
  useEffect(() => {
    const applyUser = (value: any) => {
      setUser(value);
      setProfile({ name: value.name || '', email: value.email || '', phone: value.phone || '' });
    };

    const stored = localStorage.getItem('user');
    if (stored) {
      try {
        applyUser(JSON.parse(stored));
      } catch {
        applyUser({ name: '', email: '', role: 'worker' });
      }
    } else {
      applyUser({ name: '', email: '', role: '' });
    }

    (async () => {
      try {
        const res = await apiFetch('/api/auth/profile');
        if (!res.ok) return;
        const data = await res.json();
        applyUser(data);
        localStorage.setItem('user', JSON.stringify(data));
      } catch {
        // Keep the locally stored values if the refresh fails.
      }
    })();
  }, []);

  const submitProfile = async () => {
    setProfileFeedback(null);

    if (!profile.name.trim()) {
      setProfileFeedback({ type: 'error', message: t('Full name is required') });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email.trim())) {
      setProfileFeedback({ type: 'error', message: t('A valid email address is required') });
      return;
    }

    setSavingProfile(true);
    try {
      const res = await apiFetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });
      const data = await res.json();

      if (!res.ok) {
        setProfileFeedback({ type: 'error', message: data.error || t('Failed to update profile') });
        return;
      }

      // The header and other pages read the cached user, so keep it in step.
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
      setProfileFeedback({ type: 'success', message: t('Profile updated successfully') });
    } catch {
      setProfileFeedback({ type: 'error', message: t('Failed to update profile') });
    } finally {
      setSavingProfile(false);
    }
  };

  const submitPassword = async () => {
    setPasswordFeedback(null);

    if (!passwords.currentPassword || !passwords.newPassword) {
      setPasswordFeedback({ type: 'error', message: t('Current and new password are required') });
      return;
    }
    if (passwords.newPassword !== passwords.confirmPassword) {
      setPasswordFeedback({ type: 'error', message: t('New password and confirmation do not match') });
      return;
    }

    setSavingPassword(true);
    try {
      const res = await apiFetch('/api/auth/change-password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(passwords),
      });
      const data = await res.json();

      if (!res.ok) {
        setPasswordFeedback({ type: 'error', message: data.error || t('Failed to change password') });
        return;
      }

      setPasswords(EMPTY_PASSWORDS);
      setPasswordFeedback({ type: 'success', message: t('Password changed successfully') });
    } catch {
      setPasswordFeedback({ type: 'error', message: t('Failed to change password') });
    } finally {
      setSavingPassword(false);
    }
  };

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
            <form
              className="space-y-6 mt-4"
              onSubmit={(event) => {
                event.preventDefault();
                submitProfile();
              }}
            >
              <div className="grid gap-6 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-white/80">{t("Full Name")}</span>
                  <div className="relative">
                     <FiUser className="absolute left-4 top-3.5 text-slate-400" />
                     <input
                       type="text"
                       className="farm-input w-full pl-11"
                       value={profile.name}
                       onChange={(event) => setProfile((prev) => ({ ...prev, name: event.target.value }))}
                     />
                  </div>
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-white/80">{t("Phone Number")}</span>
                  <div className="relative">
                     <FiPhone className="absolute left-4 top-3.5 text-slate-400" />
                     <input
                       type="tel"
                       className="farm-input w-full pl-11"
                       value={profile.phone}
                       onChange={(event) => setProfile((prev) => ({ ...prev, phone: event.target.value }))}
                     />
                  </div>
                </label>
                <label className="block md:col-span-2">
                  <span className="mb-2 block text-sm font-semibold text-white/80">{t("Email Address")}</span>
                  <div className="relative">
                     <FiMail className="absolute left-4 top-3.5 text-slate-400" />
                     <input
                       type="email"
                       className="farm-input w-full pl-11"
                       value={profile.email}
                       onChange={(event) => setProfile((prev) => ({ ...prev, email: event.target.value }))}
                     />
                  </div>
                </label>
              </div>
              <FormFeedback feedback={profileFeedback} />
              <Button type="submit" disabled={savingProfile}>
                {savingProfile ? t("Saving...") : t("Update Profile")}
              </Button>
            </form>
          </Card>

          <Card title={t("Security")} subtitle={t("Change your password")}>
            <form
              className="space-y-6 mt-4"
              onSubmit={(event) => {
                event.preventDefault();
                submitPassword();
              }}
            >
               <label className="block">
                 <span className="mb-2 block text-sm font-semibold text-white/80">{t("Current Password")}</span>
                 <div className="relative">
                    <FiShield className="absolute left-4 top-3.5 text-slate-400" />
                    <input
                      type="password"
                      autoComplete="current-password"
                      className="farm-input w-full pl-11"
                      placeholder="••••••••"
                      value={passwords.currentPassword}
                      onChange={(event) => setPasswords((prev) => ({ ...prev, currentPassword: event.target.value }))}
                    />
                 </div>
               </label>
               <div className="grid gap-6 md:grid-cols-2">
                 <label className="block">
                   <span className="mb-2 block text-sm font-semibold text-white/80">{t("New Password")}</span>
                   <div className="relative">
                      <FiShield className="absolute left-4 top-3.5 text-slate-400" />
                      <input
                        type="password"
                        autoComplete="new-password"
                        className="farm-input w-full pl-11"
                        placeholder="••••••••"
                        value={passwords.newPassword}
                        onChange={(event) => setPasswords((prev) => ({ ...prev, newPassword: event.target.value }))}
                      />
                   </div>
                 </label>
                 <label className="block">
                   <span className="mb-2 block text-sm font-semibold text-white/80">{t("Confirm New Password")}</span>
                   <div className="relative">
                      <FiShield className="absolute left-4 top-3.5 text-slate-400" />
                      <input
                        type="password"
                        autoComplete="new-password"
                        className="farm-input w-full pl-11"
                        placeholder="••••••••"
                        value={passwords.confirmPassword}
                        onChange={(event) => setPasswords((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                      />
                   </div>
                 </label>
               </div>
               <p className="text-xs text-white/60">
                 {t("Password must be 8-12 characters and include uppercase, lowercase, number, and special character.")}
               </p>
               <FormFeedback feedback={passwordFeedback} />
               <Button type="submit" variant="secondary" disabled={savingPassword}>
                 {savingPassword ? t("Saving...") : t("Change Password")}
               </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
