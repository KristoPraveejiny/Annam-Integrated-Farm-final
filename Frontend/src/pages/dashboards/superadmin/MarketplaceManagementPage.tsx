import { useEffect, useState } from 'react';
import { Card } from '../../../components/ui/Card';
import { useTranslation } from 'react-i18next';
import { getMarketplaceProducts, getAdminOrders } from '../../../api/marketplace';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number | string;
  available_quantity: number;
  category: string;
  status: string;
  image_url?: string;
  farm_name?: string;
}

interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  total_amount: number | string;
  status: string;
  payment_status: string;
  created_at: string;
  items: any[];
}

export default function MarketplaceManagementPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'products' | 'orders'>('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (activeTab === 'products') {
      fetchProducts();
    } else {
      fetchOrders();
    }
  }, [activeTab]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const data = await getMarketplaceProducts();
      setProducts(data);
    } catch (err) {
      setError('Failed to load marketplace products.');
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const data = await getAdminOrders();
      setOrders(data);
    } catch (err) {
      setError('Failed to load orders.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">{t("Marketplace Management")}</h1>
      </div>

      {/* Tabs */}
      <div className="flex space-x-4 border-b border-white/20 pb-2">
        <button
          onClick={() => setActiveTab('products')}
          className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'products'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-white/70 hover:text-white hover:border-white/30'
          }`}
        >
          {t("Products")}
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'orders'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-white/70 hover:text-white hover:border-white/30'
          }`}
        >
          {t("Orders")}
        </button>
      </div>

      <Card className="h-auto">
        {loading ? (
          <p className="text-white p-4">{t("Loading...")}</p>
        ) : error ? (
          <p className="text-red-500 p-4">{error}</p>
        ) : activeTab === 'products' ? (
          products.length === 0 ? (
            <p className="text-white/80 p-4">{t("No products found in the marketplace.")}</p>
          ) : (
            <div className="overflow-x-auto rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t("Product")}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t("Category")}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t("Price")}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t("Stock")}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t("Status")}</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {products.map((product) => (
                    <tr key={product.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 flex-shrink-0 bg-gray-100 rounded-md overflow-hidden">
                            {product.image_url ? (
                              <img className="h-10 w-10 object-cover" src={product.image_url} alt="" />
                            ) : (
                              <div className="h-10 w-10 flex items-center justify-center text-gray-400 text-xs">No img</div>
                            )}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{product.name}</div>
                            {product.farm_name && (
                              <div className="text-xs text-gray-500">Farm: {product.farm_name}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {product.category || 'Uncategorized'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-emerald-600">
                        Rs {Number(product.price).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {product.available_quantity} units
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          product.status === 'approved' ? 'bg-green-100 text-green-800' : 
                          product.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {product.status || 'Active'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          orders.length === 0 ? (
            <p className="text-white/80 p-4">{t("No orders found.")}</p>
          ) : (
            <div className="overflow-x-auto rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t("Order #")}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t("Customer")}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t("Items")}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t("Total")}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t("Status")}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t("Date")}</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {order.order_number}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {order.customer_name || 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        <ul className="list-disc pl-4">
                          {order.items?.map((item: any, idx: number) => (
                            <li key={idx} className="whitespace-nowrap">
                              {item.quantity}x {item.product_name}
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-emerald-600">
                        Rs {Number(order.total_amount).toFixed(2)}
                        <div className="text-xs text-gray-400 font-normal">
                          {order.payment_status}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          order.status === 'completed' ? 'bg-green-100 text-green-800' : 
                          order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(order.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </Card>
    </div>
  );
}
