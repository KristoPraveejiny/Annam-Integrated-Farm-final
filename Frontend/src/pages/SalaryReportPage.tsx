import { useEffect, useState } from 'react';
import { Card } from '../components/ui/Card';
import { SectionHeading } from '../components/ui/SectionHeading';
import { MonthlyPaymentFormModal } from '../components/Salary/MonthlyPaymentFormModal';

interface ReportRow {
  worker_id: string;
  worker_name: string;
  payment_month: string;
  total_completed_tasks: string;
  total_approved_sessions: string;
  basic_salary: string;
}

export default function SalaryReportPage() {
  const [report, setReport] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<ReportRow | null>(null);

  useEffect(() => {
    fetchReport();
  }, []);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const tokenRaw = localStorage.getItem('token');
      const token = tokenRaw && tokenRaw.startsWith('"') ? tokenRaw.slice(1, -1) : tokenRaw;
      
      const res = await fetch('/api/salary/report', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setReport(data);
    } catch (err) {
      console.error('Failed to fetch salary report', err);
    } finally {
      setLoading(false);
    }
  };

  const openPaymentModal = (worker: ReportRow) => {
    setSelectedWorker(worker);
    setIsModalOpen(true);
  };

  return (
    <div className="section-shell py-10">
      <SectionHeading 
        eyebrow="Manager" 
        title="Salary Report" 
        description="View monthly salary report and process payments." 
        tone="light" 
      />

      <Card title="Worker Salary Report" subtitle="Total completed sessions and amounts">
        {loading ? (
          <p className="text-slate-500">Loading...</p>
        ) : report.length === 0 ? (
          <p className="text-slate-500">No data available.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-100">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3">Month</th>
                  <th className="px-4 py-3">Worker</th>
                  <th className="px-4 py-3">Total Tasks</th>
                  <th className="px-4 py-3">Basic Salary</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {report.map((item) => (
                  <tr key={`${item.worker_id}-${item.payment_month}`}>
                    <td className="px-4 py-3 font-medium text-slate-900">{item.payment_month}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{item.worker_name}</td>
                    <td className="px-4 py-3 text-slate-600">{item.total_completed_tasks}</td>
                    <td className="px-4 py-3 font-semibold text-blue-600">Rs. {Number(item.basic_salary).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <button 
                        onClick={() => openPaymentModal(item)}
                        disabled={Number(item.basic_salary) === 0}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        Make Payment
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {selectedWorker && (
        <MonthlyPaymentFormModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          workerId={selectedWorker.worker_id}
          workerName={selectedWorker.worker_name}
          paymentMonth={selectedWorker.payment_month}
          totalCompletedTasks={Number(selectedWorker.total_completed_tasks)}
          totalApprovedSessions={Number(selectedWorker.total_approved_sessions)}
          basicSalary={Number(selectedWorker.basic_salary)}
          onPaymentSuccess={fetchReport}
        />
      )}
    </div>
  );
}
