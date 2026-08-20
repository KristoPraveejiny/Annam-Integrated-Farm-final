import { Card } from '../ui/Card';

export type PayrollQueueRow = {
  id: string;
  worker_id: string;
  worker_name: string;
  payment_month: string;
  payment_status: string;
  gross_salary?: number | string | null;
  net_salary?: number | string | null;
  advance_paid?: number | string | null;
  partial_paid?: number | string | null;
  deductions?: number | string | null;
  total_completed_tasks?: number | string | null;
  total_approved_sessions?: number | string | null;
};

type Props = {
  rows: PayrollQueueRow[];
  loading?: boolean;
  onApprove: (row: PayrollQueueRow) => void;
  onPay: (row: PayrollQueueRow) => void;
};

const statusClass = (status: string) => {
  if (status === 'Approved') return 'bg-emerald-50 text-emerald-700';
  if (status === 'PARTIALLY PAID') return 'bg-amber-50 text-amber-700';
  if (status === 'Payment Pending Confirmation') return 'bg-indigo-50 text-indigo-700';
  return 'bg-slate-50 text-slate-700';
};

export function PayrollQueueCard({ rows, loading, onApprove, onPay }: Props) {
  return (
    <Card title="Payroll Queue" subtitle="Approve and pay workers individually">
      {loading ? (
        <p className="text-slate-500">Loading...</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Farmer</th>
                <th className="px-4 py-3">Month</th>
                <th className="px-4 py-3">Net Salary</th>
                <th className="px-4 py-3">Advance Paid</th>
                <th className="px-4 py-3">Partial Paid</th>
                <th className="px-4 py-3">Deductions</th>
                <th className="px-4 py-3">Remaining Salary</th>
                <th className="px-4 py-3">Payment Status</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-500">No payroll records for this period.</td>
                </tr>
              ) : (
                rows.map((row) => {
                  const net = Number(row.net_salary ?? row.gross_salary ?? 0);
                  const adv = Number(row.advance_paid ?? 0);
                  const part = Number(row.partial_paid ?? 0);
                  const ded = Number(row.deductions ?? 0);
                  const remaining = Math.max(0, net - adv - part);

                  return (
                    <tr key={row.id} className="transition-colors hover:bg-slate-50/50">
                      <td className="px-4 py-4 font-semibold text-slate-900">{row.worker_name}</td>
                      <td className="px-4 py-4 text-slate-600">{row.payment_month}</td>
                      <td className="px-4 py-4 font-medium text-slate-900">Rs. {net.toFixed(2)}</td>
                      <td className="px-4 py-4 font-medium text-rose-600">Rs. {adv.toFixed(2)}</td>
                      <td className="px-4 py-4 font-medium text-rose-600">Rs. {part.toFixed(2)}</td>
                      <td className="px-4 py-4 text-slate-500">Rs. {ded.toFixed(2)}</td>
                      <td className="px-4 py-4 font-bold text-blue-600">Rs. {remaining.toFixed(2)}</td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass(row.payment_status)}`}>
                          {row.payment_status}
                        </span>
                      </td>
                      <td className="space-x-2 px-4 py-4">
                        {row.payment_status === 'Pending' ? (
                          <button
                            onClick={() => onApprove(row)}
                            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-emerald-700"
                          >
                            Approve
                          </button>
                        ) : (
                          <button
                            onClick={() => onPay(row)}
                            className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-slate-800"
                          >
                            Pay Salary
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
