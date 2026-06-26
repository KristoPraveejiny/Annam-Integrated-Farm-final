import { useState, useEffect } from 'react';
import { Card } from '../../../components/ui/Card';
import { getUsers, updateUserStatus } from '../../../api/admin';
import { useTranslation } from 'react-i18next';

export default function UserManagementPage() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await getUsers();
      setUsers(data as any[]);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await updateUserStatus(id, newStatus);
      // Optimistic update
      setUsers(users.map(u => u.id === id ? { ...u, status: newStatus } : u));
    } catch (error) {
      console.error('Failed to update status:', error);
      alert('Failed to update status');
    }
  };

  return (
    <Card title={t("User Management")} subtitle={t("Manage all system users, roles, and access status")} variant="dark" className="border-white/10 bg-white/[0.08] backdrop-blur-2xl">
      {loading ? (
        <div className="p-4 text-slate-300">Loading users...</div>
      ) : (
        <div className="overflow-x-auto rounded-[1.35rem] border border-white/10">
          <table className="min-w-full divide-y divide-white/10 text-left text-sm">
            <thead className="bg-slate-950/80 text-slate-300">
              <tr>
                <th className="px-4 py-3 font-semibold">{t("Name")}</th>
                <th className="px-4 py-3 font-semibold">{t("Email")}</th>
                <th className="px-4 py-3 font-semibold">{t("Role")}</th>
                <th className="px-4 py-3 font-semibold">{t("Status")}</th>
                <th className="px-4 py-3 font-semibold">{t("Joined Date")}</th>
                <th className="px-4 py-3 font-semibold text-right">{t("Actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 bg-slate-950/30">
              {users.map(user => (
                <tr key={user.id} className="hover:bg-white/5">
                  <td className="px-4 py-3 font-medium text-white">{user.full_name}</td>
                  <td className="px-4 py-3 text-slate-300">{user.email}</td>
                  <td className="px-4 py-3 text-slate-300 capitalize">{user.role.replace('_', ' ')}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      user.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 
                      user.status === 'pending' ? 'bg-amber-50 text-amber-700' :
                      user.status === 'suspended' ? 'bg-red-50 text-red-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <select 
                    className="text-sm rounded-xl border border-white/10 bg-slate-950/70 p-2 text-white"
                      value={user.status}
                      onChange={(e) => handleStatusChange(user.id, e.target.value)}
                    >
                      <option value="active">Activate</option>
                      <option value="pending">Set Pending</option>
                      <option value="suspended">Suspend</option>
                      <option value="disabled">Disable</option>
                    </select>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">No users found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
