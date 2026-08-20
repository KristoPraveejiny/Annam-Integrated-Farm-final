import { useEffect, useMemo, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { SectionHeading } from '../../components/ui/SectionHeading';
import { FiAlertCircle, FiCheckCircle, FiDollarSign, FiSend, FiShield, FiX } from 'react-icons/fi';

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

  // Pending requests are handled on the Salary Approval page; this page pays out the
  // ones a manager has already reviewed.
  const reviewedAdvances = useMemo(
    () => advances.filter((item) => String(item.status || '').trim().toLowerCase() !== 'pending'),
    [advances],
  );

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

  // Same figure the modal shows in the hero and in the deduction notice.
  const disburseAmount = payingAdvance
    ? Number(payingAdvance.amount)
    : Number(payingPayroll?.net_salary ?? 0)
      - Number((payingPayroll as any)?.advance_paid ?? 0)
      - Number((payingPayroll as any)?.partial_paid ?? 0);

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

      <Card title="Advance Requests" subtitle="Approve or reject salary advances">
        {loading ? (
          <p className="text-slate-500">Loading...</p>
        ) : reviewedAdvances.length === 0 ? (
          <p className="text-slate-500">No salary advance requests.</p>
        ) : (
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(320px,1fr))]">
            {reviewedAdvances.map((item) => {
              const bank = getBeneficiaryDetails(item.account_details);
              const showBankDetails = normalizePaymentMethod(item.payment_method) !== 'Cash';

              return (
                <div key={item.id} className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 transition-shadow hover:shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">{item.worker_name}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{item.payroll_month} • {item.worker_phone || 'No phone'}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                      item.status === 'Paid' ? 'bg-emerald-100 text-emerald-800' :
                      item.status === 'Rejected' ? 'bg-rose-100 text-rose-800' :
                      item.payment_status === 'Processing' ? 'bg-amber-100 text-amber-800' :
                      'bg-slate-100 text-slate-800'
                    }`}>
                      {item.status === 'Approved' ? 'Advance Paid' : item.status}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between rounded-xl bg-slate-50 px-4 py-3">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Request amount</span>
                    <span className="text-lg font-bold text-slate-900">Rs. {Number(item.amount).toFixed(2)}</span>
                  </div>

                  <dl className="grid grid-cols-[minmax(7rem,9rem)_1fr] gap-x-4 gap-y-2 text-sm">
                    <dt className="text-slate-500">Reason</dt>
                    <dd className="break-words text-slate-900">{item.reason || '—'}</dd>

                    {item.manager_notes && (
                      <>
                        <dt className="text-slate-500">Manager notes</dt>
                        <dd className="break-words text-slate-600">{item.manager_notes}</dd>
                      </>
                    )}

                    <dt className="text-slate-500">Payment method</dt>
                    <dd className="font-medium text-slate-900">{normalizePaymentMethod(item.payment_method)}</dd>

                    {showBankDetails && (
                      <>
                        <dt className="text-slate-500">Bank</dt>
                        <dd className="font-medium text-slate-900">{bank.bankName}</dd>

                        <dt className="text-slate-500">Account</dt>
                        <dd className="font-medium tabular-nums text-slate-900">{bank.accountNumber}</dd>

                        <dt className="text-slate-500">Beneficiary</dt>
                        <dd className="break-words font-medium text-slate-900">{bank.beneficiaryName}</dd>
                      </>
                    )}
                  </dl>

                  <div className="mt-auto flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                    {item.status === 'Pending' && (
                      <>
                        <button onClick={() => reviewAdvance(item.id, 'Approve')} className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-emerald-700">Approve</button>
                        <button onClick={() => rejectAdvance(item.id)} className="rounded-full bg-rose-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-rose-700">Reject</button>
                      </>
                    )}
                    {item.status === 'Approved - Payment Pending' && item.payment_status === 'PAYMENT_PENDING' && (
                      <button onClick={() => openAdvancePayment(item, 'Cash')} className="rounded-full bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-blue-700">Pay Advance</button>
                    )}
                    {item.payment_status === 'Payment Pending Confirmation' && (
                      <button onClick={() => openAdvancePayment(item, 'Bank Transfer')} className="rounded-full bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-indigo-700">Confirm Transfer Reference</button>
                    )}
                    {item.payment_status === 'Payment Failed' && (
                      <button onClick={() => openAdvancePayment(item, 'Online Bank Payout')} className="rounded-full bg-rose-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-rose-700">Retry Payment</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Comprehensive Payment Modal */}
      {(payingAdvance || payingPayroll) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overscroll-contain bg-slate-900/70 p-4 backdrop-blur-sm">
          <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-900/10">
            {/* Header */}
            <div className="flex items-start gap-4 border-b border-slate-200 bg-white px-6 py-5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-900">
                <FiShield size={20} className="text-emerald-400" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-bold leading-tight text-slate-900">Confirm payout</h3>
                <p className="mt-0.5 text-sm text-slate-500">
                  {payingAdvance ? 'Salary advance' : 'Final monthly salary'} · {payingAdvance ? payingAdvance.payroll_month : payingPayroll?.payment_month}
                </p>
              </div>
              <button
                onClick={() => { setPayingAdvance(null); setPayingPayroll(null); setTxnReference(''); setPayNotes(''); }}
                aria-label="Close"
                className="-mr-1 -mt-1 rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                <FiX size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
              <div className="space-y-6">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Amount to disburse</p>
                  <p className="mt-1 text-4xl font-black tracking-tight text-slate-900 tabular-nums">Rs. {disburseAmount.toFixed(2)}</p>
                  <dl className="mt-4 grid gap-2 border-t border-slate-200 pt-4 text-sm">
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-slate-500">Recipient</dt>
                      <dd className="text-right font-semibold text-slate-900">{payingAdvance ? payingAdvance.worker_name : payingPayroll?.worker_name}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-slate-500">Payroll month</dt>
                      <dd className="text-right font-semibold text-slate-900">{payingAdvance ? payingAdvance.payroll_month : payingPayroll?.payment_month}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-slate-500">Payment type</dt>
                      <dd className="text-right font-semibold text-slate-900">{payingAdvance ? 'Salary Advance' : 'Final Monthly Salary'}</dd>
                    </div>
                  </dl>
                </div>

                <section className="space-y-3">
                  <h4 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Payment method</h4>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    disabled={payingAdvance?.payment_status === 'Payment Pending Confirmation'}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition-colors focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Online Bank Payout">Online Bank Payout</option>
                  </select>
                  {payingAdvance?.payment_status === 'Payment Pending Confirmation' && (
                    <p className="text-xs text-slate-500">Method is locked while this transfer awaits reference confirmation.</p>
                  )}
                </section>

                {(paymentMethod === 'Bank Transfer' || paymentMethod === 'Online Bank Payout') && (
                  <section className="space-y-3">
                    <h4 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Beneficiary</h4>
                    <dl className="overflow-hidden rounded-2xl border border-slate-200 text-sm">
                      <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-4 py-3">
                        <dt className="text-slate-500">Bank name</dt>
                        <dd className="text-right font-semibold text-slate-900">{getBeneficiaryDetails(payingAdvance?.account_details).bankName}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-4 py-3">
                        <dt className="text-slate-500">Account number</dt>
                        <dd className="text-right font-semibold tabular-nums text-slate-900">{getBeneficiaryDetails(payingAdvance?.account_details).accountNumber}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-4 px-4 py-3">
                        <dt className="text-slate-500">Beneficiary name</dt>
                        <dd className="text-right font-semibold text-slate-900">{getBeneficiaryDetails(payingAdvance?.account_details).beneficiaryName}</dd>
                      </div>
                    </dl>
                  </section>
                )}

                {(paymentMethod === 'Bank Transfer' || paymentMethod === 'Online Bank Payout') && (
                  <section className="space-y-2">
                    <h4 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">BOC transaction reference</h4>
                    <input
                      type="text"
                      value={txnReference}
                      readOnly
                      placeholder="Generated automatically"
                      className="w-full cursor-default rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm tracking-wide text-slate-900 outline-none"
                    />
                    <p className="text-xs text-slate-400">Generated automatically for this dummy BOC transfer.</p>
                  </section>
                )}

                {paymentMethod === 'Online Bank Payout' && (
                  <section className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Transfer route</h4>
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-200">Ready to transfer</span>
                    </div>
                    <dl className="overflow-hidden rounded-2xl border border-slate-200 text-sm">
                      <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-4 py-3">
                        <dt className="text-slate-500">From BOC farm account</dt>
                        <dd className="text-right font-semibold tabular-nums text-slate-900">{farmSourceAccount}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-4 py-3">
                        <dt className="text-slate-500">To BOC farmer account</dt>
                        <dd className="text-right font-semibold tabular-nums text-slate-900">{getBeneficiaryDetails(payingAdvance?.account_details).accountNumber}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-4 px-4 py-3">
                        <dt className="text-slate-500">Transfer reference</dt>
                        <dd className="text-right font-mono text-xs font-semibold text-slate-900">{txnReference || 'Generating...'}</dd>
                      </div>
                    </dl>
                  </section>
                )}

                {payingPayroll && (
                  <section className="space-y-2">
                    <h4 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Bonus</h4>
                    <input
                      type="number"
                      placeholder="0"
                      onChange={(e) => setPayNotes(e.target.value)} // Temporarily recycle notes for bonus inside modal or keep simple notes
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition-colors focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                    />
                    <p className="text-xs text-slate-400">Added to this month's net salary.</p>
                  </section>
                )}

                <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <FiAlertCircle className="mt-0.5 shrink-0 text-amber-600" size={16} />
                  <p className="text-xs leading-relaxed text-amber-900">
                    Rs. {disburseAmount.toFixed(2)} will be deducted from the farmer's remaining salary after this payment.
                    Only transactions with a <strong className="font-semibold">Paid</strong> status are subtracted.
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
              <button
                onClick={() => { setPayingAdvance(null); setPayingPayroll(null); setTxnReference(''); setPayNotes(''); }}
                disabled={isSubmittingPay}
                className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-200 hover:text-slate-900 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmPayment}
                disabled={isSubmittingPay}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmittingPay && (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                )}
                {isSubmittingPay ? 'Processing...' : payingAdvance?.payment_status === 'Payment Pending Confirmation' ? 'Confirm reference' : 'Disburse payment'}
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
