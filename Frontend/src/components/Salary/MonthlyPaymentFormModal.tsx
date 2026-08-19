import { useEffect, useState } from 'react';
import { FiX } from 'react-icons/fi';
import { notifyError } from '../../utils/notifications';

interface PaymentFormProps {
  isOpen: boolean;
  onClose: () => void;
  workerId: string;
  workerName: string;
  paymentMonth: string;
  totalCompletedTasks: number;
  totalApprovedSessions: number;
  basicSalary: number;
  onPaymentSuccess: () => void;
}

export function MonthlyPaymentFormModal({
  isOpen,
  onClose,
  workerId,
  workerName,
  paymentMonth,
  totalCompletedTasks,
  totalApprovedSessions,
  basicSalary,
  onPaymentSuccess
}: PaymentFormProps) {
  const [bankAccountName, setBankAccountName] = useState('');
  const [bankName, setBankName] = useState('');
  const [branchName, setBranchName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Bank Transfer');
  const [transactionReference, setTransactionReference] = useState('');
  const [bonus, setBonus] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [payrollRecord, setPayrollRecord] = useState<any>(null);
  const [loadingRecord, setLoadingRecord] = useState(false);

  useEffect(() => {
    if (isOpen && workerId && paymentMonth) {
      fetchPayrollRecord();
    }
  }, [isOpen, workerId, paymentMonth]);

  const fetchPayrollRecord = async () => {
    try {
      setLoadingRecord(true);
      const tokenRaw = localStorage.getItem('token');
      const token = tokenRaw && tokenRaw.startsWith('"') ? tokenRaw.slice(1, -1) : tokenRaw;
      const [yearStr, monthStr] = paymentMonth.split('-');
      const res = await fetch(`/api/salary?month=${Number(monthStr)}&year=${yearStr}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const list = await res.json();
        const found = list.find((item: any) => item.worker_id === workerId);
        setPayrollRecord(found || null);
      }
    } catch (err) {
      console.error('Error fetching payroll record for modal:', err);
    } finally {
      setLoadingRecord(false);
    }
  };

  if (!isOpen) return null;

  const finalAmount = basicSalary + bonus;
  const paymentDate = new Date().toLocaleDateString();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const tokenRaw = localStorage.getItem('token');
      const token = tokenRaw && tokenRaw.startsWith('"') ? tokenRaw.slice(1, -1) : tokenRaw;
      
      const res = await fetch(`/api/salary/pay/${workerId}`, {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          payment_month: paymentMonth,
          bank_account_name: bankAccountName,
          bank_name: bankName,
          branch_name: branchName,
          account_number: accountNumber,
          payment_method: paymentMethod,
          transaction_reference: transactionReference,
          bonus
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Payment failed');

      onPaymentSuccess();
      onClose();
    } catch (err: any) {
      console.error('Payment error', err);
      notifyError(err.message || 'Failed to process payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden my-8 border border-slate-200/50">
        <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/80 backdrop-blur-sm">
          <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">Bank Payment Details</h3>
          <button onClick={onClose} className="p-2 bg-white rounded-full text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all shadow-sm border border-slate-200">
            <FiX className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-7">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Farmer Name</label>
              <input type="text" readOnly value={workerName} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 font-medium shadow-sm outline-none cursor-not-allowed" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Payment Month</label>
              <input type="text" readOnly value={paymentMonth} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 font-medium shadow-sm outline-none cursor-not-allowed" />
            </div>
          </div>

          {/* Conditional Bank Details Inputs */}
          {paymentMethod !== 'Online Bank Payout' && (
            <>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Bank Account Holder Name</label>
                  <input type="text" required={paymentMethod === 'Bank Transfer'} value={bankAccountName} onChange={e => setBankAccountName(e.target.value)} placeholder="e.g. John Doe" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 font-medium shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-400" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Bank Name</label>
                  <input type="text" required={paymentMethod === 'Bank Transfer'} value={bankName} onChange={e => setBankName(e.target.value)} placeholder="e.g. State Bank of India" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 font-medium shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-400" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Branch Name</label>
                  <input type="text" required={paymentMethod === 'Bank Transfer'} value={branchName} onChange={e => setBranchName(e.target.value)} placeholder="e.g. Downtown Branch" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 font-medium shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-400" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Account Number</label>
                  <input type="text" required={paymentMethod === 'Bank Transfer'} value={accountNumber} onChange={e => setAccountNumber(e.target.value)} placeholder="e.g. 1234567890" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 font-medium shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-400" />
                </div>
              </div>
            </>
          )}

          {/* Masked details if Online Bank Payout or Bank Transfer is selected */}
          {(paymentMethod === 'Bank Transfer' || paymentMethod === 'Online Bank Payout') && (
            <div className="flex justify-between text-sm border border-slate-100 bg-slate-50/50 rounded-2xl p-4">
              <span className="text-slate-500 font-semibold">Masked Recipient Account Number:</span>
              <span className="font-bold text-slate-950">**** **** 6036</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Payment Method</label>
              <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 font-medium shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all">
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cash">Cash</option>
                <option value="Online Bank Payout">Online Bank Payout</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Transaction Reference Number {paymentMethod === 'Bank Transfer' ? '(Optional)' : ''}</label>
              <input type="text" required={paymentMethod === 'Bank Transfer'} value={transactionReference} onChange={e => setTransactionReference(e.target.value)} placeholder="e.g. TXN-98765" disabled={paymentMethod === 'Online Bank Payout'} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 font-medium shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-400 disabled:opacity-50" />
            </div>
          </div>

          {paymentMethod === 'Online Bank Payout' && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 space-y-1">
              <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-xs text-amber-900">
                <span className="rounded-full bg-amber-200 px-2 py-0.5 font-black">DEVELOPMENT / TEST MODE</span>
              </div>
              <p>Mock Payout Provider is active. Payouts will simulate a bank transfer with a 1000ms delay.</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-6 pt-6 border-t border-slate-100">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Basic/Net Salary (Rs)</label>
              <input type="number" readOnly value={basicSalary} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 font-bold shadow-sm outline-none cursor-not-allowed" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Add Extra Bonus (Rs)</label>
              <input type="number" min="0" value={bonus} onChange={e => setBonus(Number(e.target.value))} placeholder="0" className="w-full rounded-xl border border-emerald-200 bg-emerald-50/30 px-4 py-3 text-emerald-900 font-bold shadow-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all placeholder:text-emerald-300" />
            </div>
          </div>

          {/* Breakdown Card */}
          {payrollRecord && (
            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-5 space-y-2 text-sm text-slate-600">
              <div className="flex justify-between">
                <span>Earned Salary (Net):</span>
                <span className="font-semibold text-slate-900">Rs. {Number(payrollRecord.net_salary || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Previous Advances Paid:</span>
                <span className="font-semibold text-rose-600">- Rs. {Number(payrollRecord.advance_paid || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Partial Salary Payments:</span>
                <span className="font-semibold text-rose-600">- Rs. {Number(payrollRecord.partial_paid || 0).toFixed(2)}</span>
              </div>
              {bonus > 0 && (
                <div className="flex justify-between">
                  <span>Extra Bonus added:</span>
                  <span className="font-semibold text-emerald-600">+ Rs. {bonus.toFixed(2)}</span>
                </div>
              )}
              <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-slate-900 text-base">
                <span>Final Payment Amount:</span>
                <span className="text-blue-600">Rs. {Math.max(0, Number(payrollRecord.net_salary || 0) + bonus - Number(payrollRecord.advance_paid || 0) - Number(payrollRecord.partial_paid || 0)).toFixed(2)}</span>
              </div>
            </div>
          )}

          <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 text-xs text-rose-800 font-medium">
            After this payment, Rs. {Math.max(0, (payrollRecord ? Number(payrollRecord.net_salary || 0) - Number(payrollRecord.advance_paid || 0) - Number(payrollRecord.partial_paid || 0) : basicSalary) + bonus).toFixed(2)} will be deducted from the farmer's remaining salary.
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-6 py-3 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 hover:text-slate-900 transition-all">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="px-8 py-3 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
              {isSubmitting ? 'Processing...' : 'Submit Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
