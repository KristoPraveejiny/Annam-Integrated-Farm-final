import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../../components/ui/Card';
import { getAdminAIAdvisories } from '../../../api/admin';

interface AIAdvisory {
  id: string;
  farm_name: string;
  advisory_kind: string;
  title: string;
  summary: string;
  confidence: string;
  created_at: string;
}

export default function AIAdvisoryMonitoringPage() {
  const { t } = useTranslation();
  const [advisories, setAdvisories] = useState<AIAdvisory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAdvisories();
  }, []);

  const fetchAdvisories = async () => {
    try {
      setLoading(true);
      const data = await getAdminAIAdvisories();
      setAdvisories(data);
    } catch (err) {
      setError('Failed to load AI advisories data.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">{t("AI Advisory Monitoring")}</h1>
      <Card variant="dark" className="border-white/10 bg-white/[0.08] backdrop-blur-2xl">
        {loading ? (
          <p className="p-4 text-slate-300">Loading AI advisories...</p>
        ) : error ? (
          <p className="p-4 text-rose-400">{error}</p>
        ) : advisories.length === 0 ? (
          <p className="p-4 text-slate-300">No AI advisories found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10">
              <thead className="bg-slate-950/80">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">Title / Summary</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">Farm</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">Confidence</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">{t("Date")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-slate-950/30">
                {advisories.map((adv) => (
                  <tr key={adv.id} className="hover:bg-white/5">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-emerald-500/15 text-emerald-300 capitalize">
                        {adv.advisory_kind}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-white">{adv.title}</div>
                      <div className="text-sm text-slate-300 truncate max-w-xs">{adv.summary}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                      {adv.farm_name || 'System-wide'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                      {adv.confidence ? `${adv.confidence}%` : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                      {new Date(adv.created_at).toLocaleDateString()}
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
