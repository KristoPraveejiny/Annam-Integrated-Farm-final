import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Card } from '../../components/ui/Card';
import { SectionHeading } from '../../components/ui/SectionHeading';
import { useTranslation } from 'react-i18next';
import { getMarketplaceProducts, getOrderHistory, viewCart } from '../../api/marketplace';
import { resolveMediaUrl } from '../../utils/mediaUrl';

export default function CustomerDashboard() {
  const { t } = useTranslation();
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [cartItemsCount, setCartItemsCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [prods, ords, cartData] = await Promise.all([
          getMarketplaceProducts(),
          getOrderHistory(),
          viewCart().catch(() => ({ items: [] }))
        ]);
        setProducts(prods || []);
        setOrders(ords || []);
        setCartItemsCount(cartData?.items?.length || 0);
      } catch (error) {
        console.error("Failed to load customer dashboard data", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const activeOrders = orders.filter(o => o.status !== 'Delivered' && o.status !== 'Received' && o.status !== 'Cancelled');


  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow={t("Dashboard")}
        title={t("Customer Dashboard")}
        description={t("Browse products, checkout, orders, QR verification, and reviews.")}
        tone="light"
      />
      
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <StatTile label={t("Total Orders")} value={orders.length.toString()} delta="" />
        <StatTile label={t("Active Orders")} value={activeOrders.length.toString()} delta="" />
        <StatTile label={t("Products Available")} value={products.length.toString()} delta="" />
        <StatTile label={t("Cart Items")} value={cartItemsCount.toString()} delta="" />
      </div>

      <div className="grid gap-5">
        <Card title={t("Product Browsing")} subtitle={t("Premium ecommerce-style product discovery")}>
          {loading ? (
             <p className="text-gray-500">{t("Loading...")}</p>
          ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {products.slice(0, 4).map((product) => (
              <div key={product.id || product.name} className="rounded-3xl border border-slate-100 p-4">
                <div className="h-36 rounded-2xl bg-gray-100 overflow-hidden relative">
                  {product.image_url ? (
                    <img src={resolveMediaUrl(product.image_url)} alt={product.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gradient-to-br from-emerald-100 via-lime-50 to-white">No Image</div>
                  )}
                </div>
                <p className="mt-3 font-semibold text-slate-900">{product.name}</p>
                <p className="text-sm text-slate-500">{product.category}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-emerald-700">Rs. {product.price}</span>
                  <span className="text-sm font-medium text-slate-500">{product.available_quantity} {product.unit} {t("available")}</span>
                </div>
              </div>
            ))}
          </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function StatTile({ label, value, delta }: { label: string; value: string; delta: string }) {
  return (
    <Card>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-black text-slate-900">{value}</p>
      {delta && <p className="mt-2 text-sm font-semibold text-emerald-600">{delta}</p>}
    </Card>
  );
}
