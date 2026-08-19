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
  payment_status?: string | null;
  manager_notes?: string | null;
  payment_method?: string | null;
  account_details?: string | null;
};

const paymentMethods = ['Cash', 'Bank Transfer', 'Online Bank Payout'];

const maskAccountDetails = (details?: string | null) => {
  if (!details) return 'Account details not provided';
  return details.replace(/\d{4,}/g, (accountNumber) => `**** ${accountNumber.slice(-4)}`);
};

const normalizePaymentMethod = (method?: string | null): 'Cash' | 'Bank Transfer' | 'Online Bank Payout' => {
  if (method === 'Bank Transfer') return 'Bank Transfer';
  if (method === 'Online' || method === 'Online Bank Payout') return 'Online Bank Payout';
  return 'Cash';
};

const getBeneficiaryDetails = (details?: string | null) => {
  const values = String(details || '').split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
  const accountNumberIndex = values.findIndex((value) => /\d{4,}/.test(value));
  const accountNumber = accountNumberIndex >= 0 ? values[accountNumberIndex] : '';
  const bankName = accountNumberIndex > 0 ? values[accountNumberIndex - 1] : 'BOC';
  const beneficiaryName = values.slice(accountNumberIndex + 1).join(' ') || values[values.length - 1] || 'Not provided';

  return {
    bankName,
    accountNumber: accountNumber ? maskAccountDetails(accountNumber) : 'Not provided',
    beneficiaryName,
  };
};

export default function SalaryPaymentPage() {
  const [month, setMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [payrolls, setPayrolls] = useState<PayrollRow[]>([]);
  const [advances, setAdvances] = useState<AdvanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [method, setMethod] = useState('Cash');

  // New Payment Modal State
  const [payingAdvance, setPayingAdvance] = useState<AdvanceRow | null>(null);
  const [payingPayroll, setPayingPayroll] = useState<PayrollRow | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Bank Transfer' | 'Online Bank Payout'>('Cash');
  const [txnReference, setTxnReference] = useState('');
  const [isSubmittingPay, setIsSubmittingPay] = useState(false);
  const [payNotes, setPayNotes] = useState('');
  const [farmSourceAccount, setFarmSourceAccount] = useState('Farm account not configured');

  const openAdvancePayment = (advance: AdvanceRow, fallbackMethod: 'Cash' | 'Bank Transfer' | 'Online Bank Payout') => {
    const selectedMethod = normalizePaymentMethod(advance.payment_method) === 'Cash'
      ? fallbackMethod
      : normalizePaymentMethod(advance.payment_method);
    setPayingAdvance(advance);
    setPaymentMethod(selectedMethod);
    setTxnReference(selectedMethod === 'Bank Transfer' || selectedMethod === 'Online Bank Payout'
      ? `BOC-ADV-${Date.now().toString(36).toUpperCase()}`
      : '');
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, year]);

  useEffect(() => {
    api('/api/salary/payout-config').then((data) => {
      if (data.sourceAccount) setFarmSourceAccount(data.sourceAccount);
    }).catch(() => setFarmSourceAccount('Farm account not configured'));
  }, []);

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

  const pendingPayrolls = useMemo(() => payrolls.filter((item) => String(item.payment_status || '').toLowerCase() !== 'paid' && String(item.payment_status || '').toLowerCase() !== 'fully paid'), [payrolls]);

  const approvePayroll = async (id: string) => {
    await api(`/api/salary/${id}/approve`, { method: 'PUT' });
    fetchData();
  };

  const reviewAdvance = async (id: string, action: 'Approve' | 'Reject') => {
    await api(`/api/salary/advances/${id}/review`, {
      method: 'PUT',
      body: JSON.stringify({
        action,
        notes: action === 'Approve' ? 'Approved - Payment Pending' : 'Rejected',
      }),
    });
    fetchData();
  };

  const rejectAdvance = async (id: string) => {
    const reason = window.prompt("Enter rejection reason:");
    if (reason === null) return;
    if (!reason.trim()) {
      alert("Rejection reason is required.");
      return;
    }
    await api(`/api/salary/advances/${id}/review`, {
      method: 'PUT',
      body: JSON.stringify({
        action: 'Reject',
        notes: reason.trim(),
      }),
    });
    fetchData();
  };

  const handleConfirmPayment = async () => {
    setIsSubmittingPay(true);
    try {
      if (payingAdvance) {
        const res = await api(`/api/salary/advances/${payingAdvance.id}/pay`, {
          method: 'POST',
          body: JSON.stringify({
            paymentMethod,
            transactionReference: txnReference,
          }),
        });
        if (res.error) {
          alert(res.error);
        } else {
          setPayingAdvance(null);
          setTxnReference('');
          setPayNotes('');
          fetchData();
        }
      } else if (payingPayroll) {
        const res = await api(`/api/salary/${payingPayroll.id}/process`, {
          method: 'PUT',
          body: JSON.stringify({
            paymentMethod,
            transactionReference: txnReference,
            notes: payNotes,
          }),
        });
        if (res.error) {
          alert(res.error);
        } else {
          setPayingPayroll(null);
          setTxnReference('');
          setPayNotes('');
          fetchData();
        }
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Payment processing failed');
    } finally {
      setIsSubmittingPay(false);
    }
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

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
        <Card title="Payroll Queue" subtitle="Approve and pay workers individually">
          {loading ? (
            <p className="text-slate-500">Loading...</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-xs">
                  <tr>
                    <th className="px-4 py-3">Farmer</th>
                    <th className="px-4 py-3">Month</th>
                    <th className="px-4 py-3">Earned Salary</th>
                    <th className="px-4 py-3">Advance Paid</th>
                    <th className="px-4 py-3">Partial Paid</th>
                    <th className="px-4 py-3">Deductions</th>
                    <th className="px-4 py-3">Remaining Salary</th>
                    <th className="px-4 py-3">Payment Status</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pendingPayrolls.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-slate-500">No payroll records for this period.</td>
                    </tr>
                  ) : (
                    pendingPayrolls.map((row) => {
                      const net = Number(row.net_salary ?? row.gross_salary ?? 0);
                      const adv = Number((row as any).advance_paid ?? 0);
                      const part = Number((row as any).partial_paid ?? 0);
                      const ded = Number((row as any).deductions ?? 0);
                      const remaining = Math.max(0, net - adv - part);

                      return (
                        <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-4 font-semibold text-slate-900">{row.worker_name}</td>
                          <td className="px-4 py-4 text-slate-600">{row.payment_month}</td>
                          <td className="px-4 py-4 text-slate-900 font-medium">Rs. {net.toFixed(2)}</td>
                          <td className="px-4 py-4 text-rose-600 font-medium">Rs. {adv.toFixed(2)}</td>
                          <td className="px-4 py-4 text-rose-600 font-medium">Rs. {part.toFixed(2)}</td>
                          <td className="px-4 py-4 text-slate-500">Rs. {ded.toFixed(2)}</td>
                          <td className="px-4 py-4 font-bold text-blue-600">Rs. {remaining.toFixed(2)}</td>
                          <td className="px-4 py-4">
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                              row.payment_status === 'Approved' ? 'bg-emerald-50 text-emerald-700' :
                              row.payment_status === 'PARTIALLY PAID' ? 'bg-amber-50 text-amber-700' :
                              row.payment_status === 'Payment Pending Confirmation' ? 'bg-indigo-50 text-indigo-700' :
                              'bg-slate-50 text-slate-700'
                            }`}>
                              {row.payment_status}
                            </span>
                          </td>
                          <td className="px-4 py-4 space-x-2">
                            {row.payment_status === 'Pending' && (
                              <button 
                                onClick={() => approvePayroll(row.id)} 
                                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 shadow-sm transition-all"
                              >
                                Approve
                              </button>
                            )}
                            {row.payment_status !== 'Pending' && (
                              <button 
                                onClick={() => { setPayingPayroll(row); setPaymentMethod(method as 'Cash' | 'Bank Transfer' | 'Online Bank Payout'); }} 
                                className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 shadow-sm transition-all"
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

        <Card title="Advance Requests" subtitle="Approve or reject salary advances">
          <div className="space-y-3">
            {advances.length === 0 ? (
              <p className="text-slate-500">No salary advance requests.</p>
            ) : advances.filter((item) => String(item.status || '').trim().toLowerCase() !== 'pending').map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-100 p-4 space-y-2 bg-white hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{item.worker_name}</p>
                    <p className="text-xs text-slate-500">{item.payroll_month} • {item.worker_phone || 'No phone'}</p>
                  </div>
                  <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${
                    item.status === 'Paid' ? 'bg-emerald-100 text-emerald-800' :
                    item.status === 'Rejected' ? 'bg-rose-100 text-rose-800' :
                    item.payment_status === 'Processing' ? 'bg-amber-100 text-amber-800' :
                    'bg-slate-100 text-slate-800'
                  }`}>
                    {item.status === 'Approved' ? 'Advance Paid' : item.status}
                  </span>
                </div>
                <p className="text-sm text-slate-600 bg-slate-50/50 p-2 rounded-xl border border-slate-100/50"><strong>Reason:</strong> {item.reason}</p>
                <div className="flex items-center justify-between border-t border-slate-100 pt-2 mt-2">
                  <span className="text-xs font-semibold text-slate-400">Request Amount:</span>
                  <span className="font-bold text-slate-900">Rs. {Number(item.amount).toFixed(2)}</span>
                </div>

                {item.manager_notes && (
                  <p className="text-xs text-slate-500 italic"><strong>Manager notes:</strong> {item.manager_notes}</p>
                )}
                
                {normalizePaymentMethod(item.payment_method) !== 'Cash' && (
                  <div className="rounded-xl bg-slate-50/50 p-3 text-xs text-slate-600 border border-slate-100 space-y-1">
                    <div className="flex justify-between gap-3"><span>Payment method</span><strong className="text-slate-900">{normalizePaymentMethod(item.payment_method)}</strong></div>
                    <div className="flex justify-between gap-3"><span>Bank name</span><strong className="text-slate-900">{getBeneficiaryDetails(item.account_details).bankName}</strong></div>
                    <div className="flex justify-between gap-3"><span>Account number</span><strong className="text-slate-900">{getBeneficiaryDetails(item.account_details).accountNumber}</strong></div>
                    <div className="flex justify-between gap-3"><span>Beneficiary name</span><strong className="text-right text-slate-900">{getBeneficiaryDetails(item.account_details).beneficiaryName}</strong></div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-2">
                  {item.status === 'Pending' && (
                    <>
                      <button onClick={() => reviewAdvance(item.id, 'Approve')} className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 shadow-sm transition-all">Approve</button>
                      <button onClick={() => rejectAdvance(item.id)} className="rounded-full bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 shadow-sm transition-all">Reject</button>
                    </>
                  )}
                  {item.status === 'Approved - Payment Pending' && item.payment_status === 'PAYMENT_PENDING' && (
                    <button onClick={() => openAdvancePayment(item, 'Cash')} className="rounded-full bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 shadow-sm transition-all">Pay Advance</button>
                  )}
                  {item.payment_status === 'Payment Pending Confirmation' && (
                    <button onClick={() => openAdvancePayment(item, 'Bank Transfer')} className="rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 shadow-sm transition-all">Confirm Bank Transfer Reference</button>
                  )}
                  {item.payment_status === 'Payment Failed' && (
                    <button onClick={() => openAdvancePayment(item, 'Online Bank Payout')} className="rounded-full bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 shadow-sm transition-all">Retry Payment</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Comprehensive Payment Modal */}
      {(payingAdvance || payingPayroll) && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto overscroll-contain">
          <div className="my-2 w-full max-w-lg max-h-[calc(100vh-2rem)] overflow-y-auto rounded-3xl bg-white shadow-2xl border border-slate-200/50">
            {/* Header */}
            <div className="bg-slate-900 px-6 py-6 text-white relative">
              <button 
                onClick={() => { setPayingAdvance(null); setPayingPayroll(null); setTxnReference(''); setPayNotes(''); }}
                className="absolute top-4 right-4 text-white/70 hover:text-white"
              >
                <FiX size={24} />
              </button>
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-md">
                <FiShield size={24} className="text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold">Secure Payout Modal</h3>
              <p className="text-slate-400 text-sm">Review details and select method.</p>
            </div>
            
            {/* Body */}
            <div className="px-6 py-6 space-y-6">
              <div className="text-center bg-slate-50 rounded-2xl py-4 border border-slate-100">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Amount to Disburse</p>
                <p className="mt-1 text-4xl font-black text-slate-900">
                  Rs. {payingAdvance ? Number(payingAdvance.amount).toFixed(2) : (() => {
                    const net = Number(payingPayroll?.net_salary ?? 0);
                    const adv = Number((payingPayroll as any)?.advance_paid ?? 0);
                    const part = Number((payingPayroll as any)?.partial_paid ?? 0);
                    return (net - adv - part).toFixed(2);
                  })()}
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between text-sm border-b border-slate-100 pb-2">
                  <span className="text-slate-500">Recipient Name:</span>
                  <span className="font-semibold text-slate-950">{payingAdvance ? payingAdvance.worker_name : payingPayroll?.worker_name}</span>
                </div>
                <div className="flex justify-between text-sm border-b border-slate-100 pb-2">
                  <span className="text-slate-500">Payroll month:</span>
                  <span className="font-semibold text-slate-950">{payingAdvance ? payingAdvance.payroll_month : payingPayroll?.payment_month}</span>
                </div>
                <div className="flex justify-between text-sm border-b border-slate-100 pb-2">
                  <span className="text-slate-500">Payment Type:</span>
                  <span className="font-semibold text-slate-950">{payingAdvance ? 'Salary Advance' : 'Final Monthly Salary'}</span>
                </div>

                <label className="space-y-2 block">
                  <span className="text-sm font-semibold text-slate-500">Select Payment Method *</span>
                  <select 
                    value={paymentMethod} 
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    disabled={payingAdvance?.payment_status === 'Payment Pending Confirmation'}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-blue-500"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Online Bank Payout">Online Bank Payout</option>
                  </select>
                </label>

                {/* Conditional Fields based on Payment Method */}
                {(paymentMethod === 'Bank Transfer' || paymentMethod === 'Online Bank Payout') && (
                  <div className="flex justify-between text-sm border border-slate-100 bg-slate-50/50 rounded-2xl p-4">
                    <span className="text-slate-500">BOC Recipient Account:</span>
                    <span className="font-bold text-slate-900">{getBeneficiaryDetails(payingAdvance?.account_details).accountNumber}</span>
                  </div>
                )}

                {(paymentMethod === 'Bank Transfer' || paymentMethod === 'Online Bank Payout') && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm space-y-2">
                    <div className="flex justify-between gap-4"><span className="text-slate-500">Bank name</span><strong className="text-slate-900">{getBeneficiaryDetails(payingAdvance?.account_details).bankName}</strong></div>
                    <div className="flex justify-between gap-4"><span className="text-slate-500">Account number</span><strong className="text-slate-900">{getBeneficiaryDetails(payingAdvance?.account_details).accountNumber}</strong></div>
                    <div className="flex justify-between gap-4"><span className="text-slate-500">Beneficiary name</span><strong className="text-right text-slate-900">{getBeneficiaryDetails(payingAdvance?.account_details).beneficiaryName}</strong></div>
                  </div>
                )}

                {(paymentMethod === 'Bank Transfer' || paymentMethod === 'Online Bank Payout') && (
                  <label className="space-y-2 block">
                    <span className="text-sm font-semibold text-slate-500">
                      BOC Bank Transaction Reference
                    </span>
                    <input
                      type="text" 
                      value={txnReference} 
                      readOnly
                      placeholder="Generated automatically"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-blue-500"
                    />
                    <p className="text-xs text-slate-400">
                      Generated automatically for this dummy BOC transfer.
                    </p>
                  </label>
                )}

                {paymentMethod === 'Online Bank Payout' && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                      <span className="font-semibold text-slate-900">Bank Transfer Details</span>
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">Ready to transfer</span>
                    </div>
                    <div className="grid gap-2">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-slate-500">From BOC farm account</span>
                        <strong className="text-right text-slate-900">{farmSourceAccount}</strong>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-slate-500">To BOC farmer account</span>
                        <strong className="text-right text-slate-900">{getBeneficiaryDetails(payingAdvance?.account_details).accountNumber}</strong>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-slate-500">Transfer reference</span>
                        <strong className="text-right text-slate-900">{txnReference || 'Generating...'}</strong>
                      </div>
                    </div>
                  </div>
                )}

                {payingPayroll && (
                  <label className="space-y-2 block">
                    <span className="text-sm font-semibold text-slate-500">Bonus (Add to this month's net salary)</span>
                    <input 
                      type="number" 
                      placeholder="0"
                      onChange={(e) => setPayNotes(e.target.value)} // Temporarily recycle notes for bonus inside modal or keep simple notes
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-blue-500"
                    />
                  </label>
                )}

                <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 text-xs text-rose-800 font-medium">
                  After this payment, Rs. {payingAdvance ? Number(payingAdvance.amount).toFixed(2) : (() => {
                    const net = Number(payingPayroll?.net_salary ?? 0);
                    const adv = Number((payingPayroll as any)?.advance_paid ?? 0);
                    const part = Number((payingPayroll as any)?.partial_paid ?? 0);
                    return (net - adv - part).toFixed(2);
                  })()} will be deducted from the farmer's remaining salary. Only Paid status transactions are subtracted.
                </div>
              </div>

              <button 
                onClick={handleConfirmPayment}
                disabled={isSubmittingPay}
                className="w-full rounded-2xl bg-slate-900 py-4 text-center text-lg font-bold text-white shadow-lg transition-all hover:bg-slate-800 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmittingPay ? 'Processing...' : payingAdvance?.payment_status === 'Payment Pending Confirmation' ? 'Confirm reference' : 'Disburse Payment'}
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
    return { error: await res.text() };
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
