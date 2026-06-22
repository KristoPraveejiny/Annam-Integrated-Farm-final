import { useState, useEffect } from 'react';
import { getOrderHistory, getManagerOrders, markOrderReceived } from '../../api/marketplace';
import { Card } from '../../components/ui/Card';
import { SectionHeading } from '../../components/ui/SectionHeading';
import { FiBox, FiDollarSign, FiCheckCircle } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';

export default function OrdersPage({ role }: { role: 'customer' | 'farm-manager' }) {
  const { t } = useTranslation();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    fetchOrders();
  }, [role]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const data = role === 'customer' ? await getOrderHistory() : await getManagerOrders();
      setOrders(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkReceived = async (id: string) => {
    try {
      setUpdatingId(id);
      await markOrderReceived(id);
      await fetchOrders();
    } catch (err) {
      console.error(err);
      alert('Failed to update order status.');
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading orders...</div>;
  }

  return (
    <div className="space-y-6">
      <SectionHeading 
        eyebrow={t("Marketplace Orders")} 
        title={role === 'customer' ? t('Your Orders & Payments') : 'Customer Orders Overview'} 
        description={role === 'customer' ? t('Track your purchases and view advance payments.') : 'View all customer marketplace orders and their payment status.'}
        tone="light" 
      />

      {orders.length === 0 ? (
        <Card>
          <div className="text-center py-10">
            <FiBox className="mx-auto text-4xl text-emerald-200 mb-3" />
            <p className="text-slate-500 font-medium">No orders found.</p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4">
          {orders.map((order) => {
            const payments = order.payments ? (typeof order.payments === 'string' ? JSON.parse(order.payments) : order.payments) : [];
            const advancePayment = payments.find((p: any) => p.status === 'paid' && p.provider === 'SystemPreorder');

            return (
              <Card key={order.id} className="overflow-hidden !aspect-auto p-0 border border-slate-200">
                <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase text-slate-500 tracking-[0.18em] mb-1">Order #{order.id.slice(0, 8)}</p>
                    <p className="text-sm font-medium text-slate-900">{new Date(order.created_at).toLocaleDateString()} at {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    {role === 'farm-manager' && order.customer_name && (
                      <p className="text-sm text-emerald-700 mt-1 font-semibold">Customer: {order.customer_name}</p>
                    )}
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-[11px] font-semibold uppercase text-slate-500 tracking-[0.18em] mb-1">Total Amount</p>
                    <p className="text-base font-bold text-slate-900">Rs. {Number(order.total_amount).toFixed(2)}</p>
                  </div>
                  <div className="flex flex-col items-start sm:items-end gap-2">
                    <span className="inline-flex px-3 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                      Status: {order.status}
                    </span>
                  </div>
                </div>

                <div className="grid gap-4 p-4 md:grid-cols-2">
                  {/* Order Items */}
                  <div>
                    <h4 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-900">
                      <FiBox className="text-emerald-600" /> Order Items
                    </h4>
                    {/* In a real app we'd fetch order items, but for now we just show a summary */}
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                      <p className="text-sm text-slate-600">Items detail is tracked in the system.</p>
                      <p className="text-xs text-slate-500">Order ID: {order.id}</p>
                    </div>
                  </div>

                  {/* Payment Info */}
                  <div>
                    <h4 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-900">
                      <FiDollarSign className="text-emerald-600" /> Payment Information
                    </h4>
                    {advancePayment ? (
                      <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-sm font-semibold text-emerald-800">25% Advance Paid:</span>
                          <span className="text-sm font-bold text-emerald-900">Rs. {Number(advancePayment.amount).toFixed(2)}</span>
                        </div>
                        <p className="text-xs text-emerald-600">Paid at: {new Date(advancePayment.paid_at).toLocaleString()}</p>
                        
                        <div className="mt-3 flex items-center justify-between border-t border-emerald-200 pt-3">
                          <span className="text-sm font-semibold text-slate-700">Remaining balance:</span>
                          <span className="text-sm font-bold text-slate-900">
                            Rs. {(Number(order.total_amount) - Number(advancePayment.amount)).toFixed(2)}
                          </span>
                        </div>
                        {role === 'farm-manager' && (
                          <div className="mt-3 flex justify-end">
                            <button
                              onClick={() => handleMarkReceived(order.id)}
                              disabled={updatingId === order.id}
                              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <FiCheckCircle />
                              {updatingId === order.id ? 'Updating...' : 'Mark Received'}
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-amber-100 bg-amber-50 p-3">
                        <p className="text-sm text-amber-800 font-medium">No advance payment recorded.</p>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
