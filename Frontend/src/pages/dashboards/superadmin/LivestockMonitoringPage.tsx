import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../../components/ui/Card';
import { getAdminLivestock } from '../../../api/admin';

interface Livestock {
  id: string;
  farm_name: string;
  group_code: string;
  tag_code: string;
  species: string;
  breed: string;
  sex: string;
  birth_date: string;
  current_weight_kg: string;
  health_status: string;
  created_at: string;
}

export default function LivestockMonitoringPage() {
  const { t } = useTranslation();
  const [livestock, setLivestock] = useState<Livestock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchLivestock();
  }, []);

  const fetchLivestock = async () => {
    try {
      setLoading(true);
      const data = await getAdminLivestock();
      setLivestock(data);
    } catch (err) {
      setError('Failed to load livestock data.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">{t("Livestock Monitoring")}</h1>
      <Card variant="dark" className="border-white/10 bg-white/[0.08] backdrop-blur-2xl">
        {loading ? (
          <p className="p-4 text-slate-300">Loading livestock...</p>
        ) : error ? (
          <p className="p-4 text-rose-400">{error}</p>
        ) : livestock.length === 0 ? (
          <p className="p-4 text-slate-300">No livestock found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10">
              <thead className="bg-slate-950/80">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">{t("Tag / Group")}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">{t("Details")}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">{t("Location")}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">{t("Health Status")}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">{t("Weight")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-slate-950/30">
                {livestock.map((animal) => (
                  <tr key={animal.id} className="hover:bg-white/5">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-white">{animal.tag_code}</div>
                      <div className="text-sm text-slate-300">Group: {animal.group_code || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                      <div><span className="font-medium text-white">{animal.species}</span> ({animal.breed || 'Unknown'})</div>
                      <div className="text-xs">Sex: {animal.sex || 'Unknown'}, DOB: {animal.birth_date ? new Date(animal.birth_date).toLocaleDateString() : 'Unknown'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                      {animal.farm_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        animal.health_status === 'healthy' ? 'bg-emerald-500/15 text-emerald-300' :
                        animal.health_status === 'watch' ? 'bg-amber-500/15 text-amber-300' :
                        animal.health_status === 'treatment' ? 'bg-orange-500/15 text-orange-300' :
                        animal.health_status === 'sold' ? 'bg-sky-500/15 text-sky-300' :
                        'bg-white/10 text-slate-300'
                      }`}>
                        {animal.health_status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                      {animal.current_weight_kg ? `${animal.current_weight_kg} kg` : 'N/A'}
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
