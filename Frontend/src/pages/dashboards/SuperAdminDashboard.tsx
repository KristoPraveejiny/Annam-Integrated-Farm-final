import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { ChartPanel } from '../../components/ui/ChartPanel';
import { FiUsers, FiLayers, FiAlertTriangle, FiCheckCircle, FiCloud, FiHeart, FiTrendingUp, FiMapPin, FiDatabase } from 'react-icons/fi';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { getDashboardOverview } from '../../api/admin';
import { useTranslation } from 'react-i18next';

const colors = ['#059669', '#10b981', '#34d399', '#6ee7b7'];

export default function SuperAdminDashboard() {
  const { t } = useTranslation();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const result = await getDashboardOverview();
      setData(result);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">{t("Loading dashboard...")}</div>;
  }

  if (!data) {
    return <div className="p-8 text-center text-red-500">{t("Failed to load dashboard data.")}</div>;
  }

  const userPieData = [
    { name: t('Farmers'), value: data.users.farmers },
    { name: t('Managers'), value: data.users.managers },
    { name: t('Customers'), value: data.users.customers },
    { name: t('Admins'), value: data.users.admins },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <StatTile 
          title={t("Users Overview")} 
          icon={<FiUsers className="text-emerald-600" />}
          items={[
            { label: t('Total Users'), value: data.users.total },
            { label: t('Farmers'), value: data.users.farmers },
            { label: t('Managers'), value: data.users.managers },
          ]}
        />
        <StatTile 
          title={t("Field Overview")} 
          icon={<FiMapPin className="text-emerald-600" />}
          items={[
            { label: t('Total Fields'), value: data.fields?.total ?? data.farms.total },
            { label: t('Active Fields'), value: data.fields?.active ?? data.farms.active },
            { label: t('Fields With Crops'), value: data.fields?.with_crops ?? 0 },
          ]}
        />
        <StatTile 
          title={t("Crops Overview")} 
          icon={<FiLayers className="text-emerald-600" />}
          items={[
            { label: t('Total Crops'), value: data.crops.total },
            { label: t('Growing Crops'), value: data.crops.growing },
            { label: t('Harvest Ready'), value: data.crops.harvest_ready },
          ]}
        />
        <StatTile 
          title={t("Livestock Overview")} 
          icon={<FiHeart className="text-emerald-600" />}
          items={[
            { label: t('Total Animals'), value: data.livestock.total },
            { label: t('Healthy Animals'), value: data.livestock.healthy },
            { label: t('Require Attention'), value: data.livestock.attention },
          ]}
        />
        <StatTile 
          title={t("Tasks Overview")} 
          icon={<FiCheckCircle className="text-emerald-600" />}
          items={[
            { label: t('Total Tasks'), value: data.tasks.total },
            { label: t('Completed'), value: data.tasks.completed },
            { label: t('Pending'), value: data.tasks.pending },
          ]}
        />
        <StatTile 
          title={t("AI & Advisories")} 
          icon={<FiCloud className="text-emerald-600" />}
          items={[
            { label: t('Total Queries'), value: data.ai.total },
            { label: t('Disease Detections'), value: data.ai.disease },
            { label: t('Advisories'), value: data.ai.advisory },
          ]}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartPanel title={t("User Distribution by Role")}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={userPieData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={4}>
                {userPieData.map((entry, index) => (
                  <Cell key={entry.name} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartPanel>

        {/* You can add more charts here like Farm Growth Chart, Task Completion Chart, etc */}
        <Card title={t("Field Insights")} subtitle={t("Relevant counts and activity at a glance")} variant="dark" className="border-white/10 bg-white/[0.08] backdrop-blur-2xl">
          <div className="grid gap-4 sm:grid-cols-2">
            <MiniStat label={t("Field utilization")} value={`${Math.min(100, Math.round(((data.fields?.with_crops ?? 0) / Math.max(1, data.fields?.total ?? data.farms.total)) * 100))}%`} icon={<FiTrendingUp />} />
            <MiniStat label={t("Fields with crops")} value={`${data.fields?.with_crops ?? 0}`} icon={<FiDatabase />} />
            <MiniStat label={t("Health alerts")} value="2" icon={<FiAlertTriangle />} />
            <MiniStat label={t("Verified fields")} value={`${data.fields?.active ?? data.farms.active}`} icon={<FiCheckCircle />} />
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatTile({ title, items, icon }: { title: string; items: any[]; icon: React.ReactNode }) {
  return (
    <Card variant="dark" className="relative overflow-hidden border-white/10 bg-white/[0.08] backdrop-blur-2xl">
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-teal-500/10" />
      <div className="relative">
        <div className="mb-4 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/90 text-emerald-700 shadow-sm">
            {icon}
          </div>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
        </div>
        <div className="space-y-3">
          {items.map(item => (
            <div key={item.label} className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/30 px-4 py-3">
              <span className="text-sm text-slate-300">{item.label}</span>
              <span className="text-lg font-black text-white">{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function MiniStat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-4 shadow-[0_10px_25px_rgba(2,6,23,0.12)]">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
        <span className="text-emerald-600">{icon}</span>
        {label}
      </div>
      <p className="mt-3 text-3xl font-black text-white">{value}</p>
    </div>
  );
}
