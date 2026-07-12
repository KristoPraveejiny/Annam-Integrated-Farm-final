import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FiCheckCircle,
  FiChevronRight,
  FiCreditCard,
  FiDownload,
  FiLock,
  FiShield,
  FiSmartphone,
  FiLoader,
  FiX,
} from 'react-icons/fi';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { viewCart, placeOrder, removeFromCart } from '../../api/marketplace';
import { useTranslation } from 'react-i18next';
import { notifyError, notifySuccess, notifyWarning } from '../../utils/notifications';

type PaymentMethodId = 'boc' | 'commercial' | 'sampath' | 'hnb' | 'peoples' | 'ntb' | 'dfcc' | 'seylan' | 'panasia' | 'nsb' | 'manual';
type PaymentStep = 'summary' | 'method' | 'verify' | 'processing' | 'success';

type PaymentMethod = {
  id: PaymentMethodId;
  name: string;
  subtitle: string;
  accent: string;
  logoBg: string;
  initials: string;
};

type ReceiptDetails = {
  transactionId: string;
  amountPaid: number;
  paymentDate: string;
  method: string;
  referenceId: string;
  senderDetails: {
    senderName: string;
    senderBankName: string;
    senderAccountNumber: string;
    senderPhone: string;
    senderNote: string;
  };
  items: Array<{ product_name: string; quantity: number; cart_price: number }>;
};

const paymentMethods: PaymentMethod[] = [
  {
    id: 'boc',
    name: 'BOC Mobile Banking',
    subtitle: "Sri Lanka's trusted mobile transfer app",
    accent: 'from-sky-500 to-blue-600',
    logoBg: 'bg-sky-50 text-sky-700',
    initials: 'BOC',
  },
  {
    id: 'commercial',
    name: 'Commercial Bank',
    subtitle: 'CEFT / bank app transfer',
    accent: 'from-emerald-500 to-teal-600',
    logoBg: 'bg-emerald-50 text-emerald-700',
    initials: 'CB',
  },
  {
    id: 'sampath',
    name: 'Sampath Bank',
    subtitle: 'Quick mobile banking transfer',
    accent: 'from-orange-500 to-amber-600',
    logoBg: 'bg-orange-50 text-orange-700',
    initials: 'SB',
  },
  {
    id: 'hnb',
    name: 'Hatton National Bank',
    subtitle: 'Secure HNB mobile transfer',
    accent: 'from-indigo-500 to-blue-600',
    logoBg: 'bg-indigo-50 text-indigo-700',
    initials: 'HNB',
  },
  {
    id: 'peoples',
    name: 'Peoples Bank',
    subtitle: 'Banking app transfer',
    accent: 'from-rose-500 to-red-600',
    logoBg: 'bg-rose-50 text-rose-700',
    initials: 'PB',
  },
  {
    id: 'ntb',
    name: 'Nations Trust Bank',
    subtitle: 'Intelligent banking transfer',
    accent: 'from-cyan-500 to-sky-600',
    logoBg: 'bg-cyan-50 text-cyan-700',
    initials: 'NTB',
  },
  {
    id: 'dfcc',
    name: 'DFCC Bank',
    subtitle: 'DFCC mobile banking app',
    accent: 'from-violet-500 to-purple-600',
    logoBg: 'bg-violet-50 text-violet-700',
    initials: 'DFC',
  },
  {
    id: 'seylan',
    name: 'Seylan Bank',
    subtitle: 'Mobile banking transfer',
    accent: 'from-teal-500 to-emerald-600',
    logoBg: 'bg-teal-50 text-teal-700',
    initials: 'SEY',
  },
  {
    id: 'panasia',
    name: 'Pan Asia Bank',
    subtitle: 'Pan Asia mobile app transfer',
    accent: 'from-fuchsia-500 to-pink-600',
    logoBg: 'bg-fuchsia-50 text-fuchsia-700',
    initials: 'PAB',
  },
  {
    id: 'nsb',
    name: 'NSB Mobile Banking',
    subtitle: 'National Savings Bank app',
    accent: 'from-slate-600 to-slate-800',
    logoBg: 'bg-slate-100 text-slate-700',
    initials: 'NSB',
  },
  {
    id: 'manual',
    name: 'Manual Bank Transfer',
    subtitle: 'Direct bank transfer with reference ID',
    accent: 'from-slate-600 to-slate-800',
    logoBg: 'bg-slate-100 text-slate-700',
    initials: 'MT',
  },
];

const sriLankaBankApps = [
  'Bank of Ceylon (BOC)',
  'Commercial Bank',
  'Sampath Bank',
  'Hatton National Bank',
  'People’s Bank',
  'Nations Trust Bank',
  'DFCC Bank',
  'Pan Asia Bank',
  'Seylan Bank',
  'NSB Mobile Banking',
];

const stepItems: Array<{ key: PaymentStep; label: string }> = [
  { key: 'summary', label: 'Order Summary' },
  { key: 'method', label: 'Payment Method' },
  { key: 'verify', label: 'Payment Verification' },
  { key: 'success', label: 'Payment Success' },
];

export default function CartPage() {
  const { t } = useTranslation();
  const [cartData, setCartData] = useState<{ items: any[]; totalAmount: number }>({ items: [], totalAmount: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [removingId, setRemovingId] = useState<string | null>(null);

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentStep, setPaymentStep] = useState<PaymentStep>('summary');
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodId>('commercial');
  const [transactionPin, setTransactionPin] = useState('');
  const [processing, setProcessing] = useState(false);
  const [referenceId, setReferenceId] = useState('');
  const [receipt, setReceipt] = useState<ReceiptDetails | null>(null);
  const [senderDetails, setSenderDetails] = useState({
    senderName: '',
    senderBankName: '',
    senderAccountNumber: '',
    senderPhone: '',
    senderNote: '',
  });
  const updateSenderDetail = (key: keyof typeof senderDetails, value: string) => {
    setSenderDetails((prev) => ({ ...prev, [key]: value }));
  };

  const farmAccount = useMemo(
    () => ({
      receiverName: 'Annam Integrated Farm (Pvt) Ltd',
      bankName: 'Commercial Bank of Ceylon',
      accountNumber: '1234 5678 9012',
      branch: 'Kilinochchi Branch',
      iban: 'LKXX CMCB 0123 4567 8901 2345',
    }),
    [],
  );

  const advanceAmount = useMemo(() => cartData.totalAmount * 0.25, [cartData.totalAmount]);
  const selectedMethodInfo = paymentMethods.find((method) => method.id === selectedMethod) || paymentMethods[1];
  const todayLabel = new Date().toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  useEffect(() => {
    fetchCart();
  }, []);

  const fetchCart = async () => {
    try {
      setLoading(true);
      const data = await viewCart();
      setCartData(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load cart.');
    } finally {
      setLoading(false);
    }
  };

  const openPaymentFlow = () => {
    if (cartData.items.length === 0) {
      notifyWarning('Your cart is empty.');
      return;
    }
    setPaymentOpen(true);
    setPaymentStep('summary');
    setTransactionPin('');
    setReceipt(null);
    setReferenceId(generateReferenceId());
    setSenderDetails({
      senderName: '',
      senderBankName: '',
      senderAccountNumber: '',
      senderPhone: '',
      senderNote: '',
    });
  };

  const closePaymentFlow = () => {
    if (processing) return;
    setPaymentOpen(false);
    setPaymentStep('summary');
    setTransactionPin('');
    setReferenceId('');
    setReceipt(null);
    setSenderDetails({
      senderName: '',
      senderBankName: '',
      senderAccountNumber: '',
      senderPhone: '',
      senderNote: '',
    });
  };

  const handleContinueToMethod = () => {
    setPaymentStep('method');
  };

  const handlePayClick = () => {
    const missingFields = [
      senderDetails.senderName,
      senderDetails.senderBankName,
      senderDetails.senderAccountNumber,
      senderDetails.senderPhone,
    ].some((value) => !value.trim());

    if (missingFields) {
      notifyWarning('Please fill all sender details.');
      return;
    }

    setPaymentStep('verify');
  };

  const handleVerifyAndPay = async () => {
    if (!transactionPin.trim()) {
      notifyWarning('Please enter OTP / Transaction PIN.');
      return;
    }

    try {
      setProcessing(true);
      setPaymentStep('processing');
      await new Promise((resolve) => setTimeout(resolve, 1600));
      await placeOrder({
        advanceAmount,
        paymentMethod: selectedMethod,
        senderDetails,
      });

      const successReceipt: ReceiptDetails = {
        transactionId: generateTransactionId(),
        amountPaid: advanceAmount,
        paymentDate: new Date().toLocaleString(),
        method: selectedMethodInfo.name,
        referenceId,
        senderDetails,
        items: cartData.items.map((item) => ({
          product_name: item.product_name,
          quantity: item.quantity,
          cart_price: item.cart_price,
        })),
      };

      setReceipt(successReceipt);
      setPaymentStep('success');
      notifySuccess('Payment verified successfully.');
      setTransactionPin('');
      fetchCart();
    } catch (err: any) {
      notifyError(err.response?.data?.error || 'Failed to place order.');
      setPaymentStep('method');
    } finally {
      setProcessing(false);
    }
  };

  const handleDownloadReceipt = () => {
    if (!receipt) return;

    const receiptText = [
      'Annam Integrated Farm',
      'Payment Receipt',
      '----------------------------------------',
      `Transaction ID: ${receipt.transactionId}`,
      `Reference ID: ${receipt.referenceId}`,
      `Payment Method: ${receipt.method}`,
      `Amount Paid: Rs. ${receipt.amountPaid.toFixed(2)}`,
      `Payment Date: ${receipt.paymentDate}`,
      '----------------------------------------',
      `Sender Name: ${receipt.senderDetails.senderName}`,
      `Sender Bank: ${receipt.senderDetails.senderBankName}`,
      `Sender Account: ${receipt.senderDetails.senderAccountNumber}`,
      `Sender Mobile: ${receipt.senderDetails.senderPhone}`,
      receipt.senderDetails.senderNote ? `Sender Note: ${receipt.senderDetails.senderNote}` : '',
      '----------------------------------------',
      `Receiver: ${farmAccount.receiverName}`,
      `Bank: ${farmAccount.bankName}`,
      `Masked Account: **** **** **** ${farmAccount.accountNumber.slice(-4)}`,
      `Branch: ${farmAccount.branch}`,
      '',
      'Items:',
      ...receipt.items.map((item) => `- ${item.quantity} x ${item.product_name} = Rs. ${(item.quantity * item.cart_price).toFixed(2)}`),
    ].filter(Boolean).join('\n');

    const blob = new Blob([receiptText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `receipt-${receipt.transactionId}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleRemove = async (cartItemId: string) => {
    try {
      setRemovingId(cartItemId);
      await removeFromCart(cartItemId);
      fetchCart();
    } catch (err: any) {
      notifyError(err.response?.data?.error || 'Failed to remove item.');
    } finally {
      setRemovingId(null);
    }
  };

  const isSuccess = paymentStep === 'success' && receipt;

  return (
    <div className="section-shell flex h-full min-h-0 flex-col overflow-hidden py-4 sm:py-0">
      <div className="mb-4 shrink-0 flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-white/[0.08] p-5 shadow-[0_18px_50px_rgba(2,6,23,0.22)] backdrop-blur-2xl lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-emerald-300/80">Secure Customer Checkout</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">{t('Your Cart')}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
            Premium banking-style payment flow with secure verification and instant receipt generation.
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200">
          <FiLock className="text-emerald-300" />
          Secure Payment
          <span className="hidden h-1 w-1 rounded-full bg-emerald-300 sm:inline-block" />
          <span className="hidden sm:inline">SSL Encrypted</span>
        </div>
      </div>

      <div className="grid flex-1 min-h-0 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card
          title={t('Order Summary')}
          subtitle={t('Review the items in your cart before making payment')}
          className="flex min-h-0 flex-col overflow-hidden border-white/10 bg-white/[0.08] backdrop-blur-2xl"
        >
          {loading ? (
            <p className="p-4 text-slate-300">Loading cart...</p>
          ) : error ? (
            <p className="p-4 text-rose-400">{error}</p>
          ) : cartData.items.length === 0 ? (
            <div className="grid place-items-center rounded-[1.5rem] border border-dashed border-white/10 bg-slate-950/20 px-6 py-12 text-center">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-300">
                <FiCreditCard className="text-2xl" />
              </div>
              <p className="mt-4 text-base font-semibold text-white">{t('Your cart is empty.')}</p>
              <p className="mt-1 text-sm text-slate-400">Add products to continue to secure payment.</p>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-4">
              <div className="min-h-0 flex-1 overflow-hidden rounded-[1.5rem] border border-white/10 bg-slate-950/30">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-white/10 text-left text-sm">
                    <thead className="bg-slate-950/60 text-slate-300">
                      <tr>
                        <th className="px-4 py-3 font-semibold">{t('Product')}</th>
                        <th className="px-4 py-3 font-semibold">{t('Farm')}</th>
                        <th className="px-4 py-3 font-semibold">{t('Qty')}</th>
                        <th className="px-4 py-3 font-semibold text-right">{t('Total')}</th>
                        <th className="px-4 py-3 font-semibold text-right">{t('Action')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 bg-transparent text-slate-200">
                      {cartData.items.map((item) => (
                        <tr key={item.cart_item_id} className="hover:bg-white/[0.03]">
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              {item.image_url ? (
                                <img
                                  src={item.image_url}
                                  alt=""
                                  className="h-12 w-12 rounded-2xl object-cover ring-1 ring-white/10"
                                />
                              ) : (
                                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/5 text-slate-400">
                                  <FiCreditCard />
                                </div>
                              )}
                              <div>
                                <div className="font-semibold text-white">{item.product_name}</div>
                                <div className="text-xs text-slate-400">{item.unit}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-slate-300">{item.farm_name}</td>
                          <td className="px-4 py-4 text-slate-300">{item.quantity}</td>
                          <td className="px-4 py-4 text-right font-semibold text-white">
                            Rs. {(item.quantity * item.cart_price).toFixed(2)}
                          </td>
                          <td className="px-4 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemove(item.cart_item_id)}
                              disabled={removingId === item.cart_item_id}
                              className="inline-flex items-center gap-2 rounded-full border border-rose-400/20 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-60"
                            >
                              {removingId === item.cart_item_id ? 'Removing...' : 'Remove'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid gap-4 rounded-[1.5rem] border border-emerald-400/15 bg-emerald-500/10 p-4 sm:grid-cols-3">
                <InfoTile label="Cart Total" value={`Rs. ${cartData.totalAmount.toFixed(2)}`} />
                <InfoTile label="Advance Due" value={`Rs. ${advanceAmount.toFixed(2)}`} />
                <InfoTile label="Status" value="Ready to pay" />
              </div>

              <div className="sticky bottom-0 flex justify-end rounded-[1.25rem] border border-white/10 bg-slate-950/85 p-3 backdrop-blur-xl">
                <Button onClick={openPaymentFlow} disabled={cartData.items.length === 0} className="min-w-56 rounded-full bg-emerald-600 px-6 py-3 text-white shadow-[0_18px_40px_rgba(16,185,129,0.25)] hover:bg-emerald-500">
                  Proceed to Secure Payment
                </Button>
              </div>
            </div>
          )}
        </Card>

        <Card
          title={t('Banking Preview')}
          subtitle={t('A secure transfer card styled like a mobile banking app')}
          className="flex min-h-0 flex-col overflow-hidden border-white/10 bg-white/[0.08] backdrop-blur-2xl"
        >
          <div className="flex min-h-0 flex-1 flex-col rounded-[1.75rem] border border-white/10 bg-[linear-gradient(180deg,rgba(3,12,22,0.96),rgba(8,47,73,0.88)_55%,rgba(6,78,59,0.28))] p-5 text-white shadow-[0_20px_60px_rgba(2,6,23,0.3)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-emerald-200/80">Secure Receiver</p>
                <h3 className="mt-2 text-xl font-black tracking-tight">Farm Account</h3>
                <p className="mt-2 max-w-sm text-sm leading-6 text-slate-300">
                  Transfer to the verified farm account using your preferred mobile banking app.
                </p>
              </div>
              <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/10 text-emerald-200">
                <FiShield className="text-xl" />
              </div>
            </div>

            <div className="thin-scrollbar mt-5 min-h-0 flex-1 overflow-y-auto rounded-[1.5rem] border border-white/10 bg-white/[0.95] p-4 pr-2 text-slate-900 shadow-[0_18px_40px_rgba(2,6,23,0.22)]">
              <div className="flex items-center justify-between border-b border-slate-200/70 pb-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Transfer Snapshot</p>
                  <p className="mt-1 text-lg font-black text-slate-900">Banking style payment details</p>
                </div>
                <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  {selectedMethodInfo.name}
                </div>
              </div>
              <div className="mt-4 space-y-3">
                <PreviewRow label="Receiver Name" value={farmAccount.receiverName} />
                <PreviewRow label="Bank Name" value={farmAccount.bankName} />
                <PreviewRow label="Account No." value={`**** **** **** ${farmAccount.accountNumber.slice(-4)}`} />
                <PreviewRow label="Transfer Amount" value={`Rs. ${advanceAmount.toFixed(2)}`} highlight />
                <PreviewRow label="Reference ID" value={referenceId || 'AUTO-GENERATED'} />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-slate-50 px-3 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Branch</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{farmAccount.branch}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-3 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">IBAN</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{farmAccount.iban}</p>
                </div>
                <div className="rounded-2xl bg-emerald-50 px-3 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-600">Status</p>
                  <p className="mt-1 text-sm font-semibold text-emerald-800">Verified account</p>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <BadgePill icon={<FiLock />} text="Secure Payment" />
              <BadgePill icon={<FiShield />} text="SSL Encrypted" />
              <BadgePill icon={<FiSmartphone />} text="Mobile Banking Ready" />
            </div>
          </div>
        </Card>
      </div>

      <AnimatePresence>
        {paymentOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-slate-950/80 p-3 backdrop-blur-xl sm:p-6"
          >
            <motion.div
              initial={{ y: 24, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 16, opacity: 0, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 220, damping: 22 }}
              className="mx-auto flex h-[calc(100dvh-5rem)] w-full max-w-5xl flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(4,11,20,0.98),rgba(9,18,29,0.97)_55%,rgba(3,10,14,0.98))] text-white shadow-[0_32px_100px_rgba(2,6,23,0.65)] sm:h-[calc(100dvh-5.75rem)]"
            >
              <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.02] px-4 py-3 sm:px-6">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-emerald-300/80">Mobile Banking Checkout</p>
                  <h2 className="mt-1 text-xl font-black tracking-tight sm:text-2xl">Complete Your Payment</h2>
                </div>
                <button
                  type="button"
                  onClick={closePaymentFlow}
                  disabled={processing}
                  className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/[0.08] text-slate-200 transition hover:bg-white/12 disabled:opacity-40"
                >
                  <FiX />
                </button>
              </div>

              <div className="border-b border-white/10 px-3 py-3 sm:px-6">
                <div className="grid gap-2 sm:grid-cols-4">
                  {stepItems.map((step, index) => {
                    const currentIndex = stepItems.findIndex((item) => item.key === paymentStep);
                    const isActive = step.key === paymentStep;
                    const isDone = currentIndex > index || paymentStep === 'success';
                    return (
                      <div
                        key={step.key}
                        className={`rounded-[1.25rem] border px-3 py-2.5 shadow-[0_10px_30px_rgba(2,6,23,0.12)] transition ${
                          isActive
                            ? 'border-emerald-400/35 bg-emerald-500/12'
                            : isDone
                              ? 'border-emerald-400/20 bg-emerald-500/8'
                              : 'border-white/10 bg-white/[0.03]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`grid h-7 w-7 place-items-center rounded-full text-[11px] font-black ring-1 ring-inset ${isActive || isDone ? 'bg-emerald-400 text-slate-950 ring-emerald-200/60' : 'bg-white/8 text-slate-300 ring-white/10'}`}>
                            {index + 1}
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Step {index + 1}</p>
                            <p className="text-sm font-semibold leading-tight text-white">{step.label}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="relative flex-1 min-h-0 overflow-hidden">
                <div className="thin-scrollbar h-full min-h-0 overflow-y-auto p-3 pb-20 sm:p-5 sm:pb-20">
                  <AnimatePresence mode="wait">
                    {paymentStep === 'summary' && (
                    <motion.div
                      key="summary"
                      initial={{ opacity: 0, x: 24 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -24 }}
                      className="grid min-h-0 gap-4 lg:grid-cols-[1.15fr_0.85fr]"
                    >
                      <section className="flex min-h-0 flex-col rounded-[1.6rem] border border-white/10 bg-white/[0.055] p-4 shadow-[0_20px_50px_rgba(2,6,23,0.25)] sm:p-5">
                        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-300/80">Order Summary</p>
                        <h3 className="mt-2 text-xl font-black sm:text-2xl">Review before payment</h3>
                        <div className="thin-scrollbar mt-4 min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-1">
                          {cartData.items.map((item) => (
                            <div key={item.cart_item_id} className="flex items-center justify-between rounded-2xl border border-white/8 bg-slate-950/28 px-4 py-2.5">
                              <div>
                                <p className="text-sm font-semibold text-white">{item.product_name}</p>
                                <p className="text-xs text-slate-400">{item.quantity} x Rs. {Number(item.cart_price).toFixed(2)}</p>
                              </div>
                              <p className="text-sm font-bold text-white">Rs. {(item.quantity * item.cart_price).toFixed(2)}</p>
                            </div>
                          ))}
                        </div>
                        <div className="mt-4 grid gap-2.5 rounded-[1.25rem] border border-emerald-400/15 bg-[linear-gradient(180deg,rgba(16,185,129,0.12),rgba(16,185,129,0.06))] p-3 sm:grid-cols-3">
                          <InfoTile label="Total" value={`Rs. ${cartData.totalAmount.toFixed(2)}`} compact />
                          <InfoTile label="Advance" value={`Rs. ${advanceAmount.toFixed(2)}`} compact />
                          <InfoTile label="Payment date" value={todayLabel} compact />
                        </div>
                      </section>

                      <section className="flex min-h-0 flex-col rounded-[1.6rem] border border-white/10 bg-[linear-gradient(160deg,rgba(6,17,28,0.95),rgba(8,47,73,0.84)_55%,rgba(16,185,129,0.16))] p-4 shadow-[0_20px_50px_rgba(2,6,23,0.28)] sm:p-5">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-200/75">Secure Payment</p>
                            <h3 className="mt-2 text-xl font-black sm:text-2xl">SSL Encrypted</h3>
                          </div>
                          <div className="rounded-2xl bg-white/10 p-3 text-emerald-200">
                            <FiLock className="text-2xl" />
                          </div>
                        </div>
                        <div className="thin-scrollbar mt-4 min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-1">
                          <BankChip method={selectedMethodInfo} />
                          <PreviewRow label="Receiver Name" value={farmAccount.receiverName} />
                          <PreviewRow label="Bank Name" value={farmAccount.bankName} />
                          <PreviewRow label="Account Number" value={`**** **** **** ${farmAccount.accountNumber.slice(-4)}`} />
                          <PreviewRow label="Transfer Amount" value={`Rs. ${advanceAmount.toFixed(2)}`} highlight />
                          <PreviewRow label="Reference ID" value={referenceId} />
                        </div>
                        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-emerald-400/15 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-100">
                          <FiShield className="text-emerald-300" />
                          Verify the receiver details before continuing to your banking app.
                        </div>
                        <div className="mt-auto flex w-full items-stretch gap-3 border-t border-white/10 bg-[linear-gradient(180deg,rgba(6,17,28,0),rgba(6,17,28,0.96)_35%)] pt-4">
                          <Button theme="light" variant="ghost" onClick={closePaymentFlow} className="h-12 flex-1 rounded-full bg-white/[0.08] text-white hover:bg-white/[0.12]">
                            Cancel
                          </Button>
                          <Button
                            theme="light"
                            onClick={handleContinueToMethod}
                            className="h-12 flex-1 rounded-full bg-emerald-500 px-5 py-3 text-white shadow-[0_18px_35px_rgba(16,185,129,0.25)] hover:bg-emerald-400"
                          >
                            Continue <FiChevronRight className="ml-2" />
                          </Button>
                        </div>
                      </section>
                    </motion.div>
                    )}

                    {paymentStep === 'method' && (
                    <motion.div
                      key="method"
                      initial={{ opacity: 0, x: 24 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -24 }}
                      className="grid min-h-0 gap-4 lg:grid-cols-[0.9fr_1.1fr]"
                    >
                      <section className="flex min-h-0 flex-col rounded-[1.6rem] border border-white/10 bg-white/[0.06] p-4 shadow-[0_20px_50px_rgba(2,6,23,0.18)] sm:p-5">
                        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-300/80">Payment Method</p>
                        <h3 className="mt-2 text-xl font-black sm:text-2xl">Choose your bank app</h3>
                        <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-slate-950/35 p-4">
                          <label className="block">
                            <span className="mb-2 block text-xs font-semibold text-slate-300">Banking app</span>
                            <select
                              value={selectedMethod}
                              onChange={(event) => setSelectedMethod(event.target.value as PaymentMethodId)}
                              className="farm-input !h-12 !rounded-2xl !bg-white/[0.08] !py-0 !text-white"
                            >
                              {paymentMethods.map((method) => (
                                <option key={method.id} value={method.id}>
                                  {method.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <div className="mt-4 rounded-[1.25rem] border border-white/10 bg-white/[0.05] p-3.5">
                            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">Selected method</p>
                            <div className="mt-3">
                              <BankChip method={selectedMethodInfo} />
                            </div>
                            <p className="mt-3 text-xs leading-5 text-slate-400">
                              Use your selected mobile banking app to send the payment to the farm account shown on the right.
                            </p>
                          </div>
                        </div>
                      </section>

                      <section className="flex min-h-0 flex-col rounded-[1.6rem] border border-white/10 bg-[linear-gradient(160deg,rgba(6,17,28,0.95),rgba(8,47,73,0.82)_55%,rgba(16,185,129,0.16))] p-4 shadow-[0_20px_50px_rgba(2,6,23,0.22)] sm:p-5">
                        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-200/75">Bank Transfer Screen</p>
                        <h3 className="mt-2 text-xl font-black sm:text-2xl">Confirm transfer details</h3>

                        <div className="thin-scrollbar mt-4 min-h-0 flex-1 overflow-y-auto rounded-[1.5rem] border border-white/10 bg-white/[0.07] p-4 pr-2 shadow-[0_18px_40px_rgba(2,6,23,0.28)]">
                          <div className="flex items-center justify-between">
                            <BankChip method={selectedMethodInfo} />
                            <div className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/12 px-3 py-1 text-xs font-semibold text-emerald-200">
                              <FiLock /> Secure Payment
                            </div>
                          </div>

                          <div className="mt-4 space-y-2.5">
                            <PreviewRow label="Receiver Name" value={farmAccount.receiverName} />
                            <PreviewRow label="Bank Name" value={farmAccount.bankName} />
                            <PreviewRow label="Account Number" value={`**** **** **** ${farmAccount.accountNumber.slice(-4)}`} />
                            <PreviewRow label="Transfer Amount" value={`Rs. ${advanceAmount.toFixed(2)}`} highlight />
                            <PreviewRow label="Reference ID" value={referenceId} />
                          </div>

                          <div className="mt-4 grid gap-2 rounded-[1.25rem] border border-white/10 bg-slate-950/35 p-3.5">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-slate-400">Payment status</span>
                              <span className="font-semibold text-emerald-300">Ready for verification</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-slate-400">Payment route</span>
                              <span className="font-semibold text-white">{selectedMethodInfo.name}</span>
                            </div>
                          </div>

                          <div className="mt-4 rounded-[1.25rem] border border-white/10 bg-slate-950/35 p-3.5">
                            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">Payer Details</p>
                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                              <label className="block">
                                <span className="mb-2 block text-xs font-semibold text-slate-300">Sender Name</span>
                                <input
                                  value={senderDetails.senderName}
                                  onChange={(event) => updateSenderDetail('senderName', event.target.value)}
                                  placeholder="Account holder name"
                                  className="farm-input !rounded-2xl !bg-white/[0.08] !py-2.5 !text-sm !placeholder:text-slate-500"
                                />
                              </label>
                              <label className="block">
                                <span className="mb-2 block text-xs font-semibold text-slate-300">Sender Bank</span>
                                <select
                                  value={senderDetails.senderBankName}
                                  onChange={(event) => updateSenderDetail('senderBankName', event.target.value)}
                                  className="farm-input !rounded-2xl !bg-white/[0.08] !py-2.5 !text-sm !placeholder:text-slate-500"
                                >
                                  <option value="" disabled>
                                    Select bank app
                                  </option>
                                  {sriLankaBankApps.map((bank) => (
                                    <option key={bank} value={bank}>
                                      {bank}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="block">
                                <span className="mb-2 block text-xs font-semibold text-slate-300">Sender Account No.</span>
                                <input
                                  value={senderDetails.senderAccountNumber}
                                  onChange={(event) => updateSenderDetail('senderAccountNumber', event.target.value)}
                                  placeholder="XXXX XXXX XXXX"
                                  className="farm-input !rounded-2xl !bg-white/[0.08] !py-2.5 !text-sm !placeholder:text-slate-500"
                                />
                              </label>
                              <label className="block">
                                <span className="mb-2 block text-xs font-semibold text-slate-300">Sender Mobile</span>
                                <input
                                  value={senderDetails.senderPhone}
                                  onChange={(event) => updateSenderDetail('senderPhone', event.target.value)}
                                  placeholder="+94 7X XXX XXXX"
                                  className="farm-input !rounded-2xl !bg-white/[0.08] !py-2.5 !text-sm !placeholder:text-slate-500"
                                />
                              </label>
                              <label className="block sm:col-span-2">
                                <span className="mb-2 block text-xs font-semibold text-slate-300">Reference Note</span>
                                <input
                                  value={senderDetails.senderNote}
                                  onChange={(event) => updateSenderDetail('senderNote', event.target.value)}
                                  placeholder="Optional note for the transaction"
                                  className="farm-input !rounded-2xl !bg-white/[0.08] !py-2.5 !text-sm !placeholder:text-slate-500"
                                />
                              </label>
                            </div>
                          </div>
                        </div>

                        <div className="mt-auto flex w-full items-stretch gap-3 border-t border-white/10 bg-[linear-gradient(180deg,rgba(6,17,28,0),rgba(6,17,28,0.96)_35%)] pt-4">
                          <Button theme="light" variant="ghost" onClick={() => setPaymentStep('summary')} className="h-12 flex-1 rounded-full bg-white/[0.08] text-white hover:bg-white/[0.12]">
                            Back
                          </Button>
                          <Button
                            theme="light"
                            onClick={handlePayClick}
                            className="h-12 flex-1 rounded-full bg-emerald-500 px-5 py-3 text-white shadow-[0_18px_35px_rgba(16,185,129,0.25)] hover:bg-emerald-400"
                          >
                            Pay Securely <FiChevronRight className="ml-2" />
                          </Button>
                        </div>
                      </section>
                    </motion.div>
                    )}

                    {paymentStep === 'verify' && (
                    <motion.div
                      key="verify"
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      className="mx-auto flex max-w-xl flex-col rounded-[1.75rem] border border-white/10 bg-[linear-gradient(180deg,rgba(4,11,20,0.98),rgba(8,15,29,0.98))] p-5 shadow-[0_24px_60px_rgba(2,6,23,0.35)]"
                    >
                      <div className="flex items-start gap-4">
                        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-300">
                          <FiLock className="text-2xl" />
                        </div>
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-300/80">Payment Verification</p>
                          <h3 className="mt-1 text-2xl font-black">Enter OTP / Transaction PIN</h3>
                          <p className="mt-2 text-sm leading-6 text-slate-300">
                            Verify this transaction securely in your banking app.
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 rounded-[1.25rem] border border-white/10 bg-white/[0.05] p-3.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-400">Reference ID</span>
                          <span className="font-semibold text-white">{referenceId}</span>
                        </div>
                        <div className="mt-3 flex items-center justify-between text-sm">
                          <span className="text-slate-400">Amount</span>
                          <span className="font-semibold text-emerald-300">Rs. {advanceAmount.toFixed(2)}</span>
                        </div>
                      </div>

                      <div className="mt-4 rounded-[1.25rem] border border-white/10 bg-white/[0.05] p-3.5">
                        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">Sender Summary</p>
                        <div className="mt-3 grid gap-2 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-400">Sender Name</span>
                            <span className="font-semibold text-white">{senderDetails.senderName || 'Not entered'}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-400">Sender Bank</span>
                            <span className="font-semibold text-white">{senderDetails.senderBankName || 'Not entered'}</span>
                          </div>
                        </div>
                      </div>

                      <label className="mt-4 block">
                        <span className="mb-2 block text-sm font-semibold text-slate-300">OTP / Transaction PIN</span>
                        <input
                          type="password"
                          inputMode="numeric"
                          value={transactionPin}
                          onChange={(event) => setTransactionPin(event.target.value)}
                          placeholder="Enter 4-6 digit PIN"
                          className="farm-input rounded-2xl !bg-white/[0.08] !text-white !placeholder:text-slate-500"
                        />
                      </label>

                      <div className="mt-4 rounded-[1.25rem] border border-emerald-400/15 bg-emerald-500/10 p-3.5 text-sm text-emerald-100">
                        <div className="flex items-center gap-2">
                          <FiShield className="text-emerald-300" />
                          <span>SSL Encrypted</span>
                        </div>
                        <p className="mt-2 text-emerald-100/80">Your payment is being processed through a secure banking channel.</p>
                      </div>

                      <div className="mt-auto flex w-full items-stretch gap-3 border-t border-white/10 bg-[linear-gradient(180deg,rgba(4,11,20,0),rgba(4,11,20,0.96)_35%)] pt-4">
                        <Button theme="light" variant="ghost" onClick={() => setPaymentStep('method')} className="h-12 flex-1 rounded-full bg-white/[0.08] text-white hover:bg-white/[0.12]">
                          Back
                        </Button>
                        <Button
                          theme="light"
                          onClick={handleVerifyAndPay}
                          className="h-12 flex-1 rounded-full bg-emerald-500 px-5 py-3 text-white shadow-[0_18px_35px_rgba(16,185,129,0.25)] hover:bg-emerald-400"
                        >
                          Verify & Pay
                        </Button>
                      </div>
                    </motion.div>
                    )}

                    {paymentStep === 'processing' && (
                    <motion.div
                      key="processing"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="grid min-h-[280px] place-items-center rounded-[1.75rem] border border-white/10 bg-[linear-gradient(180deg,rgba(4,11,20,0.95),rgba(7,15,24,0.96))] p-6"
                    >
                      <div className="text-center">
                        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full border border-emerald-400/20 bg-emerald-500/12 text-emerald-300">
                          <FiLoader className="animate-spin text-3xl" />
                        </div>
                        <h3 className="mt-5 text-2xl font-black">Verifying Payment...</h3>
                        <p className="mt-2 text-sm text-slate-400">Please keep this screen open while your banking app completes the transfer.</p>
                      </div>
                    </motion.div>
                    )}

                    {isSuccess && (
                    <motion.div
                      key="success"
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="mx-auto flex max-w-2xl flex-col rounded-[1.75rem] border border-emerald-400/15 bg-[linear-gradient(180deg,rgba(4,30,18,0.98),rgba(6,17,24,0.98))] p-5 shadow-[0_26px_80px_rgba(2,6,23,0.45)]"
                    >
                      <div className="grid place-items-center text-center">
                        <div className="grid h-20 w-20 place-items-center rounded-full bg-emerald-500/15 text-emerald-300">
                          <FiCheckCircle className="text-4xl" />
                        </div>
                        <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.28em] text-emerald-300/80">Payment Success</p>
                        <h3 className="mt-2 text-3xl font-black">Transaction Completed</h3>
                        <p className="mt-2 text-sm text-slate-300">Your advance payment was processed successfully.</p>
                      </div>

                      <div className="thin-scrollbar mt-4 grid max-h-[35vh] gap-2.5 overflow-y-auto rounded-[1.35rem] border border-white/10 bg-white/[0.05] p-4 pr-2 sm:grid-cols-2">
                        <PreviewRow label="Transaction ID" value={receipt?.transactionId || ''} />
                        <PreviewRow label="Amount Paid" value={`Rs. ${(receipt?.amountPaid || 0).toFixed(2)}`} highlight />
                        <PreviewRow label="Payment Date" value={receipt?.paymentDate || ''} />
                        <PreviewRow label="Reference ID" value={receipt?.referenceId || ''} />
                      </div>

                      <div className="mt-auto flex w-full flex-col items-stretch gap-3 border-t border-emerald-400/15 bg-[linear-gradient(180deg,rgba(4,30,18,0),rgba(4,30,18,0.96)_35%)] pt-4 sm:flex-row">
                        <Button theme="light" variant="ghost" onClick={handleDownloadReceipt} className="h-12 flex-1 rounded-full bg-white/[0.08] text-white hover:bg-white/[0.12]">
                          <FiDownload className="mr-2" /> Download Receipt
                        </Button>
                        <Button theme="light" onClick={closePaymentFlow} className="h-12 flex-1 rounded-full bg-emerald-500 px-5 py-3 text-white shadow-[0_18px_35px_rgba(16,185,129,0.25)] hover:bg-emerald-400">
                          Done
                        </Button>
                      </div>
                    </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function generateReferenceId() {
  return `REF-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function generateTransactionId() {
  return `TXN-${crypto.randomUUID().slice(0, 10).toUpperCase()}`;
}

function PreviewRow({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3">
      <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">{label}</span>
      <span className={`text-right text-sm font-semibold ${highlight ? 'text-emerald-300' : 'text-white'}`}>{value}</span>
    </div>
  );
}

function InfoTile({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className={compact ? '' : 'rounded-2xl bg-white/[0.04] p-3'}>
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className={`mt-1 font-black ${compact ? 'text-base text-white' : 'text-lg text-white'}`}>{value}</p>
    </div>
  );
}

function BadgePill({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-slate-200">
      <span className="text-emerald-300">{icon}</span>
      {text}
    </div>
  );
}

function BankChip({ method }: { method: PaymentMethod }) {
  return (
    <div className={`inline-flex items-center gap-3 rounded-2xl bg-gradient-to-r ${method.accent} px-4 py-3 text-white shadow-[0_16px_35px_rgba(2,6,23,0.25)]`}>
      <div className={`grid h-11 w-11 place-items-center rounded-2xl ${method.logoBg}`}>
        <span className="text-[11px] font-black leading-4">{method.initials}</span>
      </div>
      <div>
        <p className="text-sm font-black">{method.name}</p>
        <p className="text-[11px] text-white/80">{method.subtitle}</p>
      </div>
    </div>
  );
}
