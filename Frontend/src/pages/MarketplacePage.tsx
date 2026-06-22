import { useEffect, useState } from 'react';
import { FiGrid, FiSearch, FiShoppingCart } from 'react-icons/fi';
import { Card } from '../components/ui/Card';
import { SectionHeading } from '../components/ui/SectionHeading';
import { getMarketplaceProducts, addToCart } from '../api/marketplace';
import { useNavigate } from 'react-router-dom';

import { PublicHeader } from '../components/layout/PublicHeader';
import { useTranslation } from 'react-i18next';

export default function MarketplacePage() {
  const { t } = useTranslation();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [quantities, setQuantities] = useState<{[key: string]: number}>({});
  const navigate = useNavigate();

  const handleQuantityChange = (id: string, value: string) => {
    setQuantities(prev => ({...prev, [id]: Number(value) || 1}));
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const data = await getMarketplaceProducts();
      setProducts(data);
      if (data.length > 0) {
        setSelectedProduct(data[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const data = await getMarketplaceProducts({ search });
      setProducts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = async (product: any) => {
    try {
      const quantity = quantities[product.id] || 1;
      await addToCart({ product_id: product.id, quantity });
      alert(t('Product added to cart!'));
    } catch (err: any) {
      if (err.response?.status === 401) {
        alert(t('Please login to add to cart.'));
        navigate('/login');
      } else {
        alert(err.response?.data?.error || t('Failed to add to cart.'));
      }
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_22%),linear-gradient(180deg,#eff9f1_0%,#f6fbf7_100%)] text-slate-900">
      <PublicHeader active="marketplace" />
      <div className="section-shell py-12">
      <SectionHeading eyebrow={t("Marketplace")} title={t("Fresh produce marketplace")} description={t("Browse approved farm products, preview item details, and add fresh produce to your cart with a clean shopping experience.")} />

      <form onSubmit={handleSearch} className="mb-8 grid gap-4 rounded-3xl border border-emerald-100 bg-white/88 p-4 shadow-[0_14px_35px_rgba(2,6,23,0.06)] backdrop-blur lg:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <FiSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            className="h-12 w-full rounded-2xl border border-emerald-100 bg-white pl-11 pr-4 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100" 
            placeholder={t("Search vegetables, fruits, milk, eggs, organic items...")} 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button type="submit" className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-emerald-100 bg-white px-5 text-sm font-semibold text-slate-700 transition-colors hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"><FiSearch /> {t("Search")}</button>
        <button type="button" className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"><FiGrid /> {t("QR Section")}</button>
      </form>

      <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {loading ? (
            <div className="col-span-full rounded-3xl border border-emerald-100 bg-white/88 py-12 text-center text-sm font-medium text-slate-500 shadow-[0_14px_35px_rgba(2,6,23,0.06)]">{t("Loading products...")}</div>
          ) : products.length === 0 ? (
            <div className="col-span-full rounded-3xl border border-emerald-100 bg-white/88 py-12 text-center text-sm font-medium text-slate-500 shadow-[0_14px_35px_rgba(2,6,23,0.06)]">{t("No products found.")}</div>
          ) : (
            products.map((product) => (!showPreview || selectedProduct?.id === product.id) && (
            <article key={product.id} className="flex h-full flex-col overflow-hidden rounded-3xl border border-emerald-100 bg-white/90 p-5 shadow-[0_14px_35px_rgba(2,6,23,0.06)] transition hover:-translate-y-1 hover:border-emerald-200 hover:shadow-[0_20px_45px_rgba(16,185,129,0.14)]">
                <div className="mb-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">{t(product.category)}</p>
                  <h3 className="mt-2 line-clamp-2 text-xl font-black tracking-tight text-slate-950">{product.name}</h3>
                  <p className="mt-1 truncate text-sm font-medium text-slate-500">{t("Farm")}: {product.farm_name}</p>
                </div>
                <div 
                  className="aspect-[4/3] overflow-hidden rounded-2xl bg-slate-100"
                  onClick={() => { setSelectedProduct(product); setShowPreview(true); }}
                >
                  {product.image_url ? (
                    <img 
                      src={product.image_url.startsWith('http') ? product.image_url : `http://localhost:5000${product.image_url}`} 
                      alt={product.name} 
                      className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400 bg-slate-100">{t("No Image")}</div>
                  )}
                </div>
                <div className="mt-5 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t("Available")}</p>
                    <p className="text-sm font-bold text-slate-800">{product.available_quantity} {product.unit}</p>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setSelectedProduct(product); setShowPreview(true); }} 
                    className="rounded-2xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
                  >
                    {t("Preview")}
                  </button>
                </div>
            </article>
          )))}
        </div>

        <div className="space-y-6">
          {showPreview && selectedProduct && (
          <Card title={t("Product details")} subtitle={t("Preview selected product details")} variant="light" className="!aspect-auto !rounded-3xl !border-emerald-100 !bg-white/90 !text-slate-900 !shadow-[0_14px_35px_rgba(2,6,23,0.06)]">
              <div className="rounded-3xl border border-emerald-100 bg-emerald-50/60 p-4">
                {selectedProduct.image_url && (
                   <img 
                      src={selectedProduct.image_url.startsWith('http') ? selectedProduct.image_url : `http://localhost:5000${selectedProduct.image_url}`} 
                      alt={selectedProduct.name} 
                      className="h-32 w-full object-cover rounded-2xl mb-4" 
                    />
                )}
                <p className="text-lg font-black text-slate-900">{selectedProduct.name}</p>
                <p className="mt-2 text-sm text-slate-600">{selectedProduct.description || t('No description available for this product.')}</p>
                <div className="mt-4 flex flex-col gap-1 text-sm text-slate-500">
                   <p><strong>{t("Farm")}:</strong> {selectedProduct.farm_name}</p>
                   <p><strong>{t("Category")}:</strong> {t(selectedProduct.category)}</p>
                   <p><strong>{t("Available")}:</strong> {selectedProduct.available_quantity} {selectedProduct.unit}</p>
                </div>
                <div className="mt-4 flex items-center gap-2">
                    <input 
                      type="number" 
                      min="1" 
                      max={selectedProduct.available_quantity} 
                      value={quantities[selectedProduct.id] || 1} 
                      onChange={(e) => handleQuantityChange(selectedProduct.id, e.target.value)} 
                      className="w-20 h-11 px-3 text-sm rounded-2xl border border-slate-200 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-slate-800"
                    />
                    <button onClick={() => handleAddToCart(selectedProduct)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"><FiShoppingCart /> {t("Add to cart")}</button>
                </div>
                <button onClick={() => setShowPreview(false)} className="mt-4 w-full text-sm font-semibold text-slate-500 hover:text-slate-700">{t("Close preview")}</button>
              </div>
            </Card>
          )}
          <Card title={t("QR code verification")} subtitle={t("Batch traceability")} variant="light" className="!aspect-auto !rounded-3xl !border-emerald-100 !bg-white/90 !text-slate-900 !shadow-[0_14px_35px_rgba(2,6,23,0.06)]">
            <div className="grid place-items-center rounded-3xl border-2 border-dashed border-emerald-200 bg-emerald-50/80 p-10">
              <FiGrid className="text-6xl text-emerald-600" />
              <p className="mt-3 max-w-sm text-center text-sm font-medium leading-6 text-slate-600">{t("Verify produce origin, batch details, and storage conditions before purchase.")}</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
    </div>
  );
}
