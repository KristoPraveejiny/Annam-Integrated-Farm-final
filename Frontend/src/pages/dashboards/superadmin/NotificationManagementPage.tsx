import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../../components/ui/Card';
import { getAdminNotifications } from '../../../api/admin';

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  type: string;
  priority: string;
  user_name?: string | null;
  farm_name?: string | null;
  created_at: string;
  read_at?: string | null;
};

export default function NotificationManagementPage() {
  const { t } = useTranslation();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    void fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getAdminNotifications();
      setNotifications(data);
    } catch {
      setError('Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title={t("Notification Management")} variant="dark" className="border-white/10 bg-white/[0.08] backdrop-blur-2xl">
      {loading ? <p className="p-4 text-slate-300">Loading notifications...</p> : null}
      {error ? <p className="p-4 text-rose-400">{error}</p> : null}
      {!loading && !error ? (
        notifications.length === 0 ? (
          <p className="p-4 text-slate-300">No notifications found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10">
              <thead className="bg-slate-950/80">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">Title</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">Farm</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">Priority</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-slate-950/30">
                {notifications.map((notification) => (
                  <tr key={notification.id} className="hover:bg-white/5">
                    <td className="px-6 py-4">
                      <div className="font-medium text-white">{notification.title}</div>
                      <div className="text-sm text-slate-300">{notification.message}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-white">{notification.user_name || 'All users'}</td>
                    <td className="px-6 py-4 text-sm text-white">{notification.farm_name || 'System'}</td>
                    <td className="px-6 py-4 text-sm text-slate-300">{notification.type}</td>
                    <td className="px-6 py-4 text-sm text-slate-300">{notification.priority}</td>
                    <td className="px-6 py-4 text-sm text-slate-300">{new Date(notification.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}
    </Card>
  );
}
