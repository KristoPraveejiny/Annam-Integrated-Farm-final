import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../../components/ui/Card';
import { getAdminFarmers } from '../../../api/admin';

interface Task {
  id: string;
  title: string;
  status: string;
  due_date: string;
}

interface Attendance {
  date: string;
  status: string;
}

interface Farmer {
  id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  status: string;
  farm_name: string;
  farm_code: string;
  created_at: string;
  recent_tasks: Task[] | null;
  recent_attendance: Attendance[] | null;
}

export default function FarmerManagementPage() {
  const { t } = useTranslation();
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchFarmers();
  }, []);

  const fetchFarmers = async () => {
    try {
      setLoading(true);
      const data = await getAdminFarmers();
      setFarmers(data);
    } catch (err) {
      setError('Failed to load farmers data.');
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
      <h1 className="text-2xl font-bold text-white">{t("Farmer Management (Monitoring)")}</h1>
      <Card variant="dark" className="border-white/10 bg-white/[0.08] backdrop-blur-2xl">
        {loading ? (
          <p className="text-slate-300 p-4">Loading farmers...</p>
        ) : error ? (
          <p className="p-4 text-rose-400">{error}</p>
        ) : farmers.length === 0 ? (
          <p className="text-slate-300 p-4">No farmers found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10">
              <thead className="bg-slate-950/80">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">{t("Name")}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">{t("Contact")}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">{t("Assigned Farm")}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">{t("Recent Activity")}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">{t("Status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-slate-950/30">
                {farmers.map((farmer) => (
                  <tr key={farmer.id} className="hover:bg-white/5">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{farmer.full_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                      <div>{farmer.email}</div>
                      <div className="text-xs">{formatPhone(farmer.phone)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                      {farmer.farm_name ? (
                        <>
                          <div>{farmer.farm_name}</div>
                          <div className="text-xs text-slate-400">Code: {farmer.farm_code}</div>
                        </>
                      ) : (
                        <span className="text-slate-400">Unassigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                      <div className="mb-2">
                        <strong className="text-slate-200">Tasks:</strong>{' '}
                        {farmer.recent_tasks ? (
                          <ul className="list-disc pl-4 mt-1 space-y-1">
                            {farmer.recent_tasks.slice(0, 2).map((t, i) => (
                              <li key={i} className="text-xs">{t.title} ({t.status})</li>
                            ))}
                            {farmer.recent_tasks.length > 2 && <li className="text-xs italic">+{farmer.recent_tasks.length - 2} more...</li>}
                          </ul>
                        ) : 'None'}
                      </div>
                      <div>
                        <strong className="text-slate-200">Attendance:</strong>{' '}
                        {farmer.recent_attendance ? (
                          <ul className="list-disc pl-4 mt-1 space-y-1">
                            {farmer.recent_attendance.slice(0, 2).map((a, i) => (
                              <li key={i} className="text-xs">{new Date(a.date).toLocaleDateString()}: {a.status}</li>
                            ))}
                          </ul>
                        ) : 'None'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        farmer.status === 'active' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/10 text-slate-300'
                      }`}>
                        {farmer.status}
                      </span>
                      <div className="text-xs mt-1 text-slate-400">Since {new Date(farmer.created_at).toLocaleDateString()}</div>
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
