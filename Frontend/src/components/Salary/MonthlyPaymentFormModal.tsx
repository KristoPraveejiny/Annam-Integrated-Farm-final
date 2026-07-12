import { useState } from 'react';
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

      if (!res.ok) throw new Error('Payment failed');

      onPaymentSuccess();
      onClose();
    } catch (err) {
      console.error('Payment error', err);
      notifyError('Failed to process payment');
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

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Bank Account Holder Name</label>
              <input type="text" required value={bankAccountName} onChange={e => setBankAccountName(e.target.value)} placeholder="e.g. John Doe" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 font-medium shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-400" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Bank Name</label>
              <input type="text" required value={bankName} onChange={e => setBankName(e.target.value)} placeholder="e.g. State Bank of India" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 font-medium shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-400" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Branch Name</label>
              <input type="text" required value={branchName} onChange={e => setBranchName(e.target.value)} placeholder="e.g. Downtown Branch" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 font-medium shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-400" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Account Number</label>
              <input type="text" required value={accountNumber} onChange={e => setAccountNumber(e.target.value)} placeholder="e.g. 1234567890" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 font-medium shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-400" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Payment Method</label>
              <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 font-medium shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all">
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cash">Cash</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Transaction Reference Number</label>
              <input type="text" required value={transactionReference} onChange={e => setTransactionReference(e.target.value)} placeholder="e.g. TXN-98765" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 font-medium shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-400" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 pt-6 border-t border-slate-100">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Basic Salary (Rs)</label>
              <input type="number" readOnly value={basicSalary} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 font-bold shadow-sm outline-none cursor-not-allowed" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Bonus (Rs)</label>
              <input type="number" min="0" value={bonus} onChange={e => setBonus(Number(e.target.value))} placeholder="0" className="w-full rounded-xl border border-emerald-200 bg-emerald-50/30 px-4 py-3 text-emerald-900 font-bold shadow-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all placeholder:text-emerald-300" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-2xl flex justify-between items-center border border-blue-100/50 shadow-inner">
            <div>
              <p className="text-sm text-slate-600 font-semibold">Payment Date: <span className="text-slate-900">{paymentDate}</span></p>
              <p className="text-sm text-slate-600 font-semibold mt-1">Total Completed Tasks: <span className="text-slate-900">{totalCompletedTasks}</span></p>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-blue-600/80 uppercase tracking-widest mb-1">Final Payment Amount</p>
              <p className="text-4xl font-black text-blue-700 drop-shadow-sm">Rs. {finalAmount.toLocaleString()}</p>
            </div>
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
