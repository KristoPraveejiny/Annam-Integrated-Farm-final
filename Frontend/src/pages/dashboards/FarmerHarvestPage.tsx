import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../components/ui/Card';
import { SectionHeading } from '../../components/ui/SectionHeading';
import { apiFetch } from '../../utils/apiFetch';
import { FiCalendar, FiCheckCircle, FiPackage, FiX } from 'react-icons/fi';

type Perennial = {
  id: string;
  crop_name: string;
  variety: string | null;
  field_name: string | null;
  planting_date: string | null;
  next_harvest_date: string | null;
  harvest_status: string | null;
  remaining_days: number | null;
  harvest_progress: number | null;
  harvest_type: string | null;
  harvest_frequency: number | null;
  harvest_count: number;
  last_harvest_date: string | null;
  last_price: number | null;
  total_quantity: number;
  unit: string;
  is_perennial: boolean;
  cycle_status: string | null;
};

type LivestockGroup = {
  id: string;
  species: string;
  breed: string | null;
  group_code: string | null;
  count_current: number;
  entries: number;
  last_production_date: string | null;
  last_price: number | null;
  total_quantity: number;
  default_product_type: string;
  default_unit: string;
};

type ProductionRow = {
  id: string;
  species: string | null;
  product_type: string;
  production_date: string | null;
  quantity: number;
  unit: string;
  recorded_by_name: string | null;
};

const PRODUCT_TYPES = ['Milk', 'Eggs', 'Meat', 'Manure', 'Wool', 'Other'];

type HarvestEvent = {
  id: string;
  crop_name: string;
  variety: string | null;
  harvest_date: string | null;
  quantity: number;
  unit: string;
  recorded_by_name: string | null;
  is_perennial: boolean;
};

// Local calendar day, not UTC - in Sri Lanka (+5:30) toISOString() would report
// yesterday for anything logged before 05:30.
const today = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const formatDate = (value: string | null) => {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleDateString();
};

export default function FarmerHarvestPage() {
  const { t } = useTranslation();
  const [crops, setCrops] = useState<Perennial[]>([]);
  const [recent, setRecent] = useState<HarvestEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [tab, setTab] = useState<'crops' | 'livestock'>('crops');
  const [groups, setGroups] = useState<LivestockGroup[]>([]);
  const [production, setProduction] = useState<ProductionRow[]>([]);

  const [active, setActive] = useState<Perennial | null>(null);
  // No price here on purpose - the farm manager sets prices.
  const [form, setForm] = useState({ harvest_date: today(), quantity: '', unit: 'kg', notes: '' });
  const [activeGroup, setActiveGroup] = useState<LivestockGroup | null>(null);
  const [stockForm, setStockForm] = useState({ production_date: today(), product_type: 'Milk', quantity: '', unit: 'litre', price_per_unit: '', notes: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      const [cropsRes, eventsRes, groupsRes, productionRes] = await Promise.all([
        apiFetch('/api/analytics/perennials'),
        apiFetch('/api/analytics/harvest-events'),
        apiFetch('/api/analytics/livestock-groups'),
        apiFetch('/api/analytics/livestock-production'),
      ]);
      if (!cropsRes.ok) throw new Error('Failed to load crops');
      const cropsData = await cropsRes.json();
      setCrops(Array.isArray(cropsData) ? cropsData : []);

      if (eventsRes.ok) {
        const events = await eventsRes.json();
        setRecent(Array.isArray(events) ? events.slice(0, 12) : []);
      }
      if (groupsRes.ok) {
        const groupsData = await groupsRes.json();
        setGroups(Array.isArray(groupsData) ? groupsData : []);
      }
      if (productionRes.ok) {
        const prodData = await productionRes.json();
        setProduction(Array.isArray(prodData) ? prodData.slice(0, 12) : []);
      }
    } catch (err) {
      console.error('Failed to load harvest page', err);
      setError('Could not load your records.');
    } finally {
      setLoading(false);
    }
  };

  const openLivestock = (group: LivestockGroup) => {
    setActiveGroup(group);
    setError('');
    setStockForm({
      production_date: today(),
      product_type: group.default_product_type || 'Milk',
      quantity: '',
      unit: group.default_unit || 'litre',
      price_per_unit: group.last_price ? String(group.last_price) : '',
      notes: '',
    });
  };

  const submitLivestock = async () => {
    if (!activeGroup) return;
    if (!stockForm.production_date) { setError('Pick the date this was collected.'); return; }
    if (!stockForm.quantity || Number(stockForm.quantity) <= 0) { setError('Enter how much was produced.'); return; }

    try {
      setSaving(true);
      setError('');
      const res = await apiFetch('/api/analytics/livestock-production', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          group_id: activeGroup.id,
          species: activeGroup.species,
          product_type: stockForm.product_type,
          production_date: stockForm.production_date,
          quantity: Number(stockForm.quantity),
          unit: stockForm.unit || 'litre',
          price_per_unit: Number(stockForm.price_per_unit || 0),
          notes: stockForm.notes.trim() || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Could not record the production.');
      }
      setActiveGroup(null);
      setMessage(`${activeGroup.species} ${stockForm.product_type.toLowerCase()} recorded.`);
      setTimeout(() => setMessage(''), 5000);
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Could not record the production.');
    } finally {
      setSaving(false);
    }
  };

  const openRecord = (crop: Perennial) => {
    setActive(crop);
    setError('');
    setForm({
      harvest_date: today(),
      quantity: '',
      unit: crop.unit || 'kg',
      notes: '',
    });
  };

  const submit = async () => {
    if (!active) return;
    if (!form.harvest_date) {
      setError('Pick the date the harvest happened.');
      return;
    }
    if (!form.quantity || Number(form.quantity) <= 0) {
      setError('Enter how much was harvested.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      const res = await apiFetch('/api/analytics/harvests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          crop_cycle_id: active.id,
          crop_name: active.crop_name,
          variety: active.variety,
          harvest_date: form.harvest_date,
          quantity: Number(form.quantity),
          unit: form.unit || 'kg',
          notes: form.notes.trim() || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Could not record the harvest.');
      }

      setActive(null);
      setMessage(`${active.crop_name} harvest recorded. Your manager can see it on the harvest calendar.`);
      setTimeout(() => setMessage(''), 5000);
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Could not record the harvest.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="section-shell space-y-6 py-10">
      <SectionHeading
        eyebrow={t('Farmer')}
        title={t('Record Harvest')}
        description={t('These trees keep bearing all year. Log a harvest on the day it happens and it appears on the farm manager’s harvest calendar.')}
        tone="light"
      />

      {message && (
        <Card>
          <p className="flex items-center gap-2 font-semibold text-emerald-600">
            <FiCheckCircle /> {message}
          </p>
        </Card>
      )}
      {error && !active && <Card><p className="text-rose-600">{error}</p></Card>}

      <div className="flex gap-2 rounded-2xl border border-slate-200 bg-white p-1.5">
        {(['crops', 'livestock'] as const).map((key) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
              tab === key ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            {key === 'crops' ? t('Crop harvest') : t('Livestock production')}
          </button>
        ))}
      </div>

      {tab === 'crops' && (loading ? (
        <Card><p className="text-slate-500">{t('Loading...')}</p></Card>
      ) : crops.length === 0 ? (
        <Card><p className="text-slate-500">{t('No crops ready to record yet.')}</p></Card>
      ) : (
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(320px,1fr))]">
          {crops.map((crop) => {
            const due = crop.remaining_days === 0;
            // Perennials keep bearing; a seasonal planting is a one-off harvest
            // that has not happened yet.
            const badge = crop.is_perennial
              ? (due ? { label: t('Harvest Due'), tone: 'bg-amber-100 text-amber-800' } : { label: t('Bearing'), tone: 'bg-teal-100 text-teal-800' })
              : { label: t('Upcoming'), tone: 'bg-sky-100 text-sky-800' };

            return (
              <div key={crop.id} className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-lg font-bold text-slate-900">{crop.crop_name}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {crop.variety || '—'} · {crop.field_name || t('Unassigned')}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${badge.tone}`}>
                    {badge.label}
                  </span>
                </div>

                <dl className="grid grid-cols-[minmax(6rem,8rem)_1fr] gap-x-4 gap-y-2 text-sm">
                  {crop.is_perennial ? (
                    <>
                      <dt className="text-slate-500">{t('Last picked')}</dt>
                      <dd className="font-medium text-slate-900">{formatDate(crop.last_harvest_date)}</dd>
                    </>
                  ) : (
                    <>
                      <dt className="text-slate-500">{t('Planted')}</dt>
                      <dd className="font-medium text-slate-900">{formatDate(crop.planting_date)}</dd>
                    </>
                  )}

                  <dt className="text-slate-500">{crop.is_perennial ? t('Next harvest') : t('Expected harvest')}</dt>
                  <dd className="font-medium text-slate-900">
                    {formatDate(crop.next_harvest_date)}
                    {crop.remaining_days != null && crop.remaining_days > 0 && (
                      <span className="ml-1 text-xs text-slate-500">({crop.remaining_days} {t('days')})</span>
                    )}
                  </dd>

                  {crop.is_perennial && (
                    <>
                      <dt className="text-slate-500">{t('harvests')}</dt>
                      <dd className="font-medium text-slate-900">
                        {crop.harvest_count} · {Number(crop.total_quantity || 0).toLocaleString()} {crop.unit}
                      </dd>
                    </>
                  )}
                </dl>

                <button
                  onClick={() => openRecord(crop)}
                  className="mt-auto inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-700"
                >
                  <FiPackage /> {t('Record harvest')}
                </button>
              </div>
            );
          })}
        </div>
      ))}

      {tab === 'livestock' && (loading ? (
        <Card><p className="text-slate-500">{t('Loading...')}</p></Card>
      ) : groups.length === 0 ? (
        <Card><p className="text-slate-500">{t('No livestock groups on this farm yet.')}</p></Card>
      ) : (
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(320px,1fr))]">
          {groups.map((group) => (
            <div key={group.id} className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 transition-shadow hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-lg font-bold text-slate-900">{group.species}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {[group.breed || group.group_code, `${group.count_current} ${t('animals')}`].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-violet-800">
                  {group.default_product_type}
                </span>
              </div>

              <dl className="grid grid-cols-[minmax(6rem,8rem)_1fr] gap-x-4 gap-y-2 text-sm">
                <dt className="text-slate-500">{t('Last recorded')}</dt>
                <dd className="font-medium text-slate-900">{formatDate(group.last_production_date)}</dd>

                <dt className="text-slate-500">{t('Entries')}</dt>
                <dd className="font-medium text-slate-900">
                  {group.entries} · {Number(group.total_quantity || 0).toLocaleString()} {group.default_unit}
                </dd>
              </dl>

              <button
                onClick={() => openLivestock(group)}
                className="mt-auto inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-700"
              >
                <FiPackage /> {t('Record production')}
              </button>
            </div>
          ))}
        </div>
      ))}

      {tab === 'livestock' && (
        <Card title={t('Recent production')} subtitle={t('Livestock output you recorded')}>
          {production.length === 0 ? (
            <p className="text-slate-500">{t('No production recorded yet.')}</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-100">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3">{t('Date')}</th>
                    <th className="px-4 py-3">{t('Species')}</th>
                    <th className="px-4 py-3">{t('Product')}</th>
                    <th className="px-4 py-3 text-right">{t('Quantity')}</th>
                    <th className="px-4 py-3">{t('Recorded by')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {production.map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-3 text-slate-600">{formatDate(row.production_date)}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">{row.species || '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{row.product_type}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-900">
                        {Number(row.quantity).toLocaleString()} {row.unit}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{row.recorded_by_name || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === 'crops' && (
      <Card title={t('Recent harvests')} subtitle={t('Picks recorded on this farm')}>
        {recent.length === 0 ? (
          <p className="text-slate-500">{t('No harvests recorded yet.')}</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-100">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">{t('Date')}</th>
                  <th className="px-4 py-3">{t('Crop')}</th>
                  <th className="px-4 py-3 text-right">{t('Quantity')}</th>
                  <th className="px-4 py-3">{t('Recorded by')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {recent.map((event) => (
                  <tr key={event.id}>
                    <td className="px-4 py-3 text-slate-600">{formatDate(event.harvest_date)}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{event.crop_name}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-900">
                      {Number(event.quantity).toLocaleString()} {event.unit}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{event.recorded_by_name || t('Imported')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      )}

      {active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overscroll-contain bg-slate-900/70 p-4 backdrop-blur-sm">
          <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-900/10">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{t('Record harvest')} — {active.crop_name}</h3>
                <p className="mt-0.5 text-sm text-slate-500">{active.variety || '—'} · {active.field_name || t('Unassigned')}</p>
              </div>
              <button onClick={() => setActive(null)} aria-label="Close"
                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700">
                <FiX size={20} />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-slate-500">{t('Harvest date')} *</span>
                <div className="relative">
                  <FiCalendar className="pointer-events-none absolute left-4 top-4 text-slate-400" />
                  <input
                    type="date"
                    value={form.harvest_date}
                    max={today()}
                    onChange={(e) => setForm({ ...form, harvest_date: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 py-3 pl-11 pr-4 text-slate-900 outline-none focus:border-emerald-500"
                  />
                </div>
                <span className="text-xs text-slate-400">{t('A harvest can happen on any day.')}</span>
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-slate-500">{t('Quantity')} *</span>
                  <input
                    type="number" min="0" step="0.01"
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-emerald-500"
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-slate-500">{t('Unit')}</span>
                  <input
                    type="text"
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-emerald-500"
                  />
                </label>
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-slate-500">{t('Notes')}</span>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="min-h-[72px] w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-emerald-500"
                />
              </label>

              {error && <p className="text-sm font-semibold text-rose-600">{error}</p>}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
              <button onClick={() => setActive(null)} disabled={saving}
                className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-200 disabled:opacity-50">
                {t('Cancel')}
              </button>
              <button onClick={submit} disabled={saving}
                className="rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-60">
                {saving ? t('Saving...') : t('Record harvest')}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overscroll-contain bg-slate-900/70 p-4 backdrop-blur-sm">
          <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-900/10">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{t('Record production')} — {activeGroup.species}</h3>
                <p className="mt-0.5 text-sm text-slate-500">{[activeGroup.breed || activeGroup.group_code, `${activeGroup.count_current} ${t('animals')}`].filter(Boolean).join(' · ')}</p>
              </div>
              <button onClick={() => setActiveGroup(null)} aria-label="Close"
                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700">
                <FiX size={20} />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-slate-500">{t('Date')} *</span>
                  <div className="relative">
                    <FiCalendar className="pointer-events-none absolute left-4 top-4 text-slate-400" />
                    <input type="date" value={stockForm.production_date} max={today()}
                      onChange={(e) => setStockForm({ ...stockForm, production_date: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 py-3 pl-11 pr-4 text-slate-900 outline-none focus:border-emerald-500" />
                  </div>
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-slate-500">{t('Product')} *</span>
                  <select value={stockForm.product_type}
                    onChange={(e) => setStockForm({ ...stockForm, product_type: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-emerald-500">
                    {PRODUCT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-slate-500">{t('Quantity')} *</span>
                  <input type="number" min="0" step="0.01" value={stockForm.quantity}
                    onChange={(e) => setStockForm({ ...stockForm, quantity: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-emerald-500" />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-slate-500">{t('Unit')}</span>
                  <input type="text" value={stockForm.unit}
                    onChange={(e) => setStockForm({ ...stockForm, unit: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-emerald-500" />
                </label>
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-slate-500">{t('Price per unit')} (LKR)</span>
                <input type="number" min="0" step="0.01" value={stockForm.price_per_unit}
                  onChange={(e) => setStockForm({ ...stockForm, price_per_unit: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-emerald-500" />
                {Number(stockForm.quantity || 0) * Number(stockForm.price_per_unit || 0) > 0 && (
                  <span className="text-xs text-slate-500">
                    {t('Estimated value')}: Rs. {(Number(stockForm.quantity || 0) * Number(stockForm.price_per_unit || 0)).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                )}
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-slate-500">{t('Notes')}</span>
                <textarea value={stockForm.notes}
                  onChange={(e) => setStockForm({ ...stockForm, notes: e.target.value })}
                  className="min-h-[72px] w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-emerald-500" />
              </label>

              {error && <p className="text-sm font-semibold text-rose-600">{error}</p>}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
              <button onClick={() => setActiveGroup(null)} disabled={saving}
                className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-200 disabled:opacity-50">
                {t('Cancel')}
              </button>
              <button onClick={submitLivestock} disabled={saving}
                className="rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-60">
                {saving ? t('Saving...') : t('Record production')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
