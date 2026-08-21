import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft, FiShoppingCart, FiMinus, FiPlus, FiCheckCircle } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import { PublicHeader } from '../../components/layout/PublicHeader';
import { addToCart } from '../../api/marketplace';
import { apiFetch } from '../../utils/apiFetch';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import { isLoggedIn } from '../../utils/auth';
import { notifyError, notifySuccess } from '../../utils/notifications';

type Product = {
  id: string;
  name: string;
  product_code: string;
  category: string;
  description: string | null;
  unit: string;
  price: string | number;
  available_quantity: string | number;
  image_url: string | null;
  harvest_date: string | null;
  quality_grade: string | null;
  farm_name: string;
  farmer_name: string | null;
};

const money = (value: string | number) =>
  `Rs. ${Number(value || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDate = (value: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toLocaleDateString();
};

/**
 * Public product page, the landing point for a scanned product QR code.
 * Details are always read live from the database, so a price change shows up
 * on the next scan of the same code.
 */
export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);

  useEffect(() => {
    fetchProduct();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchProduct = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await apiFetch(`/api/marketplace/products/${id}`);
      if (res.status === 404) {
        setError(t('This product is no longer available.'));
        setProduct(null);
        return;
      }
      if (!res.ok) throw new Error('request failed');
      setProduct(await res.json());
    } catch (err) {
      console.error('Failed to load product', err);
      setError(t('Could not load this product. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const stock = Number(product?.available_quantity || 0);
  const outOfStock = stock <= 0;

  const changeQuantity = (delta: number) => {
    setQuantity((current) => Math.min(Math.max(1, current + delta), Math.max(1, stock)));
  };

  const handleAddToCart = async () => {
    if (!product) return;

    // Viewing is public; buying is not. Remember where to come back to.
    if (!isLoggedIn()) {
      sessionStorage.setItem('redirectAfterLogin', `/product/${product.id}`);
      setShowAuthPrompt(true);
      return;
    }

    try {
      setAdding(true);
      await addToCart({ product_id: product.id, quantity });
      setAdded(true);
      notifySuccess(t('Added to cart.'));
    } catch (err: any) {
      notifyError(err.response?.data?.error || t('Failed to add to cart.'));
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_22%),linear-gradient(180deg,#eff9f1_0%,#f6fbf7_100%)] text-slate-900">
      <PublicHeader active="marketplace" />

      <div className="section-shell py-8">
        <button
          onClick={() => navigate('/marketplace')}
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition-colors hover:text-emerald-700"
        >
          <FiArrowLeft /> {t('Back to marketplace')}
        </button>

        {loading ? (
          <div className="rounded-3xl border border-emerald-100 bg-white/88 py-16 text-center text-sm font-medium text-slate-500">
            {t('Loading product...')}
          </div>
        ) : error || !product ? (
          <div className="rounded-3xl border border-emerald-100 bg-white/88 py-16 text-center">
            <p className="text-sm font-semibold text-slate-700">{error}</p>
            <button
              onClick={() => navigate('/marketplace')}
              className="mt-4 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
            >
              {t('Browse the marketplace')}
            </button>
          </div>
        ) : (
          // Single column on a phone (the usual arrival from a scan), two on desktop.
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-[0_14px_35px_rgba(2,6,23,0.06)]">
              {product.image_url ? (
                <img
                  src={resolveMediaUrl(product.image_url)}
                  alt={product.name}
                  className="aspect-[4/3] w-full object-cover"
                />
              ) : (
                <div className="grid aspect-[4/3] w-full place-items-center bg-slate-100 text-slate-400">
                  {t('No Image')}
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-emerald-100 bg-white/90 p-6 shadow-[0_14px_35px_rgba(2,6,23,0.06)]">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">{t(product.category)}</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">{product.name}</h1>
              <p className="mt-1 text-sm font-medium text-slate-500">
                {t('Farm')}: {product.farm_name}
              </p>

              <div className="mt-5 flex flex-wrap items-baseline gap-3">
                <span className="text-4xl font-black text-emerald-700">{money(product.price)}</span>
                <span className="text-sm font-semibold text-slate-500">{t('per')} {product.unit}</span>
              </div>

              {product.description && (
                <p className="mt-4 text-sm leading-relaxed text-slate-600">{product.description}</p>
              )}

              <dl className="mt-6 grid gap-3 sm:grid-cols-2">
                <Detail label={t('Available')} value={outOfStock ? t('Out of stock') : `${stock} ${product.unit}`} highlight={outOfStock} />
                {product.quality_grade && <Detail label={t('Quality Grade')} value={product.quality_grade} />}
                {formatDate(product.harvest_date) && <Detail label={t('Harvest Date')} value={formatDate(product.harvest_date)!} />}
                <Detail label={t('Product code')} value={product.product_code} />
                {product.farmer_name && <Detail label={t('Farmer')} value={product.farmer_name} />}
              </dl>

              {!outOfStock && (
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <div className="flex items-center rounded-2xl border border-slate-200 bg-white">
                    <button
                      type="button"
                      onClick={() => changeQuantity(-1)}
                      disabled={quantity <= 1}
                      aria-label={t('Decrease quantity')}
                      className="grid h-12 w-12 place-items-center text-slate-500 transition-colors hover:text-emerald-700 disabled:opacity-40"
                    >
                      <FiMinus />
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={stock}
                      value={quantity}
                      onChange={(e) => setQuantity(Math.min(Math.max(1, Number(e.target.value) || 1), stock))}
                      className="h-12 w-16 border-x border-slate-200 text-center text-base font-bold text-slate-900 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => changeQuantity(1)}
                      disabled={quantity >= stock}
                      aria-label={t('Increase quantity')}
                      className="grid h-12 w-12 place-items-center text-slate-500 transition-colors hover:text-emerald-700 disabled:opacity-40"
                    >
                      <FiPlus />
                    </button>
                  </div>
                  <span className="text-sm font-semibold text-slate-500">
                    {t('Total')}: <span className="text-slate-900">{money(Number(product.price) * quantity)}</span>
                  </span>
                </div>
              )}

              <button
                onClick={handleAddToCart}
                disabled={outOfStock || adding}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-4 text-base font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FiShoppingCart />
                {outOfStock ? t('Out of stock') : adding ? t('Adding...') : t('Add to cart')}
              </button>

              {added && (
                <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-center">
                  <p className="flex items-center justify-center gap-2 text-sm font-semibold text-emerald-800">
                    <FiCheckCircle /> {t('Added to your cart.')}
                  </p>
                  <button
                    onClick={() => navigate('/dashboard/customer/cart')}
                    className="mt-3 w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
                  >
                    {t('Go to cart and checkout')}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {showAuthPrompt && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4 backdrop-blur-sm"
          onClick={() => setShowAuthPrompt(false)}
        >
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

function Detail({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className={`mt-1 text-sm font-bold ${highlight ? 'text-rose-600' : 'text-slate-900'}`}>{value}</dd>
    </div>
  );
}
