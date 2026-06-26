import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../../components/ui/Card';
import { getAdminFarmManagers } from '../../../api/admin';

interface FarmManager {
  id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  status: string;
  farm_name: string;
  farm_code: string;
  created_at: string;
}

export default function FarmManagerManagementPage() {
  const { t } = useTranslation();
  const [managers, setManagers] = useState<FarmManager[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchManagers();
  }, []);

  const fetchManagers = async () => {
    try {
      setLoading(true);
      const data = await getAdminFarmManagers();
      setManagers(data);
    } catch (err) {
      setError('Failed to load farm managers data.');
    } finally {
      setLoading(false);
    }
  };

  const formatPhone = (phone?: string | null) => {
    const normalized = phone?.trim();
    return normalized && normalized !== 'null' && normalized !== 'undefined' ? normalized : 'No phone';
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">{t("Farm Manager Management (Monitoring)")}</h1>
      <Card variant="dark" className="border-white/10 bg-white/[0.08] backdrop-blur-2xl">
        {loading ? (
          <p className="text-slate-300 p-4">Loading farm managers...</p>
        ) : error ? (
          <p className="p-4 text-rose-400">{error}</p>
        ) : managers.length === 0 ? (
          <p className="text-slate-300 p-4">No farm managers found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10">
              <thead className="bg-slate-950/80">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">{t("Name")}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">{t("Contact")}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">{t("Status")}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">{t("Registered")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-slate-950/30">
                {managers.map((manager) => (
                  <tr key={manager.id} className="hover:bg-white/5">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{manager.full_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                      <div>{manager.email}</div>
                      <div className="text-xs">{formatPhone(manager.phone)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        manager.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {manager.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                      {new Date(manager.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
