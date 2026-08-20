import { useEffect, useMemo, useState } from 'react';
import { Card } from '../components/ui/Card';
import { SectionHeading } from '../components/ui/SectionHeading';
import { apiFetch } from '../utils/apiFetch';

type ProductionRow = {
  id: string;
  item: string;          // species
  detail: string | null; // product type
  record_date: string | null;
  quantity: number;
  unit: string;
  price_per_unit: number;
  value: number;
  notes: string | null;
  location: string | null;
  farm_name: string | null;
  recorded_by_name: string | null;
};

const money = (value: number | null | undefined) =>
  `Rs. ${Number(value || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDate = (value: string | null) => {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleDateString();
};

export default function LivestockProductionPage({ scope = 'manager' }: { scope?: 'manager' | 'admin' }) {
  const [rows, setRows] = useState<ProductionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [product, setProduct] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  const fetchRows = async () => {
    try {
      setLoading(true);
      setError('');
      const params = new URLSearchParams({ source: 'livestock' });
      if (from) params.set('from', from);
      if (to) params.set('to', to);

      const res = await apiFetch(`/api/analytics/records?${params.toString()}`);
      if (!res.ok) throw new Error('Request failed');
      const data = await res.json();
      setRows(Array.isArray(data.rows) ? data.rows : []);
    } catch (err) {
      console.error('Failed to load livestock production', err);
      setError('Could not load livestock production records.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const productTypes = useMemo(
    () => Array.from(new Set(rows.map((row) => row.detail).filter(Boolean))) as string[],
    [rows]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (product !== 'all' && row.detail !== product) return false;
      if (!needle) return true;
      return [row.item, row.detail, row.location, row.recorded_by_name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [rows, product, search]);

  // Each product type has its own unit (litre, eggs, kg), so quantities are only
  // ever summed within a type - never across them.
  const byProduct = useMemo(() => {
    const map = new Map<string, { product: string; unit: string; quantity: number; value: number; entries: number }>();
    for (const row of visible) {
      const key = row.detail || 'Other';
      const current = map.get(key) || { product: key, unit: row.unit || 'unit', quantity: 0, value: 0, entries: 0 };
      current.quantity += Number(row.quantity || 0);
      current.value += Number(row.value || 0);
      current.entries += 1;
      map.set(key, current);
    }
    return Array.from(map.values()).sort((a, b) => b.value - a.value);
  }, [visible]);

  const bySpecies = useMemo(() => {
    const map = new Map<string, { species: string; quantity: number; unit: string; value: number; entries: number }>();
    for (const row of visible) {
      const key = row.item || 'Livestock';
      const current = map.get(key) || { species: key, quantity: 0, unit: row.unit || 'unit', value: 0, entries: 0 };
      current.quantity += Number(row.quantity || 0);
      current.value += Number(row.value || 0);
      current.entries += 1;
      map.set(key, current);
    }
    return Array.from(map.values()).sort((a, b) => b.value - a.value);
  }, [visible]);

  const totalValue = visible.reduce((sum, row) => sum + Number(row.value || 0), 0);

  const exportCsv = () => {
    const header = ['Date', 'Species', 'Product', 'Group', 'Quantity', 'Unit', 'Price per unit', 'Value', 'Recorded by', 'Notes'];
    const lines = visible.map((row) => [
      row.record_date, row.item, row.detail || '', row.location || '',
      row.quantity, row.unit, Number(row.price_per_unit || 0).toFixed(2),
      Number(row.value || 0).toFixed(2), row.recorded_by_name || 'Imported', row.notes || '',
    ]);
    const csv = [header, ...lines].map((line) => line.map((cell) => `"${String(cell ?? '')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `livestock-production-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="section-shell space-y-6 py-10">
      <SectionHeading
        eyebrow={scope === 'admin' ? 'Administration' : 'Farm Manager'}
        title="Livestock Production"
        description="Milk, eggs and meat collected from the farm's animals, as recorded by farmers."
        tone="light"
      />

      <Card title="Filter" subtitle="Narrow the collections shown below">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-500">Product</span>
            <select value={product} onChange={(e) => setProduct(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-emerald-500">
              <option value="all">All products</option>
              {productTypes.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-500">From</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-emerald-500" />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-500">To</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-emerald-500" />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-500">Search</span>
            <input type="text" value={search} placeholder="Species, group, worker" onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-emerald-500" />
          </label>
          <div className="flex items-end gap-2">
            <button onClick={() => { setProduct('all'); setFrom(''); setTo(''); setSearch(''); }}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50">
              Reset
            </button>
            <button onClick={exportCsv}
              className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800">
              Export CSV
            </button>
          </div>
        </div>
      </Card>

      {error && <Card><p className="text-rose-600">{error}</p></Card>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Collections" value={String(visible.length)} hint={`${bySpecies.length} species`} />
        <Stat label="Total value" value={money(totalValue)} tone="text-emerald-600" />
        <Stat label="Product types" value={String(byProduct.length)} hint={byProduct.map((p) => p.product).join(', ') || '—'} />
        <Stat label="Latest collection" value={formatDate(visible[0]?.record_date ?? null)}
          hint={visible[0] ? `${visible[0].item} · ${visible[0].detail || ''}` : '—'} />
      </div>

      {byProduct.length > 0 && (
        <Card title="By product" subtitle="Quantities are totalled within a product, since litres, eggs and kg cannot be added together">
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
            {byProduct.map((entry) => (
              <div key={entry.product} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-violet-700">{entry.product}</p>
                <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">
                  {entry.quantity.toLocaleString()} <span className="text-sm font-semibold text-slate-500">{entry.unit}</span>
                </p>
                <p className="mt-1 text-xs text-slate-500">{money(entry.value)} · {entry.entries} entries</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {bySpecies.length > 0 && (
        <Card title="By species" subtitle="Which animals are producing">
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
            {bySpecies.map((entry) => (
              <div key={entry.species} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-sm font-bold text-slate-900">{entry.species}</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-slate-900">
                  {entry.quantity.toLocaleString()} <span className="text-sm font-semibold text-slate-500">{entry.unit}</span>
                </p>
                <p className="mt-1 text-xs text-slate-500">{money(entry.value)} · {entry.entries} entries</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card title="All collections" subtitle="Newest first">
        {loading ? (
          <p className="text-slate-500">Loading production records...</p>
        ) : visible.length === 0 ? (
          <p className="text-slate-500">No livestock production recorded for this filter yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-100">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Species</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Group</th>
                  {scope === 'admin' && <th className="px-4 py-3">Farm</th>}
                  <th className="px-4 py-3 text-right">Quantity</th>
                  <th className="px-4 py-3 text-right">Rate</th>
                  <th className="px-4 py-3 text-right">Value</th>
                  <th className="px-4 py-3">Recorded by</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {visible.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 text-slate-600">{formatDate(row.record_date)}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{row.item}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-violet-800">
                        {row.detail || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{row.location || '—'}</td>
                    {scope === 'admin' && <td className="px-4 py-3 text-slate-600">{row.farm_name || '—'}</td>}
                    <td className="px-4 py-3 text-right tabular-nums text-slate-900">
                      {Number(row.quantity).toLocaleString()} {row.unit}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">{money(row.price_per_unit)}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-emerald-600">{money(row.value)}</td>
                    <td className="px-4 py-3 text-slate-500">{row.recorded_by_name || 'Imported'}</td>
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

function Stat({ label, value, hint, tone = 'text-slate-900' }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <Card className="border-slate-200 bg-slate-50">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-black tabular-nums ${tone}`}>{value}</p>
      {hint && <p className="mt-1 truncate text-xs text-slate-500">{hint}</p>}
    </Card>
  );
}
