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
      <h1 className="text-2xl font-bold text-gray-900">{t("Disease Detection Monitoring")}</h1>
      <Card>
        {loading ? (
          <p className="text-gray-500 p-4">Loading disease detections...</p>
        ) : error ? (
          <p className="text-red-500 p-4">{error}</p>
        ) : diseases.length === 0 ? (
          <p className="text-gray-500 p-4">No disease detections found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Disease Detected</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Summary</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Farm</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Confidence</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t("Date")}</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {diseases.map((disease) => (
                  <tr key={disease.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{disease.title}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-500 truncate max-w-xs">{disease.summary}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {disease.farm_name || 'Unknown Farm'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        parseFloat(disease.confidence) > 80 ? 'bg-green-100 text-green-800' :
                        parseFloat(disease.confidence) > 50 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {disease.confidence ? `${disease.confidence}%` : 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
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
