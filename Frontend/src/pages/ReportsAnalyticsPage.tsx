import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ReactNode } from 'react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { SectionHeading } from '../components/ui/SectionHeading';
import { apiFetch } from '../utils/apiFetch';

// `revenue` is always revenue after expenses; `gross_revenue` is the figure before.
type MonthPoint = { month: string; revenue: number; gross_revenue: number; expenses: number; quantity: number; batches: number };
type CropRow = {
  crop_name: string; batches: number; quantity: number; unit: string;
  revenue: number; gross_revenue: number; expenses: number; avg_price: number; margin: number;
};
type TrendPoint = { month: string; crop_name: string; avg_price: number };
type SalesPoint = { month: string; revenue: number; orders: number };

type Analytics = {
  totals: {
    batches: number;
    crops: number;
    revenue: number;
    gross_revenue: number;
    expenses: number;
    quantity: number;
    avg_price: number;
    margin: number;
    first_harvest: string | null;
    last_harvest: string | null;
    top_crop: string | null;
    currency: string;
  };
  revenue_over_time: MonthPoint[];
  by_crop: CropRow[];
  price_trends: TrendPoint[];
  marketplace_sales: SalesPoint[];
};

// One palette for every panel so the page reads as a single system.
const SERIES_COLORS = ['#16a34a', '#0891b2', '#f59e0b', '#7c3aed', '#e11d48'];
const AXIS = '#94a3b8';
const GRID = '#e2e8f0';

const currency = (value: number) =>
  `Rs. ${Number(value || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Compact form for axis ticks, where full precision would not fit.
const compact = (value: number) => {
  const amount = Number(value || 0);
  if (Math.abs(amount) >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (Math.abs(amount) >= 1_000) return `${Math.round(amount / 1_000)}k`;
  return String(Math.round(amount));
};

const monthLabel = (month: string) => {
  if (!month) return '';
  const [year, mm] = month.split('-');
  const date = new Date(Number(year), Number(mm) - 1, 1);
  if (Number.isNaN(date.getTime())) return month;
  return date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
};

export default function ReportsAnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => {
    fetchAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError('');
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const res = await apiFetch(`/api/analytics/harvest?${params.toString()}`);
      if (!res.ok) throw new Error('Request failed');
      setData(await res.json());
    } catch (err) {
      console.error('Failed to load analytics', err);
      setError('Could not load analytics for this period.');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const cropChart = useMemo(
    () => (data ? [...data.by_crop].sort((a, b) => a.revenue - b.revenue) : []),
    [data],
  );

  const exportCsv = () => {
    if (!data) return;
    const header = [
      'Crop', 'Batches', 'Quantity', 'Unit', 'Avg price per unit (LKR)',
      'Gross revenue (LKR)', 'Expenses (LKR)', 'Net revenue (LKR)', 'Margin (%)',
    ];
    const lines = data.by_crop.map((row) => [
      row.crop_name,
      row.batches,
      row.quantity,
      row.unit,
      row.avg_price.toFixed(2),
      row.gross_revenue.toFixed(2),
      row.expenses.toFixed(2),
      row.revenue.toFixed(2),
      row.margin.toFixed(1),
    ]);
    const csv = [header, ...lines].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `harvest-revenue-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const totals = data?.totals;
  const periodLabel = totals?.first_harvest && totals?.last_harvest
    ? `${monthLabel(totals.first_harvest.slice(0, 7))} – ${monthLabel(totals.last_harvest.slice(0, 7))}`
    : '';

  return (
    <div className="section-shell space-y-6 py-10">
      <SectionHeading
        eyebrow="Reports"
        title="Reports and analytics"
        description="Harvest revenue after expenses, crop performance and farmgate price trends, straight from recorded harvests."
        tone="light"
        action={
          <div className="flex gap-3">
            <Button theme="dark" variant="secondary" onClick={() => window.print()}>Export PDF</Button>
            <Button theme="dark" onClick={exportCsv}>Export CSV</Button>
          </div>
        }
      />

      <Card title="Reporting period" subtitle={periodLabel ? `Recorded harvests span ${periodLabel}` : 'Filter the harvest window'}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-500">From</span>
            <input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-emerald-500"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-500">To</span>
            <input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-emerald-500"
            />
          </label>
          <div className="flex items-end">
            <button
              onClick={() => { setFrom(''); setTo(''); }}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
            >
              All time
            </button>
          </div>
        </div>
      </Card>

      {error && (
        <Card><p className="text-rose-600">{error}</p></Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="Gross revenue" value={loading ? '—' : currency(totals?.gross_revenue ?? 0)} hint={`${totals?.batches ?? 0} harvest batches`} />
        <Stat label="Total expenses" value={loading ? '—' : currency(totals?.expenses ?? 0)} hint="seed, fertilizer, pesticide, machinery" tone="text-rose-600" />
        <Stat
          label="Net revenue"
          value={loading ? '—' : currency(totals?.revenue ?? 0)}
          hint={loading ? '' : `${Number(totals?.margin ?? 0).toFixed(1)}% margin`}
          tone={(totals?.revenue ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}
        />
        <Stat label="Total harvested" value={loading ? '—' : Number(totals?.quantity ?? 0).toLocaleString()} hint={`across ${totals?.crops ?? 0} crops`} />
        <Stat label="Most profitable crop" value={loading ? '—' : (totals?.top_crop || 'No data')} hint={data?.by_crop[0] ? currency(data.by_crop[0].revenue) : ''} />
      </div>

      <Panel
        title="Net revenue over time"
        subtitle="Revenue after expenses, by month"
        loading={loading}
        empty={!loading && (data?.revenue_over_time.length ?? 0) === 0}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data?.revenue_over_time || []} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SERIES_COLORS[0]} stopOpacity={0.35} />
                <stop offset="100%" stopColor={SERIES_COLORS[0]} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
            <XAxis dataKey="month" tickFormatter={monthLabel} stroke={AXIS} tickLine={false} axisLine={false} fontSize={12} />
            <YAxis tickFormatter={compact} stroke={AXIS} tickLine={false} axisLine={false} fontSize={12} width={52} />
            <Tooltip
              labelFormatter={(label) => monthLabel(String(label))}
              formatter={(value: number) => currency(value)}
              contentStyle={tooltipStyle}
            />
            <Legend iconType="circle" wrapperStyle={legendStyle} />
            <Area type="monotone" dataKey="revenue" name="Net revenue" stroke={SERIES_COLORS[0]} strokeWidth={2.5} fill="url(#revenueFill)" />
            <Line type="monotone" dataKey="gross_revenue" name="Gross revenue" stroke={SERIES_COLORS[1]} strokeWidth={2} dot={false} strokeDasharray="5 4" />
            <Line type="monotone" dataKey="expenses" name="Expenses" stroke={SERIES_COLORS[4]} strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel
          title="Net revenue by crop"
          subtitle="Earnings after expenses — bars below zero made a loss"
          loading={loading}
          empty={!loading && (data?.by_crop.length ?? 0) === 0}
          height="h-[420px]"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={cropChart} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
              <XAxis type="number" tickFormatter={compact} stroke={AXIS} tickLine={false} axisLine={false} fontSize={12} />
              <YAxis type="category" dataKey="crop_name" stroke={AXIS} tickLine={false} axisLine={false} fontSize={12} width={96} />
              <Tooltip
                cursor={{ fill: 'rgba(148, 163, 184, 0.12)' }}
                contentStyle={tooltipStyle}
                formatter={(value: number, _name: string, item: any) => [
                  currency(value),
                  `gross ${currency(item?.payload?.gross_revenue ?? 0)} − expenses ${currency(item?.payload?.expenses ?? 0)}`,
                ]}
              />
              <ReferenceLine x={0} stroke={AXIS} />
              <Bar dataKey="revenue" name="Net revenue" radius={[0, 8, 8, 0]} maxBarSize={22}>
                {cropChart.map((row) => (
                  <Cell key={row.crop_name} fill={row.revenue >= 0 ? SERIES_COLORS[0] : SERIES_COLORS[4]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel
          title="Quantity harvested by crop"
          subtitle="Volume behind the revenue"
          loading={loading}
          empty={!loading && (data?.by_crop.length ?? 0) === 0}
          height="h-[420px]"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={cropChart} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
              <XAxis type="number" tickFormatter={compact} stroke={AXIS} tickLine={false} axisLine={false} fontSize={12} />
              <YAxis type="category" dataKey="crop_name" stroke={AXIS} tickLine={false} axisLine={false} fontSize={12} width={96} />
              <Tooltip
                cursor={{ fill: 'rgba(148, 163, 184, 0.12)' }}
                contentStyle={tooltipStyle}
                formatter={(value: number, _name: string, item: any) => [
                  `${Number(value).toLocaleString()} ${item?.payload?.unit ?? ''}`,
                  `avg ${currency(item?.payload?.avg_price ?? 0)} per ${item?.payload?.unit ?? 'unit'}`,
                ]}
              />
              <Bar dataKey="quantity" name="Quantity" fill={SERIES_COLORS[1]} radius={[0, 8, 8, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      <Panel
        title="Marketplace sales"
        subtitle="Paid online orders by month"
        loading={loading}
        empty={!loading && (data?.marketplace_sales.length ?? 0) === 0}
        emptyMessage="No paid marketplace orders in this period."
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data?.marketplace_sales || []} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
            <XAxis dataKey="month" tickFormatter={monthLabel} stroke={AXIS} tickLine={false} axisLine={false} fontSize={12} />
            <YAxis tickFormatter={compact} stroke={AXIS} tickLine={false} axisLine={false} fontSize={12} width={52} />
            <Tooltip
              labelFormatter={(label) => monthLabel(String(label))}
              contentStyle={tooltipStyle}
              formatter={(value: number, _name: string, item: any) => [currency(value), `${item?.payload?.orders ?? 0} paid orders`]}
            />
            <Bar dataKey="revenue" name="Sales" fill={SERIES_COLORS[3]} radius={[8, 8, 0, 0]} maxBarSize={48} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>
    </div>
  );
}

const tooltipStyle = {
  borderRadius: '0.75rem',
  border: '1px solid #e2e8f0',
  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
  fontSize: '0.8125rem',
};

const legendStyle = { fontSize: '0.8125rem', paddingTop: '0.5rem' };

function Stat({ label, value, hint, tone = 'text-slate-900' }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <Card className="border-slate-200 bg-slate-50">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-black tabular-nums ${tone}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </Card>
  );
}

function Panel({
  title,
  subtitle,
  children,
  loading,
  empty,
  emptyMessage = 'No harvest data recorded for this period.',
  height = 'h-[340px]',
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  loading?: boolean;
  empty?: boolean;
  emptyMessage?: string;
  height?: string;
}) {
  return (
    <Card title={title} subtitle={subtitle}>
      <div className={`${height} w-full`}>
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">Loading chart…</div>
        ) : empty ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">{emptyMessage}</div>
        ) : (
          children
        )}
      </div>
    </Card>
  );
}
