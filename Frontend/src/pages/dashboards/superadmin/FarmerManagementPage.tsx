import { useEffect, useState } from 'react';
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
  phone: string;
  status: string;
  farm_name: string;
  farm_code: string;
  created_at: string;
  recent_tasks: Task[] | null;
  recent_attendance: Attendance[] | null;
}

export default function FarmerManagementPage() {
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Farmer Management (Monitoring)</h1>
      <Card>
        {loading ? (
          <p className="text-gray-500 p-4">Loading farmers...</p>
        ) : error ? (
          <p className="text-red-500 p-4">{error}</p>
        ) : farmers.length === 0 ? (
          <p className="text-gray-500 p-4">No farmers found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned Farm</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Recent Activity</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {farmers.map((farmer) => (
                  <tr key={farmer.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">{farmer.full_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div>{farmer.email}</div>
                      <div className="text-xs">{farmer.phone || 'No phone'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {farmer.farm_name ? (
                        <>
                          <div>{farmer.farm_name}</div>
                          <div className="text-xs text-gray-500">Code: {farmer.farm_code}</div>
                        </>
                      ) : (
                        <span className="text-gray-400">Unassigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="mb-2">
                        <strong className="text-gray-700">Tasks:</strong>{' '}
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
                        <strong className="text-gray-700">Attendance:</strong>{' '}
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
                        farmer.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {farmer.status}
                      </span>
                      <div className="text-xs mt-1 text-gray-400">Since {new Date(farmer.created_at).toLocaleDateString()}</div>
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
