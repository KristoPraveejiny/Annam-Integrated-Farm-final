import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { ChartPanel } from '../../components/ui/ChartPanel';
import { FiUsers, FiLayers, FiAlertTriangle, FiCheckCircle, FiCloud, FiHeart } from 'react-icons/fi';
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
          title={t("Farms Overview")} 
          icon={<FiLayers className="text-emerald-600" />}
          items={[
            { label: t('Total Farms'), value: data.farms.total },
            { label: t('Active Farms'), value: data.farms.active },
            { label: t('Total Area (Acres)'), value: data.farms.total_area },
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
        <Card title={t("Quick Security Logs")} subtitle={t("Recent actions")}>
           <div className="flex items-center gap-3 rounded-2xl border border-slate-100 p-4">
              <FiAlertTriangle className="text-amber-500" />
              <div>
                <p className="text-sm font-semibold">{t("Audit logs are active")}</p>
                <p className="text-xs text-slate-500">{t("Tracking system events across")} {data.users.total} {t("users")}.</p>
              </div>
           </div>
        </Card>
      </div>
    </div>
  );
}

function StatTile({ title, items, icon }: { title: string; items: any[]; icon: React.ReactNode }) {
  return (
    <Card>
      <div className="flex items-center gap-2 font-semibold text-slate-900 mb-4 text-lg">
        {icon}
        {title}
      </div>
      <div className="space-y-3">
        {items.map(item => (
          <div key={item.label} className="flex justify-between text-sm">
            <span className="text-slate-500">{item.label}</span>
            <span className="font-bold text-slate-900">{item.value}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
