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
      <h1 className="text-2xl font-bold text-gray-900">{t("Livestock Monitoring")}</h1>
      <Card>
        {loading ? (
          <p className="text-gray-500 p-4">Loading livestock...</p>
        ) : error ? (
          <p className="text-red-500 p-4">{error}</p>
        ) : livestock.length === 0 ? (
          <p className="text-gray-500 p-4">No livestock found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t("Tag / Group")}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t("Details")}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t("Location")}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t("Health Status")}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t("Weight")}</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {livestock.map((animal) => (
                  <tr key={animal.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{animal.tag_code}</div>
                      <div className="text-sm text-gray-500">Group: {animal.group_code || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div><span className="font-medium text-gray-900">{animal.species}</span> ({animal.breed || 'Unknown'})</div>
                      <div className="text-xs">Sex: {animal.sex || 'Unknown'}, DOB: {animal.birth_date ? new Date(animal.birth_date).toLocaleDateString() : 'Unknown'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {animal.farm_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        animal.health_status === 'healthy' ? 'bg-green-100 text-green-800' :
                        animal.health_status === 'watch' ? 'bg-yellow-100 text-yellow-800' :
                        animal.health_status === 'treatment' ? 'bg-orange-100 text-orange-800' :
                        animal.health_status === 'sold' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {animal.health_status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
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
