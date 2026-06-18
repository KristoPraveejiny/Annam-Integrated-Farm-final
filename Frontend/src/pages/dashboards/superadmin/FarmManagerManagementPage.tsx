import { useEffect, useState } from 'react';
import { Card } from '../../../components/ui/Card';
import { getAdminFarmManagers } from '../../../api/admin';

interface FarmManager {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  status: string;
  farm_name: string;
  farm_code: string;
  created_at: string;
}

export default function FarmManagerManagementPage() {
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Farm Manager Management (Monitoring)</h1>
      <Card>
        {loading ? (
          <p className="text-gray-500 p-4">Loading farm managers...</p>
        ) : error ? (
          <p className="text-red-500 p-4">{error}</p>
        ) : managers.length === 0 ? (
          <p className="text-gray-500 p-4">No farm managers found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned Farm</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Registered</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {managers.map((manager) => (
                  <tr key={manager.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">{manager.full_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div>{manager.email}</div>
                      <div className="text-xs">{manager.phone || 'No phone'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {manager.farm_name ? (
                        <>
                          <div>{manager.farm_name}</div>
                          <div className="text-xs text-gray-500">Code: {manager.farm_code}</div>
                        </>
                      ) : (
                        <span className="text-gray-400">Unassigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        manager.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {manager.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
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
