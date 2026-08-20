import { useEffect, useMemo, useState } from 'react';
import { Card } from '../components/ui/Card';
import { SectionHeading } from '../components/ui/SectionHeading';
import { apiFetch } from '../utils/apiFetch';

type ExpenseRow = {
  id: string;
  crop_name: string;
  variety: string | null;
  harvest_date: string | null;
  quantity: number;
  unit: string;
  price_per_unit: number;
  seed_cost: number;
  fertilizer_cost: number;
  pesticide_cost: number;
  machinery_cost: number;
  other_cost: number;
  total_expenses: number;
  total_revenue: number;
  net_profit: number;
  notes: string | null;
  farm_name: string | null;
  field_name: string | null;
};

type Totals = {
  expenses: number;
  revenue: number;
  net: number;
  seed_cost: number;
  fertilizer_cost: number;
  pesticide_cost: number;
  machinery_cost: number;
  other_cost: number;
};

const COST_FIELDS = [
  { key: 'seed_cost', label: 'Seed / planting' },
  { key: 'fertilizer_cost', label: 'Fertilizer' },
  { key: 'pesticide_cost', label: 'Pesticide / herbicide' },
  { key: 'machinery_cost', label: 'Machinery / harvesting' },
  { key: 'other_cost', label: 'Other' },
] as const;

type CostKey = (typeof COST_FIELDS)[number]['key'];

const money = (value: number | null | undefined) =>
  `Rs. ${Number(value || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type CropCycle = {
  id: string;
  crop_name: string;
  variety: string | null;
  field_id: string | null;
  actual_harvest_date: string | null;
};

const emptyForm = {
  crop_cycle_id: '',
  crop_name: '',
  variety: '',
  harvest_date: '',
  quantity: '',
  unit: 'kg',
  price_per_unit: '',
  seed_cost: '',
  fertilizer_cost: '',
  pesticide_cost: '',
  machinery_cost: '',
  other_cost: '',
  notes: '',
};

export default function FarmExpensesPage({ scope = 'manager' }: { scope?: 'manager' | 'admin' }) {
  const [rows, setRows] = useState<ExpenseRow[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [crop, setCrop] = useState('All');

  const [showAdd, setShowAdd] = useState(false);
  const [cropCycles, setCropCycles] = useState<CropCycle[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<CostKey, string>>({
    seed_cost: '', fertilizer_cost: '', pesticide_cost: '', machinery_cost: '', other_cost: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchExpenses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crop]);

  useEffect(() => {
    fetchCropCycles();
  }, []);

  const fetchCropCycles = async () => {
    try {
      const res = await apiFetch('/api/crops');
      if (!res.ok) return;
      const data = await res.json();
      setCropCycles(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load crop cycles', err);
    }
  };

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      setError('');
      const params = new URLSearchParams();
      if (crop !== 'All') params.set('crop', crop);
      const res = await apiFetch(`/api/analytics/expenses?${params.toString()}`);
      if (!res.ok) throw new Error('Request failed');
      const data = await res.json();
      setRows(Array.isArray(data.rows) ? data.rows : []);
      setTotals(data.totals || null);
    } catch (err) {
      console.error('Failed to load expenses', err);
      setError('Could not load expenses.');
      setRows([]);
      setTotals(null);
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (row: ExpenseRow) => {
    setEditingId(row.id);
    setMessage('');
    setDraft({
      seed_cost: String(row.seed_cost ?? 0),
      fertilizer_cost: String(row.fertilizer_cost ?? 0),
      pesticide_cost: String(row.pesticide_cost ?? 0),
      machinery_cost: String(row.machinery_cost ?? 0),
      other_cost: String(row.other_cost ?? 0),
    });
  };

  const saveEdit = async (id: string) => {
    try {
      setSaving(true);
      const payload = Object.fromEntries(
        COST_FIELDS.map(({ key }) => [key, Number(draft[key] || 0)]),
      );
      const res = await apiFetch(`/api/analytics/expenses/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Save failed');
      }
      setEditingId(null);
      setMessage('Expenses updated.');
      setTimeout(() => setMessage(''), 3000);
      fetchExpenses();
    } catch (err: any) {
      setError(err.message || 'Could not save expenses.');
    } finally {
      setSaving(false);
    }
  };

  // Picking an existing crop cycle fills in what we already know about it.
  const selectCycle = (cycleId: string) => {
    const cycle = cropCycles.find((item) => item.id === cycleId);
    setForm((prev) => ({
      ...prev,
      crop_cycle_id: cycleId,
      crop_name: cycle ? cycle.crop_name : prev.crop_name,
      variety: cycle?.variety || '',
      harvest_date: cycle?.actual_harvest_date ? String(cycle.actual_harvest_date).slice(0, 10) : prev.harvest_date,
    }));
  };

  const createExpense = async () => {
    if (!form.crop_name.trim() || !form.harvest_date) {
      setError('Crop and harvest date are required.');
      return;
    }
    try {
      setCreating(true);
      setError('');
      const res = await apiFetch('/api/analytics/harvests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          crop_cycle_id: form.crop_cycle_id || null,
          crop_name: form.crop_name.trim(),
          variety: form.variety.trim() || null,
          harvest_date: form.harvest_date,
          quantity: Number(form.quantity || 0),
          unit: form.unit || 'kg',
          price_per_unit: Number(form.price_per_unit || 0),
          seed_cost: Number(form.seed_cost || 0),
          fertilizer_cost: Number(form.fertilizer_cost || 0),
          pesticide_cost: Number(form.pesticide_cost || 0),
          machinery_cost: Number(form.machinery_cost || 0),
          other_cost: Number(form.other_cost || 0),
          notes: form.notes.trim() || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Could not save the expense.');
      }
      setShowAdd(false);
      setForm(emptyForm);
      setMessage('Expense added.');
      setTimeout(() => setMessage(''), 3000);
      fetchExpenses();
    } catch (err: any) {
      setError(err.message || 'Could not save the expense.');
    } finally {
      setCreating(false);
    }
  };

  const newExpenseTotal = useMemo(
    () => COST_FIELDS.reduce((sum, { key }) => sum + Number(form[key] || 0), 0),
    [form],
  );

  const cropOptions = useMemo(
    () => ['All', ...Array.from(new Set(rows.map((row) => row.crop_name))).sort()],
    [rows],
  );

  const draftTotal = useMemo(
    () => COST_FIELDS.reduce((sum, { key }) => sum + Number(draft[key] || 0), 0),
    [draft],
  );

  return (
    <div className="section-shell space-y-6 py-10">
      <SectionHeading
        eyebrow={scope === 'admin' ? 'Administration' : 'Farm Manager'}
        title="Farm Expenses"
        description="Record the cost of every harvest batch. Revenue reported across the app is shown after these expenses are deducted."
        tone="light"
      />

      <Card title="Filter" subtitle="Narrow the harvest batches shown below">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <label className="w-full space-y-2 sm:max-w-xs">
            <span className="text-sm font-semibold text-slate-500">Crop</span>
            <select value={crop} onChange={(e) => setCrop(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-emerald-500">
              {cropOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <button
            onClick={() => { setShowAdd(true); setForm(emptyForm); setError(''); }}
            className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
          >
            + Add expense
          </button>
        </div>
      </Card>

      {error && <Card><p className="text-rose-600">{error}</p></Card>}
      {message && <Card><p className="font-semibold text-emerald-600">{message}</p></Card>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Gross revenue" value={money(totals?.revenue)} tone="text-slate-900" />
        <Stat label="Total expenses" value={money(totals?.expenses)} tone="text-rose-600" />
        <Stat label="Net revenue" value={money(totals?.net)} tone={(totals?.net ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'} />
        <Stat
          label="Profit margin"
          value={totals && totals.revenue ? `${((totals.net / totals.revenue) * 100).toFixed(1)}%` : '—'}
          tone={(totals?.net ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}
        />
      </div>

      <Card title="Expense breakdown" subtitle="Total spend by category across the selected batches">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {COST_FIELDS.map(({ key, label }) => (
            <div key={key} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-slate-900">{money(totals?.[key])}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Harvest batches" subtitle="Click Edit to record or correct the expenses for a batch">
        {loading ? (
          <p className="text-slate-500">Loading expenses...</p>
        ) : rows.length === 0 ? (
          <p className="text-slate-500">No harvest batches for this filter.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-100">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Crop</th>
                  <th className="px-4 py-3">Harvest date</th>
                  {scope === 'admin' && <th className="px-4 py-3">Farm</th>}
                  <th className="px-4 py-3 text-right">Gross revenue</th>
                  {COST_FIELDS.map(({ key, label }) => (
                    <th key={key} className="px-4 py-3 text-right">{label}</th>
                  ))}
                  <th className="px-4 py-3 text-right">Total expenses</th>
                  <th className="px-4 py-3 text-right">Net revenue</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {rows.map((row) => {
                  const editing = editingId === row.id;
                  const net = editing ? row.total_revenue - draftTotal : row.net_profit;

                  return (
                    <tr key={row.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">{row.crop_name}</p>
                        <p className="text-xs text-slate-500">
                          {row.variety || '—'} · {Number(row.quantity).toLocaleString()} {row.unit}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{row.harvest_date || '—'}</td>
                      {scope === 'admin' && <td className="px-4 py-3 text-slate-600">{row.farm_name || '—'}</td>}
                      <td className="px-4 py-3 text-right tabular-nums text-slate-900">{money(row.total_revenue)}</td>

                      {COST_FIELDS.map(({ key }) => (
                        <td key={key} className="px-4 py-3 text-right tabular-nums">
                          {editing ? (
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={draft[key]}
                              onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                              className="w-28 rounded-lg border border-slate-300 px-2 py-1 text-right text-slate-900 outline-none focus:border-emerald-500"
                            />
                          ) : (
                            <span className="text-slate-600">{money(row[key])}</span>
                          )}
                        </td>
                      ))}

                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-rose-600">
                        {money(editing ? draftTotal : row.total_expenses)}
                      </td>
                      <td className={`px-4 py-3 text-right font-bold tabular-nums ${net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {money(net)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {editing ? (
                          <div className="flex justify-end gap-2">
                            <button onClick={() => saveEdit(row.id)} disabled={saving}
                              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
                              {saving ? 'Saving...' : 'Save'}
                            </button>
                            <button onClick={() => setEditingId(null)}
                              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => startEdit(row)}
                            className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800">
                            Edit
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overscroll-contain bg-slate-900/70 p-4 backdrop-blur-sm">
          <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-900/10">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Add expense</h3>
                <p className="mt-0.5 text-sm text-slate-500">Record the cost of a harvest batch.</p>
              </div>
              <button
                onClick={() => setShowAdd(false)}
                aria-label="Close"
                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
              <section className="space-y-3">
                <h4 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Harvest batch</h4>
                <label className="block space-y-2">
                  <span className="text-sm text-slate-500">Existing crop cycle (optional)</span>
                  <select
                    value={form.crop_cycle_id}
                    onChange={(e) => selectCycle(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-emerald-500"
                  >
                    <option value="">Not linked — enter crop manually</option>
                    {cropCycles.map((cycle) => (
                      <option key={cycle.id} value={cycle.id}>
                        {cycle.crop_name}{cycle.variety ? ` · ${cycle.variety}` : ''}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Crop *" value={form.crop_name} onChange={(v) => setForm({ ...form, crop_name: v })} />
                  <Field label="Variety" value={form.variety} onChange={(v) => setForm({ ...form, variety: v })} />
                  <Field label="Harvest date *" type="date" value={form.harvest_date} onChange={(v) => setForm({ ...form, harvest_date: v })} />
                  <Field label="Unit" value={form.unit} onChange={(v) => setForm({ ...form, unit: v })} />
                  <Field label="Quantity harvested" type="number" value={form.quantity} onChange={(v) => setForm({ ...form, quantity: v })} />
                  <Field label="Price per unit (LKR)" type="number" value={form.price_per_unit} onChange={(v) => setForm({ ...form, price_per_unit: v })} />
                </div>
              </section>

              <section className="space-y-3">
                <h4 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Expenses</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  {COST_FIELDS.map(({ key, label }) => (
                    <Field
                      key={key}
                      label={`${label} (LKR)`}
                      type="number"
                      value={form[key]}
                      onChange={(v) => setForm({ ...form, [key]: v })}
                    />
                  ))}
                </div>
                <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                  <span className="text-sm font-semibold text-slate-500">Total expenses</span>
                  <span className="text-lg font-bold tabular-nums text-rose-600">{money(newExpenseTotal)}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                  <span className="text-sm font-semibold text-slate-500">Net revenue for this batch</span>
                  <span className={`text-lg font-bold tabular-nums ${
                    Number(form.quantity || 0) * Number(form.price_per_unit || 0) - newExpenseTotal >= 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}>
                    {money(Number(form.quantity || 0) * Number(form.price_per_unit || 0) - newExpenseTotal)}
                  </span>
                </div>
              </section>

              <label className="block space-y-2">
                <span className="text-sm text-slate-500">Notes</span>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="min-h-[72px] w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-emerald-500"
                />
              </label>

              {error && <p className="text-sm font-semibold text-rose-600">{error}</p>}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
              <button
                onClick={() => setShowAdd(false)}
                disabled={creating}
                className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={createExpense}
                disabled={creating}
                className="rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-60"
              >
                {creating ? 'Saving...' : 'Save expense'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = 'text' }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm text-slate-500">{label}</span>
      <input
        type={type}
        value={value}
        min={type === 'number' ? '0' : undefined}
        step={type === 'number' ? '0.01' : undefined}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-emerald-500"
      />
    </label>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <Card className="border-slate-200 bg-slate-50">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-black tabular-nums ${tone}`}>{value}</p>
    </Card>
  );
}
