import React, { useEffect, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { viewCart, placeOrder, removeFromCart } from '../../api/marketplace';

export default function CartPage() {
  const [cartData, setCartData] = useState<{ items: any[], totalAmount: number }>({ items: [], totalAmount: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ordering, setOrdering] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

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
      const advanceAmount = cartData.totalAmount * 0.25;
      await placeOrder({ advanceAmount });
      alert('Order placed and 25% advance payment successful! Check your email.');
      setShowConfirmModal(false);
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
      <h1 className="text-2xl font-bold text-gray-900">Your Cart</h1>

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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Farm</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
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
              <div className="text-lg text-gray-600 mb-2">Total Amount:</div>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-lg bg-white p-6 rounded-2xl shadow-xl">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Confirm Your Order</h2>
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
                <span>Total Amount:</span>
                <span className="text-lg text-gray-900">Rs. {cartData.totalAmount.toFixed(2)}</span>
              </div>
              
              <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex justify-between items-center text-emerald-800 font-bold">
                <span>25% Preorder Advance Required:</span>
                <span className="text-xl">Rs. {(cartData.totalAmount * 0.25).toFixed(2)}</span>
              </div>
              
              <p className="text-xs text-gray-500 text-center">
                Because you will buy the product physically after that, this order will appear in the orders section. A 25% payment is required now to confirm the preorder.
              </p>
            </div>
            
            <div className="mt-6 flex justify-end gap-3">
              <Button theme="light" onClick={() => setShowConfirmModal(false)} disabled={ordering}>
                Cancel
              </Button>
              <Button theme="dark" onClick={handlePlaceOrder} disabled={ordering} className="bg-emerald-600 text-white">
                {ordering ? 'Processing...' : 'Confirm & Pay 25% Advance'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
