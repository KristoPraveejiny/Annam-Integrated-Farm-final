import { useEffect, useState } from 'react';
import { Card } from '../components/ui/Card';
import { SectionHeading } from '../components/ui/SectionHeading';
import { MonthlyPaymentFormModal } from '../components/Salary/MonthlyPaymentFormModal';
import { PayrollQueueCard, type PayrollQueueRow } from '../components/Salary/PayrollQueueCard';
import { FiCheckCircle } from 'react-icons/fi';

interface ReportRow {
  worker_id: string;
  worker_name: string;
  payment_month: string;
  total_completed_tasks: string;
  total_approved_sessions: string;
  basic_salary: string;
  is_paid?: boolean;
}

const QUEUE_STATUSES = 'pending,approved,partially paid,payment pending confirmation';

const authToken = () => {
  const tokenRaw = localStorage.getItem('token');
  return tokenRaw && tokenRaw.startsWith('"') ? tokenRaw.slice(1, -1) : tokenRaw;
};

export default function SalaryReportPage() {
  const [report, setReport] = useState<ReportRow[]>([]);
  const [payrolls, setPayrolls] = useState<PayrollQueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [queueLoading, setQueueLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<ReportRow | null>(null);

  useEffect(() => {
    fetchReport();
    fetchPayrollQueue();
  }, []);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/salary/report', {
        headers: { Authorization: `Bearer ${authToken()}` }
      });
      const data = await res.json();
      setReport(data);
    } catch (err) {
      console.error('Failed to fetch salary report', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPayrollQueue = async () => {
    try {
      setQueueLoading(true);
      const res = await fetch(`/api/salary?status=${encodeURIComponent(QUEUE_STATUSES)}`, {
        headers: { Authorization: `Bearer ${authToken()}` }
      });
      const data = await res.json();
      setPayrolls(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch payroll queue', err);
      setPayrolls([]);
    } finally {
      setQueueLoading(false);
    }
  };

  const approvePayroll = async (row: PayrollQueueRow) => {
    await fetch(`/api/salary/${row.id}/approve`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${authToken()}` }
    });
    fetchPayrollQueue();
  };

  const payPayroll = (row: PayrollQueueRow) => {
    setSelectedWorker({
      worker_id: row.worker_id,
      worker_name: row.worker_name,
      payment_month: row.payment_month,
      total_completed_tasks: String(row.total_completed_tasks ?? 0),
      total_approved_sessions: String(row.total_approved_sessions ?? 0),
      basic_salary: String(Number(row.net_salary ?? row.gross_salary ?? 0)),
    });
    setIsModalOpen(true);
  };

  const refreshAll = () => {
    fetchReport();
    fetchPayrollQueue();
  };

  const openPaymentModal = (worker: ReportRow) => {
    setSelectedWorker(worker);
    setIsModalOpen(true);
  };

  return (
    <div className="section-shell space-y-6 py-10">
      <SectionHeading
        eyebrow="Manager"
        title="Salary Report"
        description="View monthly salary report and process payments."
        tone="light"
      />

      <PayrollQueueCard
        rows={payrolls}
        loading={queueLoading}
        onApprove={approvePayroll}
        onPay={payPayroll}
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
                      {item.is_paid ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                          <FiCheckCircle /> Paid
                        </span>
                      ) : (
                        <button 
                          onClick={() => openPaymentModal(item)}
                          disabled={Number(item.basic_salary) === 0}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          Make Payment
                        </button>
                      )}
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
          onPaymentSuccess={refreshAll}
        />
      )}
    </div>
  );
}
