import { useState, useEffect } from 'react';
import { getOrderHistory, getManagerOrders } from '../../api/marketplace';
import { Card } from '../../components/ui/Card';
import { SectionHeading } from '../../components/ui/SectionHeading';
import { FiBox, FiDollarSign } from 'react-icons/fi';

export default function OrdersPage({ role }: { role: 'customer' | 'farm-manager' }) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading orders...</div>;
  }

  return (
    <div className="space-y-6">
      <SectionHeading 
        eyebrow="Marketplace Orders" 
        title={role === 'customer' ? 'Your Orders & Payments' : 'Customer Orders Overview'} 
        description={role === 'customer' ? 'Track your purchases and view advance payments.' : 'View all customer marketplace orders and their payment status.'}
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
        <div className="grid gap-6">
          {orders.map((order) => {
            const payments = order.payments ? (typeof order.payments === 'string' ? JSON.parse(order.payments) : order.payments) : [];
            const advancePayment = payments.find((p: any) => p.status === 'paid' && p.provider === 'SystemPreorder');

            return (
              <Card key={order.id} className="overflow-hidden p-0 border border-slate-200">
                <div className="bg-slate-50 border-b border-slate-200 p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-500 tracking-wider mb-1">Order #{order.id.slice(0, 8)}</p>
                    <p className="text-sm font-medium text-slate-900">{new Date(order.created_at).toLocaleString()}</p>
                    {role === 'farm-manager' && order.customer_name && (
                      <p className="text-sm text-emerald-700 mt-1 font-semibold">Customer: {order.customer_name}</p>
                    )}
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-xs font-semibold uppercase text-slate-500 tracking-wider mb-1">Total Amount</p>
                    <p className="text-lg font-bold text-slate-900">Rs. {Number(order.total_amount).toFixed(2)}</p>
                  </div>
                  <div className="flex flex-col items-start sm:items-end gap-2">
                    <span className="inline-flex px-3 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                      Status: {order.status}
                    </span>
                  </div>
                </div>

                <div className="p-4 grid md:grid-cols-2 gap-6">
                  {/* Order Items */}
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                      <FiBox className="text-emerald-600" /> Order Items
                    </h4>
                    {/* In a real app we'd fetch order items, but for now we just show a summary */}
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                      <p className="text-sm text-slate-600 mb-2">Items detail is tracked in the system.</p>
                      <p className="text-xs text-slate-500">Order ID: {order.id}</p>
                    </div>
                  </div>

                  {/* Payment Info */}
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                      <FiDollarSign className="text-emerald-600" /> Payment Information
                    </h4>
                    {advancePayment ? (
                      <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-semibold text-emerald-800">25% Advance Paid:</span>
                          <span className="text-sm font-bold text-emerald-900">Rs. {Number(advancePayment.amount).toFixed(2)}</span>
                        </div>
                        <p className="text-xs text-emerald-600">Paid at: {new Date(advancePayment.paid_at).toLocaleString()}</p>
                        
                        <div className="mt-4 pt-3 border-t border-emerald-200 flex justify-between items-center">
                          <span className="text-sm font-semibold text-slate-700">Remaining Balance (Pay on pickup):</span>
                          <span className="text-sm font-bold text-slate-900">
                            Rs. {(Number(order.total_amount) - Number(advancePayment.amount)).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
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
