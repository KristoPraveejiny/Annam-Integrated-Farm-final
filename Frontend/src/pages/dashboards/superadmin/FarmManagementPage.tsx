import { useEffect, useState } from 'react';
import { Card } from '../../../components/ui/Card';
import { getAdminFarms } from '../../../api/admin';
import { useTranslation } from 'react-i18next';
interface Farm {
  id: string;
  farm_code: string;
  name: string;
  owner_name: string;
  owner_email: string;
  total_area_acres: string;
  status: string;
  created_at: string;
}

export default function FarmManagementPage() {
  const { t } = useTranslation();
  const [farms, setFarms] = useState<Farm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchFarms();
  }, []);

  const fetchFarms = async () => {
    try {
      setLoading(true);
      const data = await getAdminFarms();
      setFarms(data);
    } catch (err) {
      setError('Failed to load farms data.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{t("Farm Management (Monitoring)")}</h1>
      <Card>
        {loading ? (
          <p className="text-gray-500 p-4">Loading farms...</p>
        ) : error ? (
          <p className="text-red-500 p-4">{error}</p>
        ) : farms.length === 0 ? (
          <p className="text-gray-500 p-4">No farms found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t("Farm Code")}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t("Name")}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t("Owner")}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t("Area (Acres)")}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t("Status")}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t("Registered")}</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {farms.map((farm) => (
                  <tr key={farm.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{farm.farm_code}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">{farm.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div>{farm.owner_name}</div>
                      <div className="text-xs">{farm.owner_email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{farm.total_area_acres || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        farm.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {farm.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(farm.created_at).toLocaleDateString()}
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
