import { useEffect, useMemo, useState } from 'react';
import { Card } from '../components/ui/Card';
import { SectionHeading } from '../components/ui/SectionHeading';
import { apiFetch } from '../utils/apiFetch';

type RecordRow = {
  id: string;
  source: 'crop' | 'livestock';
  item: string;
  detail: string | null;
  record_date: string | null;
  quantity: number;
  unit: string;
  price_per_unit: number;
  value: number;
  expenses: number;
  net: number;
  notes: string | null;
  location: string | null;
  farm_name: string | null;
  recorded_by_name: string | null;
  is_perennial: boolean;
};

type Totals = {
  records: number;
  value: number;
  expenses: number;
  net: number;
  crop_records: number;
  livestock_records: number;
};

const money = (value: number | null | undefined) =>
  `Rs. ${Number(value || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDate = (value: string | null) => {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleDateString();
};

export default function ProductionRecordsPage({ scope = 'manager' }: { scope?: 'manager' | 'admin' }) {
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [byUnit, setByUnit] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [source, setSource] = useState<'all' | 'crop' | 'livestock'>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, from, to]);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      setError('');
      const params = new URLSearchParams();
      if (source !== 'all') params.set('source', source);
      if (from) params.set('from', from);
      if (to) params.set('to', to);

      const res = await apiFetch(`/api/analytics/records?${params.toString()}`);
      if (!res.ok) throw new Error('Request failed');
      const data = await res.json();
      setRows(Array.isArray(data.rows) ? data.rows : []);
      setTotals(data.totals || null);
      setByUnit(data.quantities_by_unit || {});
    } catch (err) {
      console.error('Failed to load production records', err);
      setError('Could not load production records.');
      setRows([]);
      setTotals(null);
    } finally {
      setLoading(false);
    }
  };

  const visible = useMemo(() => {
    if (!search.trim()) return rows;
    const needle = search.trim().toLowerCase();
    return rows.filter((row) =>
      [row.item, row.detail, row.location, row.recorded_by_name, row.farm_name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)));
  }, [rows, search]);

  const exportCsv = () => {
    const header = ['Date', 'Source', 'Item', 'Detail', 'Location', 'Quantity', 'Unit', 'Price per unit', 'Value', 'Expenses', 'Net', 'Recorded by'];
    const lines = visible.map((row) => [
      row.record_date, row.source, row.item, row.detail || '', row.location || '',
      row.quantity, row.unit, Number(row.price_per_unit || 0).toFixed(2),
      Number(row.value || 0).toFixed(2), Number(row.expenses || 0).toFixed(2), Number(row.net || 0).toFixed(2),
      row.recorded_by_name || 'Imported',
    ]);
    const csv = [header, ...lines].map((line) => line.map((cell) => `"${String(cell ?? '')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `production-records-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="section-shell space-y-6 py-10">
      <SectionHeading
        eyebrow={scope === 'admin' ? 'Administration' : 'Farm Manager'}
        title="Production Records"
        description="Every harvest and livestock collection ever recorded on the farm, including past amounts."
        tone="light"
      />

      <Card title="Filter" subtitle="Narrow the records shown below">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-500">Source</span>
            <select value={source} onChange={(e) => setSource(e.target.value as any)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-emerald-500">
              <option value="all">All records</option>
              <option value="crop">Crop harvests</option>
              <option value="livestock">Livestock production</option>
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
            <input type="text" value={search} placeholder="Crop, product, worker" onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-emerald-500" />
          </label>
          <div className="flex items-end gap-2">
            <button onClick={() => { setSource('all'); setFrom(''); setTo(''); setSearch(''); }}
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
        <Stat label="Total records" value={String(totals?.records ?? 0)} hint={`${totals?.crop_records ?? 0} crop · ${totals?.livestock_records ?? 0} livestock`} />
        <Stat label="Gross value" value={money(totals?.value)} hint="harvest + production value" />
        <Stat label="Expenses" value={money(totals?.expenses)} hint="recorded against harvests" tone="text-rose-600" />
        <Stat label="Net" value={money(totals?.net)} tone={(totals?.net ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'} />
      </div>

      {Object.keys(byUnit).length > 0 && (
        <Card title="Total quantity" subtitle="Grouped by unit, since kg, nuts, litres and eggs cannot be added together">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Object.entries(byUnit).map(([unit, quantity]) => (
              <div key={unit} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{unit}</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-slate-900">{Number(quantity).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card title="All records" subtitle="Newest first, including imported history">
        {loading ? (
          <p className="text-slate-500">Loading records...</p>
        ) : visible.length === 0 ? (
          <p className="text-slate-500">No records match this filter.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-100">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">Location</th>
                  {scope === 'admin' && <th className="px-4 py-3">Farm</th>}
                  <th className="px-4 py-3 text-right">Quantity</th>
                  <th className="px-4 py-3 text-right">Value</th>
                  <th className="px-4 py-3 text-right">Net</th>
                  <th className="px-4 py-3">Recorded by</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {visible.map((row) => (
                  <tr key={`${row.source}-${row.id}`} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 text-slate-600">{formatDate(row.record_date)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                        row.source === 'crop' ? 'bg-emerald-100 text-emerald-800' : 'bg-violet-100 text-violet-800'
                      }`}>
                        {row.source}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">
                        {row.item}
                        {row.is_perennial && <span className="ml-2 text-[10px] font-bold uppercase text-teal-600">perennial</span>}
                      </p>
                      {row.detail && <p className="text-xs text-slate-500">{row.detail}</p>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{row.location || '—'}</td>
                    {scope === 'admin' && <td className="px-4 py-3 text-slate-600">{row.farm_name || '—'}</td>}
                    <td className="px-4 py-3 text-right tabular-nums text-slate-900">
                      {Number(row.quantity).toLocaleString()} {row.unit}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-900">{money(row.value)}</td>
                    <td className={`px-4 py-3 text-right font-semibold tabular-nums ${Number(row.net) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {money(row.net)}
                    </td>
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
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </Card>
  );
}
