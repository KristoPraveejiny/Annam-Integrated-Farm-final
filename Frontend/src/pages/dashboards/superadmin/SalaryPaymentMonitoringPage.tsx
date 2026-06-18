import { useEffect, useState } from 'react';
import { Card } from '../../../components/ui/Card';
import { getAdminSalaries } from '../../../api/admin';

interface Salary {
  id: string;
  farm_name: string;
  worker_name: string;
  payment_month: string;
  basic_salary: string;
  bonus: string;
  deductions: string;
  final_payment_amount: string;
  payment_status: string;
  payment_date: string;
  created_at: string;
}

export default function SalaryPaymentMonitoringPage() {
  const [salaries, setSalaries] = useState<Salary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSalaries();
  }, []);

  const fetchSalaries = async () => {
    try {
      setLoading(true);
      const data = await getAdminSalaries();
      setSalaries(data);
    } catch (err) {
      setError('Failed to load salaries data.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Salary Payment Monitoring</h1>
      <Card>
        {loading ? (
          <p className="text-gray-500 p-4">Loading salaries...</p>
        ) : error ? (
          <p className="text-red-500 p-4">{error}</p>
        ) : salaries.length === 0 ? (
          <p className="text-gray-500 p-4">No salaries found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Worker & Farm</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Month</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {salaries.map((salary) => (
                  <tr key={salary.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{salary.worker_name}</div>
                      <div className="text-sm text-gray-500">{salary.farm_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {salary.payment_month}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div><span className="font-medium text-gray-900">${parseFloat(salary.final_payment_amount).toFixed(2)}</span></div>
                      <div className="text-xs text-gray-400">
                        (Base: ${parseFloat(salary.basic_salary).toFixed(2)}, Bonus: ${parseFloat(salary.bonus).toFixed(2)}, Ded: ${parseFloat(salary.deductions).toFixed(2)})
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full capitalize ${
                        salary.payment_status.toLowerCase() === 'paid' ? 'bg-green-100 text-green-800' :
                        salary.payment_status.toLowerCase() === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {salary.payment_status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {salary.payment_date ? new Date(salary.payment_date).toLocaleDateString() : 'N/A'}
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
