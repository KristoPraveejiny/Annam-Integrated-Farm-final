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
      <div className="flex space-x-4 border-b border-white/10 pb-2">
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

      <Card variant="dark" className="h-auto border-white/10 bg-white/[0.08] backdrop-blur-2xl">
        {loading ? (
          <p className="p-4 text-slate-300">{t("Loading...")}</p>
        ) : error ? (
          <p className="p-4 text-rose-400">{error}</p>
        ) : activeTab === 'products' ? (
          products.length === 0 ? (
            <p className="p-4 text-slate-300">{t("No products found in the marketplace.")}</p>
          ) : (
            <div className="overflow-x-auto rounded-lg">
              <table className="min-w-full divide-y divide-white/10">
                <thead className="bg-slate-950/80">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">{t("Product")}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">{t("Category")}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">{t("Price")}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">{t("Stock")}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">{t("Status")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 bg-slate-950/30">
                  {products.map((product) => (
                    <tr key={product.id} className="hover:bg-white/5">
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
                            <div className="text-sm font-medium text-white">{product.name}</div>
                            {product.farm_name && (
                              <div className="text-xs text-slate-300">Farm: {product.farm_name}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                        {product.category || 'Uncategorized'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-emerald-300">
                        Rs {Number(product.price).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                        {product.available_quantity} units
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          product.status === 'approved' ? 'bg-emerald-500/15 text-emerald-300' : 
                          product.status === 'pending' ? 'bg-amber-500/15 text-amber-300' :
                          'bg-rose-500/15 text-rose-300'
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
            <p className="p-4 text-slate-300">{t("No orders found.")}</p>
          ) : (
            <div className="overflow-x-auto rounded-lg">
              <table className="min-w-full divide-y divide-white/10">
                <thead className="bg-slate-950/80">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">{t("Order #")}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">{t("Customer")}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">{t("Items")}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">{t("Total")}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">{t("Status")}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">{t("Date")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 bg-slate-950/30">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-white/5">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                        {order.order_number}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                        {order.customer_name || 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-300">
                        <ul className="list-disc pl-4">
                          {order.items?.map((item: any, idx: number) => (
                            <li key={idx} className="whitespace-nowrap">
                              {item.quantity}x {item.product_name}
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-emerald-300">
                        Rs {Number(order.total_amount).toFixed(2)}
                        <div className="text-xs text-slate-400 font-normal">
                          {order.payment_status}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          order.status === 'completed' ? 'bg-emerald-500/15 text-emerald-300' : 
                          order.status === 'pending' ? 'bg-amber-500/15 text-amber-300' :
                          'bg-sky-500/15 text-sky-300'
                        }`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
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
