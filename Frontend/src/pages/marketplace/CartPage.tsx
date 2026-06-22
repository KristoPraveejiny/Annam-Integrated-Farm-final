import React, { useEffect, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { viewCart, placeOrder, removeFromCart } from '../../api/marketplace';
import { FiLock, FiShield, FiCheckCircle } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';

export default function CartPage() {
  const { t } = useTranslation();
  const [cartData, setCartData] = useState<{ items: any[], totalAmount: number }>({ items: [], totalAmount: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ordering, setOrdering] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [payerName, setPayerName] = useState('');
  const [referenceNote, setReferenceNote] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);

  const farmAccount = {
    bankName: 'Commercial Bank of Ceylon',
    accountName: 'Annam Integrated Farm (Pvt) Ltd',
    accountNumber: '1234 5678 9012',
    branch: 'Kilinochchi Branch',
    iban: 'LKXX CMCB 0123 4567 8901 2345',
  };

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

  const handlePlaceOrder = async () => {
    try {
      setOrdering(true);
      if (!payerName.trim() || !referenceNote.trim() || !acknowledged) {
        alert('Please complete the payment form and confirm the bank details before proceeding.');
        return;
      }
      const advanceAmount = cartData.totalAmount * 0.25;
      await placeOrder({ advanceAmount });
      alert('Order placed and 25% advance payment successful! Check your email.');
      setShowConfirmModal(false);
      setPayerName('');
      setReferenceNote('');
      setAcknowledged(false);
      fetchCart(); // Reload cart (will be empty)
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to place order.');
    } finally {
      setOrdering(false);
    }
  };

  const handleRemove = async (cartItemId: string) => {
    try {
      await removeFromCart(cartItemId);
      fetchCart();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to remove item.');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">{t("Your Cart")}</h1>

      <Card>
        {loading ? (
          <p className="p-4 text-gray-500">Loading cart...</p>
        ) : error ? (
          <p className="p-4 text-red-500">{error}</p>
        ) : cartData.items.length === 0 ? (
          <p className="p-4 text-gray-500">Your cart is empty.</p>
        ) : (
          <div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('Product')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('Farm')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('Price')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('Quantity')}</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('Total')}</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('Action')}</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {cartData.items.map((item) => (
                    <tr key={item.cart_item_id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {item.image_url && <img src={item.image_url} alt="" className="w-10 h-10 rounded-md mr-3 object-cover" />}
                          <div className="text-sm font-medium text-gray-900">{item.product_name}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.farm_name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Rs. {item.cart_price}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.quantity} {item.unit}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-semibold">
                        Rs. {(item.quantity * item.cart_price).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                        <button onClick={() => handleRemove(item.cart_item_id)} className="text-red-500 hover:text-red-700 font-semibold">Remove</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-6 bg-gray-50 border-t border-gray-200 flex flex-col items-end">
              <div className="text-lg text-gray-600 mb-2">{t("Total Amount")}:</div>
              <div className="text-3xl font-bold text-gray-900 mb-6">Rs. {cartData.totalAmount.toFixed(2)}</div>
              <Button onClick={() => setShowConfirmModal(true)} disabled={ordering} theme="light" className="w-full sm:w-auto px-8">
                Confirm Order
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/70 p-4 backdrop-blur-sm sm:items-center">
          <Card className="w-full max-w-2xl !aspect-auto bg-white p-6 rounded-3xl shadow-2xl" variant="light">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-600">Secure advance payment</p>
                <h2 className="mt-2 text-2xl font-black text-slate-950">Confirm your order and pay 25% advance</h2>
              </div>
              <div className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                <FiLock /> Protected
              </div>
            </div>
            <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_0.9fr]">
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-xl max-h-48 overflow-y-auto">
                  <h3 className="font-semibold text-gray-700 mb-2">Products Needed:</h3>
                  {cartData.items.map((item) => (
                    <div key={item.cart_item_id} className="flex justify-between text-sm py-1 border-b border-gray-100 last:border-0">
                      <span>{item.quantity}x {item.product_name}</span>
                      <span className="font-medium text-gray-900">Rs. {(item.quantity * item.cart_price).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center text-gray-700 font-semibold pt-2">
                  <span>{t("Total Amount")}:</span>
                  <span className="text-lg text-gray-900">Rs. {cartData.totalAmount.toFixed(2)}</span>
                </div>

                <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex justify-between items-center text-emerald-800 font-bold">
                  <span>25% Preorder Advance Required:</span>
                  <span className="text-xl">Rs. {(cartData.totalAmount * 0.25).toFixed(2)}</span>
                </div>

                <p className="text-xs text-gray-500 leading-6">
                  After payment, this preorder will appear in the orders section. Please transfer the advance to the farm account shown on the right and keep the reference note for verification.
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <FiShield className="text-emerald-600" /> Farm Account Details
                </div>
                <div className="mt-4 space-y-3 rounded-2xl bg-white p-4 shadow-sm">
                  <DetailRow label="Bank" value={farmAccount.bankName} />
                  <DetailRow label="Account Name" value={farmAccount.accountName} />
                  <DetailRow label="Account No." value={`**** **** **** ${farmAccount.accountNumber.slice(-4)}`} />
                  <DetailRow label="Branch" value={farmAccount.branch} />
                  <DetailRow label="IBAN / Ref" value={farmAccount.iban} />
                </div>

                <div className="mt-5 grid gap-3">
                  <input value={payerName} onChange={(e) => setPayerName(e.target.value)} placeholder="Payer name" className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
                  <input value={referenceNote} onChange={(e) => setReferenceNote(e.target.value)} placeholder="Payment reference / note" className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
                  <label className="flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-slate-700">
                    <input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                    <span>I confirm that I have reviewed the farm account details and will transfer the 25% advance securely.</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3 pb-2">
              <Button theme="light" onClick={() => setShowConfirmModal(false)} disabled={ordering}>
                Cancel
              </Button>
              <Button theme="dark" onClick={handlePlaceOrder} disabled={ordering || !acknowledged} className="bg-emerald-600 text-white">
                {ordering ? 'Processing...' : 'Confirm & Pay 25% Advance'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-2 last:border-0 last:pb-0">
      <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{label}</span>
      <span className="text-right text-sm font-semibold text-slate-900">{value}</span>
    </div>
  );
}
