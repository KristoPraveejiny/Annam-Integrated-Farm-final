import { useEffect, useMemo, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { SectionHeading } from '../../components/ui/SectionHeading';
import { FiCheckCircle, FiDollarSign, FiSend, FiShield, FiX } from 'react-icons/fi';

type PayrollRow = {
  id: string;
  worker_id: string;
  worker_name: string;
  payment_month: string;
  payment_status: string;
  gross_salary?: number | string | null;
  net_salary?: number | string | null;
  final_payment_amount?: number | string | null;
  payment_method?: string | null;
  payment_date?: string | null;
};

type AdvanceRow = {
  id: string;
  worker_name: string;
  worker_phone?: string | null;
  payroll_month: string;
  amount: number;
  reason: string;
  status: string;
  payment_method?: string | null;
  account_details?: string | null;
};

const paymentMethods = ['Cash', 'Bank Transfer'];

export default function SalaryPaymentPage() {
  const [month, setMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [payrolls, setPayrolls] = useState<PayrollRow[]>([]);
  const [advances, setAdvances] = useState<AdvanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [method, setMethod] = useState('Cash');
  const [confirmingAdvance, setConfirmingAdvance] = useState<AdvanceRow | null>(null);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, year]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const tokenRaw = localStorage.getItem('token');
      const token = tokenRaw && tokenRaw.startsWith('"') ? tokenRaw.slice(1, -1) : tokenRaw;
      const [payrollRes, advanceRes] = await Promise.all([
        fetch(`/api/salary?month=${Number(month)}&year=${year}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/salary/advances', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      setPayrolls(await payrollRes.json());
      setAdvances(await advanceRes.json());
    } finally {
      setLoading(false);
    }
  };

  const pendingPayrolls = useMemo(() => payrolls.filter((item) => String(item.payment_status || '').toLowerCase() !== 'paid'), [payrolls]);

  const approvePayroll = async (id: string) => {
    await api(`/api/salary/${id}/approve`, { method: 'PUT' });
    fetchData();
  };

  const processPayment = async (id: string) => {
    await api(`/api/salary/${id}/process`, {
      method: 'PUT',
      body: JSON.stringify({
        paymentMethod: method,
        transactionReference: `PAY-${Date.now()}`,
      }),
    });
    fetchData();
  };

  const reviewAdvance = async (id: string, action: 'Approve' | 'Reject') => {
    await api(`/api/salary/advances/${id}/review`, {
      method: 'PUT',
      body: JSON.stringify({
        action,
        notes: action === 'Reject' ? 'Rejected by manager review' : 'Approved for salary deduction',
      }),
    });
    setConfirmingAdvance(null);
    fetchData();
  };

  return (
    <div className="space-y-6 pb-10">
      <SectionHeading
        eyebrow="Workforce"
        title="Salary Payment"
        description="Approve payroll, review advances, and process payments."
        tone="light"
      />

      <Card title="Payroll Period" subtitle="Choose the payroll month to process">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Month" value={month} onChange={(e) => setMonth(e.target.value)} type="number" min="1" max="12" />
          <Field label="Year" value={year} onChange={(e) => setYear(e.target.value)} type="number" />
          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-500">Payment Method</span>
            <select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900">
              {paymentMethods.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card title="Payroll Queue" subtitle="Approve and pay workers individually">
          {loading ? (
            <p className="text-slate-500">Loading...</p>
          ) : (
            <div className="space-y-3">
              {pendingPayrolls.length === 0 ? (
                <p className="text-slate-500">No payroll records for this period.</p>
              ) : (
                pendingPayrolls.map((row) => (
                  <div key={row.id} className="rounded-2xl border border-slate-100 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold text-slate-900">{row.worker_name}</p>
                        <p className="text-sm text-slate-500">{row.payment_month}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-slate-900">Rs. {Number(row.net_salary ?? row.gross_salary ?? 0).toFixed(2)}</p>
                        <p className="text-sm text-slate-500">{row.payment_status}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button onClick={() => approvePayroll(row.id)} className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 font-semibold text-white">
                        <FiCheckCircle /> Approve Salary
                      </button>
                      <button onClick={() => processPayment(row.id)} className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 font-semibold text-white">
                        <FiDollarSign /> Mark Paid
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </Card>

        <Card title="Advance Requests" subtitle="Approve or reject salary advances">
          <div className="space-y-3">
            {advances.length === 0 ? (
              <p className="text-slate-500">No salary advance requests.</p>
            ) : advances.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-100 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{item.worker_name}</p>
                    <p className="text-sm text-slate-500">{item.payroll_month}</p>
                  </div>
                  <span className="text-sm font-semibold text-amber-600">
                    {item.status === 'Approved' ? 'Advance Paid' : item.status}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-600">{item.reason}</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">Rs. {Number(item.amount).toFixed(2)}</p>
                
                {(item.payment_method === 'Bank Transfer' || item.payment_method === 'Online') && (
                  <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600 border border-slate-100">
                    <p className="font-medium text-slate-900 mb-1">Payment Instructions</p>
                    <p><strong>Method:</strong> {item.payment_method}</p>
                    <p><strong>Account Details:</strong> {item.account_details || 'N/A'}</p>
                  </div>
                )}

                {item.status === 'Pending' && (
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => setConfirmingAdvance(item)} className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Approve</button>
                    <button onClick={() => reviewAdvance(item.id, 'Reject')} className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white">Reject</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Bank Transfer Confirmation Modal */}
      {confirmingAdvance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
            {/* Header */}
            <div className="bg-emerald-600 px-6 py-6 text-white relative">
              <button 
                onClick={() => setConfirmingAdvance(null)}
                className="absolute top-4 right-4 text-white/70 hover:text-white"
              >
                <FiX size={24} />
              </button>
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md">
                <FiShield size={24} />
              </div>
              <h3 className="text-xl font-bold">Secure Transfer</h3>
              <p className="text-emerald-100 text-sm">Review payment details before confirming.</p>
            </div>
            
            {/* Body */}
            <div className="px-6 py-8">
              <div className="mb-6 text-center">
                <p className="text-sm font-semibold text-slate-500 uppercase tracking-widest">Amount to Pay</p>
                <p className="mt-1 text-4xl font-black text-slate-900">Rs. {Number(confirmingAdvance.amount).toFixed(2)}</p>
              </div>

              <div className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50 p-5">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">To:</span>
                  <span className="font-semibold text-slate-900">{confirmingAdvance.worker_name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Method:</span>
                  <span className="font-semibold text-slate-900">{confirmingAdvance.payment_method || 'Cash'}</span>
                </div>
                {(confirmingAdvance.payment_method === 'Bank Transfer' || confirmingAdvance.payment_method === 'Online') && (
                  <div className="flex justify-between text-sm border-t border-slate-200 pt-3 mt-3">
                    <span className="text-slate-500">A/C Details:</span>
                    <span className="font-semibold text-slate-900 text-right max-w-[200px] break-words">
                      {confirmingAdvance.account_details || 'Not provided'}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm border-t border-slate-200 pt-3 mt-3">
                  <span className="text-slate-500">Reference:</span>
                  <span className="font-semibold text-slate-900">{confirmingAdvance.payroll_month} Advance</span>
                </div>
              </div>

              <button 
                onClick={() => reviewAdvance(confirmingAdvance.id, 'Approve')}
                className="mt-8 w-full rounded-2xl bg-emerald-600 py-4 text-center text-lg font-bold text-white shadow-lg shadow-emerald-200 transition-transform hover:scale-[1.02] active:scale-95"
              >
                Confirm & Pay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

async function api(url: string, init?: RequestInit) {
  const tokenRaw = localStorage.getItem('token');
  const token = tokenRaw && tokenRaw.startsWith('"') ? tokenRaw.slice(1, -1) : tokenRaw;
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
    ...init,
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json().catch(() => ({}));
}

function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, className, ...rest } = props;
  return (
    <label className="space-y-2">
      <span className="text-sm font-semibold text-slate-500">{label}</span>
      <input {...rest} className={`w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-emerald-500 ${className || ''}`} />
    </label>
  );
}
