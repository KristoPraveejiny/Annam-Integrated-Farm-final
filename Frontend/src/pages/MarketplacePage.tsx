import { useEffect, useState } from 'react';
import { FiGrid, FiSearch, FiShoppingCart } from 'react-icons/fi';
import { Card } from '../components/ui/Card';
import { SectionHeading } from '../components/ui/SectionHeading';
import { getMarketplaceProducts, addToCart } from '../api/marketplace';
import { useNavigate } from 'react-router-dom';

import { PublicHeader } from '../components/layout/PublicHeader';
import { useTranslation } from 'react-i18next';
import { notifyError, notifySuccess, notifyWarning } from '../utils/notifications';
import { isLoggedIn } from '../utils/auth';
import { ProductQr } from '../components/marketplace/ProductQr';
import { resolveMediaUrl } from '../utils/mediaUrl';

const money = (value: string | number) =>
  `Rs. ${Number(value || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function MarketplacePage() {
  const { t } = useTranslation();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [quantities, setQuantities] = useState<{[key: string]: number}>({});
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [addedProductId, setAddedProductId] = useState('');
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
    // Guests get told what to do rather than a failed request.
    if (!isLoggedIn()) {
      setShowAuthPrompt(true);
      notifyWarning(t('Please login or register to add items to your cart.'));
      return;
    }

    try {
      const quantity = quantities[product.id] || 1;
      await addToCart({ product_id: product.id, quantity });
      setAddedProductId(product.id);
      notifySuccess(t('Product added to cart!'));
    } catch (err: any) {
      if (err.response?.status === 401) {
        notifyWarning(t('Please login to add to cart.'));
        navigate('/login');
      } else {
        notifyError(err.response?.data?.error || t('Failed to add to cart.'));
      }
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_22%),linear-gradient(180deg,#eff9f1_0%,#f6fbf7_100%)] text-slate-900">
      <PublicHeader active="marketplace" />
      <div className="section-shell py-12">
      <SectionHeading eyebrow={t("Marketplace")} title={t("Fresh produce marketplace")} description={t("Browse approved farm products, preview item details, and add fresh produce to your cart with a clean shopping experience.")} />

      <form onSubmit={handleSearch} className="mb-8 grid gap-4 rounded-3xl border border-emerald-100 bg-white/88 p-4 shadow-[0_14px_35px_rgba(2,6,23,0.06)] backdrop-blur lg:grid-cols-[1fr_auto]">
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
      </form>

      <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        {/* Every product stays visible while previewing - the selected one is
            highlighted rather than the rest being hidden. */}
        <div className="grid content-start gap-6 sm:grid-cols-2">
          {loading ? (
            <div className="col-span-full rounded-3xl border border-emerald-100 bg-white/88 py-12 text-center text-sm font-medium text-slate-500 shadow-[0_14px_35px_rgba(2,6,23,0.06)]">{t("Loading products...")}</div>
          ) : products.length === 0 ? (
            <div className="col-span-full rounded-3xl border border-emerald-100 bg-white/88 py-12 text-center text-sm font-medium text-slate-500 shadow-[0_14px_35px_rgba(2,6,23,0.06)]">{t("No products found.")}</div>
          ) : (
            products.map((product) => {
              const isSelected = showPreview && selectedProduct?.id === product.id;
              const openPreview = () => { setSelectedProduct(product); setShowPreview(true); };

              return (
                <article
                  key={product.id}
                  onClick={openPreview}
                  className={`flex h-full cursor-pointer flex-col overflow-hidden rounded-3xl border bg-white/90 shadow-[0_14px_35px_rgba(2,6,23,0.06)] transition hover:-translate-y-1 hover:shadow-[0_20px_45px_rgba(16,185,129,0.14)] ${
                    isSelected ? 'border-emerald-500 ring-2 ring-emerald-500/25' : 'border-emerald-100 hover:border-emerald-200'
                  }`}
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
                    {product.image_url ? (
                      <img
                        src={resolveMediaUrl(product.image_url)}
                        alt={product.name}
                        className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-slate-400">{t("No Image")}</div>
                    )}
                    <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700 shadow-sm">
                      {t(product.category)}
                    </span>
                    {Number(product.available_quantity) <= 0 && (
                      <span className="absolute right-3 top-3 rounded-full bg-rose-600 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                        {t("Out of stock")}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="line-clamp-2 text-lg font-black leading-tight tracking-tight text-slate-950">{product.name}</h3>
                      <p className="shrink-0 text-lg font-black text-emerald-700">{money(product.price)}</p>
                    </div>
                    <p className="mt-1 truncate text-sm font-medium text-slate-500">{product.farm_name}</p>

                    <div className="mt-auto flex items-center justify-between gap-3 pt-5">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t("Available")}</p>
                        <p className="text-sm font-bold text-slate-800">{product.available_quantity} {product.unit}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* The QR itself lives in the details panel; this just opens it. */}
                        <button
                          onClick={(e) => { e.stopPropagation(); openPreview(); }}
                          title={t("Show QR code")}
                          aria-label={t("Show QR code")}
                          className="grid h-11 w-11 place-items-center rounded-2xl border border-emerald-200 text-emerald-700 transition-colors hover:bg-emerald-50"
                        >
                          <FiGrid />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); openPreview(); }}
                          className="rounded-2xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
                        >
                          {t("Preview")}
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>

        <div className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          {showPreview && selectedProduct ? (
            <Card title={t("Product details")} subtitle={t("Preview selected product details")} variant="light" className="!aspect-auto !rounded-3xl !border-emerald-100 !bg-white/90 !text-slate-900 !shadow-[0_14px_35px_rgba(2,6,23,0.06)]">
              {selectedProduct.image_url && (
                <img
                  src={resolveMediaUrl(selectedProduct.image_url)}
                  alt={selectedProduct.name}
                  className="mb-4 h-40 w-full rounded-2xl object-cover"
                />
              )}

              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-600">{t(selectedProduct.category)}</p>
                  <h3 className="mt-1 text-xl font-black tracking-tight text-slate-950">{selectedProduct.name}</h3>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-2xl font-black text-emerald-700">{money(selectedProduct.price)}</p>
                  <p className="text-xs font-semibold text-slate-400">{t("per")} {selectedProduct.unit}</p>
                </div>
              </div>

              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                {selectedProduct.description || t('No description available for this product.')}
              </p>

              <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-2xl bg-slate-50 px-3 py-2">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t("Farm")}</dt>
                  <dd className="mt-0.5 truncate font-bold text-slate-800">{selectedProduct.farm_name}</dd>
                </div>
                <div className="rounded-2xl bg-slate-50 px-3 py-2">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t("Available")}</dt>
                  <dd className="mt-0.5 font-bold text-slate-800">{selectedProduct.available_quantity} {selectedProduct.unit}</dd>
                </div>
              </dl>

              <div className="mt-5 flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max={selectedProduct.available_quantity}
                  value={quantities[selectedProduct.id] || 1}
                  onChange={(e) => handleQuantityChange(selectedProduct.id, e.target.value)}
                  className="h-12 w-20 rounded-2xl border border-slate-200 px-3 text-center text-sm font-bold text-slate-800 shadow-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
                <button
                  onClick={() => handleAddToCart(selectedProduct)}
                  disabled={Number(selectedProduct.available_quantity) <= 0}
                  className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <FiShoppingCart /> {Number(selectedProduct.available_quantity) <= 0 ? t("Out of stock") : t("Add to cart")}
                </button>
              </div>

              {addedProductId === selectedProduct.id && (
                <button
                  onClick={() => navigate('/dashboard/customer/cart')}
                  className="mt-3 w-full rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
                >
                  {t("Go to cart and checkout")}
                </button>
              )}

              {/* The one and only QR for this product. */}
              <div className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
                <p className="mb-3 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">
                  {t("Product QR code")}
                </p>
                <ProductQr productId={selectedProduct.id} productName={selectedProduct.name} size={150} detailed />
                <p className="mt-3 text-center text-xs leading-relaxed text-slate-500">
                  {t("Print this code and attach it to the produce. Scanning it opens this product with today's price.")}
                </p>
              </div>

              <button
                onClick={() => setShowPreview(false)}
                className="mt-4 w-full text-sm font-semibold text-slate-500 transition-colors hover:text-slate-700"
              >
                {t("Close preview")}
              </button>
            </Card>
          ) : (
            <Card title={t("QR code verification")} subtitle={t("Batch traceability")} variant="light" className="!aspect-auto !rounded-3xl !border-emerald-100 !bg-white/90 !text-slate-900 !shadow-[0_14px_35px_rgba(2,6,23,0.06)]">
              <div className="grid place-items-center rounded-3xl border-2 border-dashed border-emerald-200 bg-emerald-50/80 p-10">
                <FiGrid className="text-6xl text-emerald-600" />
                <p className="mt-3 max-w-sm text-center text-sm font-medium leading-6 text-slate-600">{t("Verify produce origin, batch details, and storage conditions before purchase.")}</p>
                <p className="mt-2 max-w-sm text-center text-xs leading-relaxed text-slate-500">{t("Select any product to see its QR code. Scan it with your phone camera to open that product and add it to your cart.")}</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>

      {showAuthPrompt && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4 backdrop-blur-sm" onClick={() => setShowAuthPrompt(false)}>
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
              <FiShoppingCart className="text-2xl" />
            </div>
            <h3 className="mt-4 text-lg font-bold text-slate-900">{t('Sign in to continue')}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {t('You need an account to add items to your cart and place an order. It only takes a minute.')}
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <button
                onClick={() => navigate('/login')}
                className="w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
              >
                {t('Login')}
              </button>
              <button
                onClick={() => navigate('/register')}
                className="w-full rounded-2xl border border-emerald-200 px-4 py-3 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-50"
              >
                {t('Register')}
              </button>
              <button
                onClick={() => setShowAuthPrompt(false)}
                className="w-full text-sm font-semibold text-slate-500 transition-colors hover:text-slate-700"
              >
                {t('Keep browsing')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
