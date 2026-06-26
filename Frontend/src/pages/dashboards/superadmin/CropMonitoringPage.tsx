import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../../components/ui/Card';
import { getAdminCrops } from '../../../api/admin';

interface Crop {
  id: string;
  farm_name: string;
  block_name: string;
  crop_name: string;
  variety: string;
  season: string;
  planting_date: string;
  expected_harvest_date: string;
  current_stage: string;
  status: string;
  expected_yield: string;
  yield_unit: string;
  created_at: string;
}

export default function CropMonitoringPage() {
  const { t } = useTranslation();
  const [crops, setCrops] = useState<Crop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCrops();
  }, []);

  const fetchCrops = async () => {
    try {
      setLoading(true);
      const data = await getAdminCrops();
      setCrops(data);
    } catch (err) {
      setError('Failed to load crops data.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">{t("Crop Monitoring")}</h1>
      <Card variant="dark" className="border-white/10 bg-white/[0.08] backdrop-blur-2xl">
        {loading ? (
          <p className="p-4 text-slate-300">Loading crops...</p>
        ) : error ? (
          <p className="p-4 text-rose-400">{error}</p>
        ) : crops.length === 0 ? (
          <p className="p-4 text-slate-300">No crops found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10">
              <thead className="bg-slate-950/80">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">{t("Crop")}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">{t("Location")}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">{t("Dates")}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">{t("Stage & Status")}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">{t("Expected Yield")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-slate-950/30">
                {crops.map((crop) => (
                  <tr key={crop.id} className="hover:bg-white/5">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-white">{crop.crop_name}</div>
                      <div className="text-sm text-slate-300">Var: {crop.variety || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-white">{crop.farm_name}</div>
                      <div className="text-sm text-slate-300">Block: {crop.block_name || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                      <div><span className="font-medium">Plant:</span> {crop.planting_date ? new Date(crop.planting_date).toLocaleDateString() : 'N/A'}</div>
                      <div><span className="font-medium">Harvest:</span> {crop.expected_harvest_date ? new Date(crop.expected_harvest_date).toLocaleDateString() : 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-white capitalize">Stage: {crop.current_stage || 'N/A'}</div>
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full mt-1 ${
                        crop.status === 'growing' ? 'bg-emerald-500/15 text-emerald-300' :
                        crop.status === 'harvesting' ? 'bg-amber-500/15 text-amber-300' :
                        crop.status === 'harvested' ? 'bg-sky-500/15 text-sky-300' :
                        crop.status === 'failed' ? 'bg-rose-500/15 text-rose-300' :
                        'bg-white/10 text-slate-300'
                      }`}>
                        {crop.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                      {crop.expected_yield ? `${crop.expected_yield} ${crop.yield_unit}` : 'N/A'}
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
