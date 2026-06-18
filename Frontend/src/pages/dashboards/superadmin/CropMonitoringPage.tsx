import { useEffect, useState } from 'react';
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
      <h1 className="text-2xl font-bold text-gray-900">Crop Monitoring</h1>
      <Card>
        {loading ? (
          <p className="text-gray-500 p-4">Loading crops...</p>
        ) : error ? (
          <p className="text-red-500 p-4">{error}</p>
        ) : crops.length === 0 ? (
          <p className="text-gray-500 p-4">No crops found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Crop</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dates</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stage & Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expected Yield</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {crops.map((crop) => (
                  <tr key={crop.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{crop.crop_name}</div>
                      <div className="text-sm text-gray-500">Var: {crop.variety || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{crop.farm_name}</div>
                      <div className="text-sm text-gray-500">Block: {crop.block_name || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div><span className="font-medium">Plant:</span> {crop.planting_date ? new Date(crop.planting_date).toLocaleDateString() : 'N/A'}</div>
                      <div><span className="font-medium">Harvest:</span> {crop.expected_harvest_date ? new Date(crop.expected_harvest_date).toLocaleDateString() : 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 capitalize">Stage: {crop.current_stage || 'N/A'}</div>
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full mt-1 ${
                        crop.status === 'growing' ? 'bg-green-100 text-green-800' :
                        crop.status === 'harvesting' ? 'bg-yellow-100 text-yellow-800' :
                        crop.status === 'harvested' ? 'bg-blue-100 text-blue-800' :
                        crop.status === 'failed' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {crop.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
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
