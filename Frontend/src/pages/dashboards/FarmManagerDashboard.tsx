// Farm Manager Dashboard – extracted from DashboardPage.tsx
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { SectionHeading } from '../../components/ui/SectionHeading';
import { ChartPanel } from '../../components/ui/ChartPanel';
import { FiCheckCircle, FiUsers, FiAlertTriangle, FiActivity } from 'react-icons/fi';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { chartSeries } from '../../data/mock';
import { useState, useEffect } from 'react';

type OverviewStats = {
  totalFields: number;
  activeFields: number;
  farmers: number;
  customers: number;
  products: number;
  orders: number;
  livestock: {
    total: number;
    healthy: number;
    feedingDue: number;
  };
};

const emptyOverview: OverviewStats = {
  totalFields: 0,
  activeFields: 0,
  farmers: 0,
  customers: 0,
  products: 0,
  orders: 0,
  livestock: {
    total: 0,
    healthy: 0,
    feedingDue: 0,
  },
};

const API_BASE_URL = 'http://localhost:5000';

export default function FarmManagerDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [overview, setOverview] = useState<OverviewStats>(emptyOverview);
  const [tasks, setTasks] = useState<any[]>([]);
  const [recentUpdates, setRecentUpdates] = useState<any[]>([]);
  const [crops, setCrops] = useState<any[]>([]);
  const [livestock, setLivestock] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [overviewRes, tasksRes, obsRes, cropsRes, livestockRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/dashboard/overview`),
          fetch(`${API_BASE_URL}/api/tasks/manager`, { headers: getAuthHeaders() }),
          fetch(`${API_BASE_URL}/api/crop-observations/recent`, { headers: getAuthHeaders() }),
          fetch(`${API_BASE_URL}/api/crops`, { headers: getAuthHeaders() }),
          fetch(`${API_BASE_URL}/api/livestock`, { headers: getAuthHeaders() }),
        ]);

        if (overviewRes.ok) {
          setOverview(await overviewRes.json());
        } else {
          console.error('Overview request failed:', overviewRes.status, await overviewRes.text());
        }

        if (tasksRes.ok) setTasks(await tasksRes.json());
        if (obsRes.ok) setRecentUpdates(await obsRes.json());
        if (cropsRes.ok) setCrops(await cropsRes.json());
        if (livestockRes.ok) setLivestock(await livestockRes.json());
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      }
    };

    fetchData();
  }, []);

  return (
    <>
      <SectionHeading eyebrow={t("Dashboard")} title={t("Farm Manager Overview")} description={t("Operations, workforce, and analytics for your farm.")} tone="light" />
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-5">
        <StatTile label={t('Total Fields')} value={formatCount(overview.totalFields)} />
        <StatTile label={t('Farmers')} value={formatCount(overview.farmers)} />
        <StatTile label={t('Customers')} value={formatCount(overview.customers)} />
        <StatTile label={t('Products')} value={formatCount(overview.products)} />
        <StatTile label={t('Orders')} value={formatCount(overview.orders)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr] mt-6">
        <Card title={t("Crop Overview")} subtitle={t("Field health and growth progress")}>
          <div className="space-y-5">
            <ProgressBar value={overview.totalFields > 0 ? Math.min(100, Math.max(20, overview.totalFields * 10)) : 0} label={t("Registered Fields")} />
            <ProgressBar value={crops.length > 0 ? Math.min(100, Math.max(20, crops.length * 15)) : 0} label={t("Active Crops")} />
            <ProgressBar value={recentUpdates.length > 0 ? Math.min(100, Math.max(20, recentUpdates.length * 12)) : 0} label={t("Recent Updates")} />
          </div>
        </Card>
        <Card title={t("Livestock Overview")} subtitle={t("Health, feed, and production tracking")}>
          <div className="grid gap-4 sm:grid-cols-3">
            <MiniMetric label={t("Healthy")} value={formatCount(overview.livestock.healthy)} />
            <MiniMetric label={t("Feeding due")} value={formatCount(overview.livestock.feedingDue)} />
            <MiniMetric label={t("Milk yield")} value={`${formatCount(overview.livestock.total * 10)}L`} />
          </div>
        </Card>
        <Card title={t("Task Progress Cards")} subtitle={t("Work allocation across teams")}>
          <div className="grid gap-4 md:grid-cols-2">
            {tasks.length === 0 ? <p className="text-sm text-slate-500">{t("No tasks assigned.")}</p> : tasks.map((task) => (
              <div key={task.id} className="rounded-3xl border border-white/10 p-4 bg-slate-900/50">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-200">{task.title}</p>
                  <span className="text-xs text-slate-400">{task.assigned_to_name || t('Unassigned')}</span>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className={`text-xs px-2 py-1 rounded-full ${task.status === 'done' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'}`}>
                    {task.status.replace('_', ' ')}
                  </span>
                  <span className="text-xs text-slate-500">{task.due_date ? new Date(task.due_date).toLocaleDateString() : t('No due date')}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <div className="flex justify-end mb-4">
          <Button onClick={() => navigate('/dashboard/farm-manager/recent-updates')} className="flex items-center gap-2">
            {t("View Recent Farmer Updates")}
          </Button>
        </div>
        <Card title={t("Calendar View")} subtitle={t("Upcoming field events")}>
          <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-slate-500">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day) => (
              <span key={day}>{day}</span>
            ))}
            {Array.from({ length: 28 }, (_, i) => i + 1).map((date) => (
              <div key={date} className={`rounded-2xl p-2 ${date === 18 ? 'bg-emerald-600 text-white' : 'bg-slate-50 text-slate-700'}`}>
                {date}
              </div>
            ))}
          </div>
        </Card>
        <Card title={t("Farm Activity Timeline")} subtitle={t("Latest operational updates")}>
          <div className="space-y-4">
            {[
              ['08:00', 'Irrigation started in Block A'],
              ['10:15', 'Disease alert reviewed by manager'],
              ['12:30', 'Harvest batch packed for marketplace'],
              ['15:20', 'Salary approvals completed'],
            ].map(([time, text]) => (
              <div key={time} className="flex gap-4 rounded-2xl border border-slate-100 p-4">
                <span className="min-w-16 text-sm font-semibold text-emerald-700">{time}</span>
                <p className="text-sm text-slate-600">{text}</p>
              </div>
            ))}
          </div>
        </Card>
        <ChartPanel title={t("Productivity Chart")}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip />
              <Bar dataKey="productivity" fill="#16a34a" radius={[10, 10, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
      </div>
    </>
  );
}

function getAuthHeaders() {
  const tokenRaw = localStorage.getItem('token');
  const token = tokenRaw && tokenRaw.startsWith('"') ? tokenRaw.slice(1, -1) : tokenRaw;
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

function formatCount(value: number) {
  return new Intl.NumberFormat().format(value);
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Card className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/8 via-transparent to-teal-500/10" />
      <div className="relative">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
        <p className="mt-3 text-4xl font-black text-slate-950">{value}</p>
        
      </div>
    </Card>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl bg-slate-50 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">{label}</div>
      <p className="mt-2 text-2xl font-black text-slate-900">{value}</p>
    </div>
  );
}

