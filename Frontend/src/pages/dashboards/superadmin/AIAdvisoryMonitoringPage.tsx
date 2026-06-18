import { useEffect, useState } from 'react';
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
      <h1 className="text-2xl font-bold text-gray-900">AI Advisory Monitoring</h1>
      <Card>
        {loading ? (
          <p className="text-gray-500 p-4">Loading AI advisories...</p>
        ) : error ? (
          <p className="text-red-500 p-4">{error}</p>
        ) : advisories.length === 0 ? (
          <p className="text-gray-500 p-4">No AI advisories found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title / Summary</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Farm</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Confidence</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {advisories.map((adv) => (
                  <tr key={adv.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800 capitalize">
                        {adv.advisory_kind}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{adv.title}</div>
                      <div className="text-sm text-gray-500 truncate max-w-xs">{adv.summary}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {adv.farm_name || 'System-wide'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {adv.confidence ? `${adv.confidence}%` : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
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
