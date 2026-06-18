import React, { useEffect, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { getMarketplaceStats } from '../../api/marketplace';

export default function MarketplaceManagementPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const data = await getMarketplaceStats();
      setStats(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load stats.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <p className="text-gray-500">Loading marketplace data...</p>;
  if (error) return <p className="text-red-500">{error}</p>;
  if (!stats) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Marketplace Management Overview</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-green-50 border-green-200">
          <h3 className="text-sm font-medium text-green-800">Total Revenue</h3>
          <p className="text-3xl font-bold text-green-900 mt-2">Rs. {Number(stats.revenue).toFixed(2)}</p>
        </Card>
        <Card>
          <h3 className="text-sm font-medium text-gray-500">Total Orders</h3>
          <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalOrders}</p>
        </Card>
        <Card>
          <h3 className="text-sm font-medium text-gray-500">Approved Products</h3>
          <p className="text-3xl font-bold text-gray-900 mt-2">{stats.approvedProducts}</p>
        </Card>
        <Card className="bg-yellow-50 border-yellow-200">
          <h3 className="text-sm font-medium text-yellow-800">Pending Approvals</h3>
          <p className="text-3xl font-bold text-yellow-900 mt-2">{stats.pendingProducts}</p>
        </Card>
      </div>

      <Card title="Recent Orders">
        {stats.recentOrders?.length === 0 ? (
          <p className="text-gray-500">No orders placed yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order Number</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {stats.recentOrders?.map((o: any) => (
                  <tr key={o.order_number}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">{o.order_number}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{o.customer_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">Rs. {o.total_amount}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full capitalize bg-blue-100 text-blue-800">
                        {o.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(o.created_at).toLocaleString()}</td>
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
