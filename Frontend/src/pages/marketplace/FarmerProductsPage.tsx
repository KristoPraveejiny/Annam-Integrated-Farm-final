import React, { useEffect, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { getFarmerProducts, addProduct } from '../../api/marketplace';
import { useTranslation } from 'react-i18next';
import { notifyError, notifySuccess } from '../../utils/notifications';
import { apiFetch } from '../../utils/apiFetch';
import { resolveMediaUrl } from '../../utils/mediaUrl';

// A harvest or livestock collection already recorded on the farm. Picking one
// fills the listing form so the farmer never retypes what they just recorded.
type Produce = {
  id: string;
  source: 'crop' | 'livestock';
  name: string;
  detail: string | null;
  record_date: string | null;
  quantity: number;
  unit: string;
  price_per_unit: number;
  location: string | null;
  category: string;
};

const UNIT_OPTIONS = ['kg', 'g', 'litre', 'liter', 'nuts', 'eggs', 'piece', 'bunch'];

const inputClass =
  'mt-1 block w-full rounded-xl border border-white/20 bg-white px-3 py-2.5 text-slate-900 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30';

function FieldLabel({ children, required = false }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-semibold text-white/90">
      {children}
      {required && <span className="ml-1 text-emerald-300">*</span>}
    </label>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h4 className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300/90">{title}</h4>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

const EMPTY_FORM = {
  product_name: '',
  category: 'Vegetable',
  quantity: '',
  unit: 'kg',
  harvest_date: '',
  description: '',
  quality_grade: 'A',
};

const formatDate = (value: string | null) => {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toLocaleDateString();
};

export default function FarmerProductsPage() {
  const { t } = useTranslation();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [produce, setProduce] = useState<Produce[]>([]);
  const [selectedProduceId, setSelectedProduceId] = useState('');

  const selectedProduce = produce.find((item) => item.id === selectedProduceId) || null;

  useEffect(() => {
    fetchProducts();
    fetchProduce();
  }, []);

  const fetchProduce = async () => {
    try {
      const res = await apiFetch('/api/analytics/recent-produce?limit=40');
      if (!res.ok) return;
      const data = await res.json();
      setProduce(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load recent harvests', err);
    }
  };

  // Selecting a recorded harvest carries its quantity, unit and date across.
  // Every field stays editable afterwards - the farmer may list only part of a batch.
  const handleProduceSelect = (id: string) => {
    setSelectedProduceId(id);
    if (!id) {
      setFormData({ ...EMPTY_FORM });
      return;
    }
    const picked = produce.find((item) => item.id === id);
    if (!picked) return;
    setFormData((prev) => ({
      ...prev,
      product_name: picked.name,
      category: picked.category || prev.category,
      quantity: String(picked.quantity ?? ''),
      unit: picked.unit || prev.unit,
      harvest_date: picked.record_date || '',
    }));
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const data = await getFarmerProducts();
      setProducts(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load products.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const formDataToSend = new FormData();
      Object.keys(formData).forEach(key => {
        formDataToSend.append(key, (formData as any)[key]);
      });
      if (imageFile) {
        formDataToSend.append('image', imageFile);
      }

      await addProduct(formDataToSend);
      setIsAdding(false);
      setImageFile(null);
      setFormData({ ...EMPTY_FORM });
      setSelectedProduceId('');
      fetchProducts();
      notifySuccess('Product added successfully.');
    } catch (err: any) {
      notifyError(err.response?.data?.error || 'Failed to add product.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">{t("My Products")}</h1>
        <Button onClick={() => setIsAdding(!isAdding)}>{isAdding ? t('Cancel') : t('Add Product')}</Button>
      </div>

      {isAdding && (
        <Card title={t("Add New Product")} subtitle={t("Pick a recorded harvest to fill the form, or enter the details yourself")}>
          <form onSubmit={handleSubmit} className="space-y-6">
            <FormSection title={t("What are you selling?")}>
              <div className="md:col-span-2">
                <FieldLabel>{t("Product Name")}</FieldLabel>
                <select
                  value={selectedProduceId}
                  onChange={(e) => handleProduceSelect(e.target.value)}
                  className={inputClass}
                >
                  <option value="">{t("Enter manually")}</option>
                  {produce.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                      {item.detail ? ` (${item.detail})` : ''} — {item.quantity} {item.unit} · {formatDate(item.record_date)}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-white/60">
                  {produce.length === 0
                    ? t("No harvests recorded yet — type the product name below.")
                    : t("Choosing a harvest fills in the quantity and harvest date automatically.")}
                </p>
              </div>

              {!selectedProduce && (
                <div className="md:col-span-2">
                  <FieldLabel required>{t("Product Name")}</FieldLabel>
                  <input required type="text" name="product_name" value={formData.product_name}
                    onChange={handleInputChange} placeholder={t("e.g. Tomato")} className={inputClass} />
                </div>
              )}

              {selectedProduce && (
                <div className="md:col-span-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3">
                  <p className="text-sm font-semibold text-white">{selectedProduce.name}</p>
                  <p className="mt-0.5 text-xs text-white/70">
                    {selectedProduce.source === 'crop' ? t('Harvested') : t('Collected')} {formatDate(selectedProduce.record_date)}
                    {selectedProduce.location ? ` · ${selectedProduce.location}` : ''}
                    {` · ${selectedProduce.quantity} ${selectedProduce.unit} ${t('recorded')}`}
                  </p>
                </div>
              )}

              <div>
                <FieldLabel>{t("Category")}</FieldLabel>
                <select name="category" value={formData.category} onChange={handleInputChange} className={inputClass}>
                  <option value="Vegetable">{t("Vegetable")}</option>
                  <option value="Fruit">{t("Fruit")}</option>
                  <option value="Dairy">{t("Dairy")}</option>
                  <option value="Grain">{t("Grain")}</option>
                  <option value="Meat">{t("Meat")}</option>
                  <option value="Other">{t("Other")}</option>
                </select>
              </div>
              <div>
                <FieldLabel>{t("Quality Grade")}</FieldLabel>
                <select name="quality_grade" value={formData.quality_grade} onChange={handleInputChange} className={inputClass}>
                  <option value="A">{t("A - Premium")}</option>
                  <option value="B">{t("B - Standard")}</option>
                  <option value="C">{t("C - Processing")}</option>
                </select>
              </div>
            </FormSection>

            <FormSection title={t("Quantity and harvest")}>
              <div>
                <FieldLabel required>{t("Quantity")}</FieldLabel>
                <input required type="number" min="0" step="any" name="quantity" value={formData.quantity}
                  onChange={handleInputChange} className={inputClass} />
                {selectedProduce && Number(formData.quantity) > selectedProduce.quantity && (
                  <p className="mt-1.5 text-xs font-semibold text-amber-300">
                    {t("More than the")} {selectedProduce.quantity} {selectedProduce.unit} {t("recorded for this harvest.")}
                  </p>
                )}
              </div>
              <div>
                <FieldLabel>{t("Unit")}</FieldLabel>
                <select name="unit" value={formData.unit} onChange={handleInputChange} className={inputClass}>
                  {Array.from(new Set([formData.unit, ...UNIT_OPTIONS])).filter(Boolean).map((unit) => (
                    <option key={unit} value={unit}>{t(unit)}</option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel>{t("Harvest Date")}</FieldLabel>
                <input type="date" name="harvest_date" value={formData.harvest_date}
                  onChange={handleInputChange} className={inputClass} />
              </div>
            </FormSection>

            <FormSection title={t("Presentation")}>
              <div className="md:col-span-2">
                <FieldLabel>{t("Product Image")}</FieldLabel>
                <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                  className="mt-1 block w-full text-sm text-white/80 file:mr-4 file:rounded-full file:border-0 file:bg-emerald-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-emerald-700 hover:file:bg-emerald-100" />
                {imageFile && <p className="mt-1.5 text-xs text-white/60">{imageFile.name}</p>}
              </div>
              <div className="md:col-span-2">
                <FieldLabel>{t("Description")}</FieldLabel>
                <textarea name="description" value={formData.description} onChange={handleInputChange} rows={3}
                  placeholder={t("Freshness, grading, packaging or anything a buyer should know")}
                  className={inputClass}></textarea>
              </div>
            </FormSection>

            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-white/10 pt-5">
              <p className="mr-auto text-xs text-white/60">{t("A farm manager reviews and prices every listing before it goes live.")}</p>
              <Button type="button" variant="secondary" onClick={() => { setIsAdding(false); setFormData({ ...EMPTY_FORM }); setSelectedProduceId(''); }}>
                {t("Cancel")}
              </Button>
              <Button type="submit" disabled={submitting}>{submitting ? t("Submitting...") : t("Submit Product")}</Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        {loading ? (
          <p className="p-4 text-gray-500">{t("Loading products...")}</p>
        ) : error ? (
          <p className="p-4 text-red-500">{error}</p>
        ) : products.length === 0 ? (
          <p className="p-4 text-gray-500">{t("You haven't added any products yet.")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t("Product")}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t("Category")}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t("Quantity")}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t("Price")}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t("Status")}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t("Remarks")}</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {products.map((p) => (
                  <tr key={p.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {p.image_url && <img src={resolveMediaUrl(p.image_url)} alt="" className="w-10 h-10 rounded-full mr-3 object-cover" />}
                        <div>
                          <div className="text-sm font-medium text-gray-900">{p.name}</div>
                          <div className="text-xs text-gray-500">{t("Code:")} {p.product_code}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{t(p.category)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{p.available_quantity} {t(p.unit)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{p.price > 0 ? `Rs. ${p.price}` : t('Pending')}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full capitalize ${
                        p.status === 'approved' ? 'bg-green-100 text-green-800' :
                        p.status === 'rejected' ? 'bg-red-100 text-red-800' :
                        p.status === 'out_of_stock' ? 'bg-gray-100 text-gray-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {t(p.status.replace('_', ' '))}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 truncate max-w-xs">{p.approval_remarks || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
