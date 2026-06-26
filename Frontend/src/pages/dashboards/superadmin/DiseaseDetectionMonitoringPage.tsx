import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../../components/ui/Card';
import { getAdminAIAdvisories } from '../../../api/admin';

interface DiseaseAdvisory {
  id: string;
  farm_name: string;
  advisory_kind: string;
  title: string;
  summary: string;
  confidence: string;
  created_at: string;
}

export default function DiseaseDetectionMonitoringPage() {
  const { t } = useTranslation();
  const [diseases, setDiseases] = useState<DiseaseAdvisory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDiseases();
  }, []);

  const fetchDiseases = async () => {
    try {
      setLoading(true);
      const data = await getAdminAIAdvisories();
      const filtered = data.filter((adv: DiseaseAdvisory) => adv.advisory_kind === 'disease');
      setDiseases(filtered);
    } catch (err) {
      setError('Failed to load disease detections data.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">{t("Disease Detection Monitoring")}</h1>
      <Card variant="dark" className="border-white/10 bg-white/[0.08] backdrop-blur-2xl">
        {loading ? (
          <p className="p-4 text-slate-300">Loading disease detections...</p>
        ) : error ? (
          <p className="p-4 text-rose-400">{error}</p>
        ) : diseases.length === 0 ? (
          <p className="p-4 text-slate-300">No disease detections found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10">
              <thead className="bg-slate-950/80">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">Disease Detected</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">Summary</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">Farm</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">Confidence</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">{t("Date")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-slate-950/30">
                {diseases.map((disease) => (
                  <tr key={disease.id} className="hover:bg-white/5">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-white">{disease.title}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-slate-300 truncate max-w-xs">{disease.summary}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                      {disease.farm_name || 'Unknown Farm'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        parseFloat(disease.confidence) > 80 ? 'bg-emerald-500/15 text-emerald-300' :
                        parseFloat(disease.confidence) > 50 ? 'bg-amber-500/15 text-amber-300' :
                        'bg-rose-500/15 text-rose-300'
                      }`}>
                        {disease.confidence ? `${disease.confidence}%` : 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                      {new Date(disease.created_at).toLocaleDateString()}
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
