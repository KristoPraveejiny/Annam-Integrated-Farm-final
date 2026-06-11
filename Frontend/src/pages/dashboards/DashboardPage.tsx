import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { FiActivity, FiAlertTriangle, FiCalendar, FiCheckCircle, FiCloud, FiCpu, FiDatabase, FiDollarSign, FiGrid, FiShield, FiShoppingBag, FiUsers } from 'react-icons/fi';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card } from '../../components/ui/Card';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { SectionHeading } from '../../components/ui/SectionHeading';
import { alerts, chartSeries, marketplaceProducts, metrics, tasks } from '../../data/mock';

type DashboardInfo = {
  title: string;
  description: string;
  role: 'super-admin' | 'farm-manager' | 'farmer-worker' | 'customer' | 'guest';
};

type DashboardPageProps = {
  dashboard: DashboardInfo;
};

const pieData = [
  { name: 'Crops', value: 42 },
  { name: 'Livestock', value: 26 },
  { name: 'Marketplace', value: 18 },
  { name: 'Operations', value: 14 },
];

const colors = ['#059669', '#22c55e', '#84cc16', '#16a34a'];

export default function DashboardPage({ dashboard }: DashboardPageProps) {
  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Dashboard"
        title={dashboard.title}
        description={dashboard.description}
        tone="light"
      />

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <StatTile key={metric.label} label={metric.label} value={metric.value} delta={metric.delta} />
        ))}
      </div>

      {dashboard.role === 'super-admin' ? <SuperAdminBlocks /> : null}
      {dashboard.role === 'farm-manager' ? <FarmManagerBlocks /> : null}
      {dashboard.role === 'farmer-worker' ? <WorkerBlocks /> : null}
      {dashboard.role === 'customer' ? <CustomerBlocks /> : null}
      {dashboard.role === 'guest' ? <GuestBlocks /> : null}
    </div>
  );
}

function StatTile({ label, value, delta }: { label: string; value: string; delta: string }) {
  return (
    <Card>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-black text-slate-900">{value}</p>
      <p className="mt-2 text-sm font-semibold text-emerald-600">{delta}</p>
    </Card>
  );
}

function ChartPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card title={title}>
      <div className="h-72">{children}</div>
    </Card>
  );
}

function SuperAdminBlocks() {
  return (
    <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
      <ChartPanel title="System Analytics">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartSeries}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="month" stroke="#64748b" />
            <YAxis stroke="#64748b" />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="revenue" stroke="#059669" strokeWidth={3} dot={{ r: 4 }} />
            <Line type="monotone" dataKey="productivity" stroke="#84cc16" strokeWidth={3} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartPanel>

      <Card title="Security Logs" subtitle="Recent events and configuration status">
        <div className="space-y-4">
          {[
            ['2FA enabled for 32 users', 'System'],
            ['QR configuration synced', 'Security'],
            ['Weather API key refreshed', 'Integration'],
            ['Exported monthly reports', 'Reports'],
          ].map(([text, group]) => (
            <div key={text} className="flex items-start gap-3 rounded-2xl border border-slate-100 p-3">
              <FiShield className="mt-1 text-emerald-600" />
              <div>
                <p className="text-sm font-semibold text-slate-900">{text}</p>
                <p className="text-xs text-slate-500">{group}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="User Management" subtitle="Admins, managers, workers, and customers">
        <div className="overflow-hidden rounded-2xl border border-slate-100">
          <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">User</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {[
                ['Ananya', 'Super Admin', 'Active'],
                ['Ramesh', 'Farm Manager', 'Active'],
                ['Kiran', 'Worker', 'Pending'],
                ['Sita', 'Customer', 'Active'],
              ].map(([user, role, status]) => (
                <tr key={user}>
                  <td className="px-4 py-3 font-medium text-slate-900">{user}</td>
                  <td className="px-4 py-3 text-slate-600">{role}</td>
                  <td className="px-4 py-3"><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">{status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="AI & Weather Configuration" subtitle="API settings, thresholds, and smart alerts">
        <div className="grid gap-4 sm:grid-cols-2">
          <ConfigCard title="Weather API" icon={<FiCloud />} value="Enabled" />
          <ConfigCard title="AI Models" icon={<FiCpu />} value="Live" />
          <ConfigCard title="QR Sync" icon={<FiGrid />} value="Configured" />
          <ConfigCard title="Notifications" icon={<FiAlertTriangle />} value="92 rules" />
        </div>
      </Card>

      <ChartPanel title="Role Distribution">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={90} paddingAngle={4}>
              {pieData.map((entry, index) => (
                <Cell key={entry.name} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </ChartPanel>
    </div>
  );
}

function FarmManagerBlocks() {
  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="grid gap-6">
        <Card title="Crop Overview" subtitle="Field health and growth progress">
          <div className="space-y-5">
            <ProgressBar value={82} label="Rice block" />
            <ProgressBar value={68} label="Vegetable block" />
            <ProgressBar value={91} label="Fruit orchard" />
          </div>
        </Card>
        <Card title="Livestock Overview" subtitle="Health, feed, and production tracking">
          <div className="grid gap-4 sm:grid-cols-3">
            <MiniMetric label="Healthy" value="126" />
            <MiniMetric label="Feeding due" value="18" />
            <MiniMetric label="Milk yield" value="1,240L" />
          </div>
        </Card>
        <Card title="Task Progress Cards" subtitle="Work allocation across teams">
          <div className="grid gap-4 md:grid-cols-2">
            {tasks.map((task) => (
              <div key={task.title} className="rounded-3xl border border-slate-100 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-900">{task.title}</p>
                  <span className="text-xs text-slate-500">{task.assignee}</span>
                </div>
                <div className="mt-3"><ProgressBar value={task.progress} /></div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-6">
        <Card title="Calendar View" subtitle="Upcoming field events">
          <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-slate-500">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day) => <span key={day}>{day}</span>)}
            {Array.from({ length: 28 }, (_, index) => index + 1).map((date) => (
              <div key={date} className={`rounded-2xl p-2 ${date === 18 ? 'bg-emerald-600 text-white' : 'bg-slate-50 text-slate-700'}`}>{date}</div>
            ))}
          </div>
        </Card>
        <Card title="Farm Activity Timeline" subtitle="Latest operational updates">
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
        <ChartPanel title="Productivity Chart">
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
    </div>
  );
}

function WorkerBlocks() {
  const [livestock, setLivestock] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);

  // Fetch livestock data
  const fetchLivestock = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/livestock');
      if (!response.ok) {
        throw new Error('Failed to fetch livestock');
      }
      const data = await response.json();
      setLivestock(data);
    } catch (error) {
      console.error(error);
    }
  };

  // Fetch groups for pen information
  const fetchGroups = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/groups');
      if (!response.ok) {
        throw new Error('Failed to fetch groups');
      }
      const data = await response.json();
      setGroups(data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchLivestock();
    fetchGroups();
  }, []);

  // Helper to get group name by pen ID
  const getGroupName = (penId: any) => {
    if (!penId) return 'Unknown';
    const group = groups.find((g: any) => g.id === penId || g.group_code === penId);
    return group ? group.name || group.group_code : 'Unknown';
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <Card title="Daily Tasks" subtitle="Mobile-friendly task management">
        <div className="space-y-4">
          {tasks.slice(0, 3).map((task) => (
            <div key={task.title} className="rounded-3xl border border-slate-100 p-4">
              <div className="flex items-center justify-between text-sm">
                <p className="font-semibold text-slate-900">{task.title}</p>
                <span className="text-slate-500">{task.assignee}</span>
              </div>
              <div className="mt-3"><ProgressBar value={task.progress} /></div>
            </div>
          ))}
        </div>
      </Card>
      <div className="grid gap-6">
        <Card title="Attendance Marking" subtitle="Daily check-in status">
          <div className="grid gap-3 sm:grid-cols-2">
            <MiniMetric label="Checked in" value="42" icon={<FiCheckCircle />} />
            <MiniMetric label="Absent" value="5" icon={<FiUsers />} />
            <MiniMetric label="Late" value="3" icon={<FiAlertTriangle />} />
            <MiniMetric label="Weather" value="Clear" icon={<FiCloud />} />
          </div>
        </Card>
        <Card title="Livestock Overview" subtitle="All livestock details (read‑only)">
          <div className="w-full overflow-x-auto">
            <table className="w-full table-auto border-collapse">
              <thead className="bg-slate-200 text-left">
                <tr>
                  <th className="px-4 py-2">Tag</th>
                  <th className="px-4 py-2">Group</th>
                  <th className="px-4 py-2">Age</th>
                  <th className="px-4 py-2">Gender</th>
                  <th className="px-4 py-2">Health</th>
                  <th className="px-4 py-2">Created At</th>
                  <th className="px-4 py-2">Updated At</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {livestock.map((l: any) => (
                  <tr key={l.id} className="border-b border-slate-200">
                    <td className="px-4 py-2">{l.tag}</td>
                    <td className="px-4 py-2">{getGroupName(l.pen)}</td>
                    <td className="px-4 py-2">{l.age}</td>
                    <td className="px-4 py-2">{l.gender}</td>
                    <td className="px-4 py-2">{l.health_status}</td>
                    <td className="px-4 py-2 text-sm text-slate-500">
                      {l.createdAt ? new Date(l.createdAt).toLocaleDateString() : ''}
                    </td>
                    <td className="px-4 py-2 text-sm text-slate-500">
                      {l.updatedAt ? new Date(l.updatedAt).toLocaleDateString() : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="Notifications" subtitle="Weather and task reminders">
          <div className="space-y-3">
            {alerts.slice(0, 3).map((alert) => (
              <div key={alert.title} className="rounded-2xl border border-slate-100 p-4">
                <p className="font-semibold text-slate-900">{alert.title}</p>
                <p className="mt-1 text-sm text-slate-600">{alert.description}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}


function CustomerBlocks() {
  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <Card title="Product Browsing" subtitle="Premium ecommerce-style product discovery">
        <div className="grid gap-4 md:grid-cols-2">
          {marketplaceProducts.slice(0, 4).map((product) => (
            <div key={product.name} className="rounded-3xl border border-slate-100 p-4">
              <div className="h-36 rounded-2xl bg-gradient-to-br from-emerald-100 via-lime-50 to-white" />
              <p className="mt-3 font-semibold text-slate-900">{product.name}</p>
              <p className="text-sm text-slate-500">{product.category}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-emerald-700">{product.price}</span>
                <span className="text-sm text-slate-500">{product.rating} ★</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
      <div className="grid gap-6">
        <Card title="Order Tracking" subtitle="Live order status">
          <div className="space-y-4">
            <ProgressBar value={78} label="Order packed" />
            <ProgressBar value={54} label="Out for delivery" />
            <ProgressBar value={96} label="Payment verified" />
          </div>
        </Card>
        <Card title="QR Verification" subtitle="Traceability and authenticity">
          <div className="grid place-items-center rounded-3xl border-2 border-dashed border-emerald-200 bg-emerald-50 p-8">
            <FiGrid className="text-5xl text-emerald-600" />
            <p className="mt-3 text-center text-sm text-slate-600">Scan product QR to confirm source, batch, and freshness.</p>
          </div>
        </Card>
      </div>
    </div>
  );
}

function GuestBlocks() {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card title="Platform Preview" subtitle="A quick look at the experience">Guest users can browse featured products, view AI advisories, and navigate to login or registration.</Card>
      <Card title="Smart Agriculture" subtitle="Premium SaaS-style branding">Modern visuals, soft shadows, and responsive layouts designed for enterprise-grade trust.</Card>
      <Card title="Quick Actions" subtitle="Try the main flows"><div className="space-y-3 text-sm text-slate-600"><p>Login to access dashboards</p><p>Browse marketplace items</p><p>Explore AI recommendations</p></div></Card>
    </div>
  );
}

function ConfigCard({ title, value, icon }: { title: string; value: string; icon: ReactNode }) {
  return (
    <div className="rounded-3xl border border-slate-100 p-4">
      <div className="flex items-center gap-3 text-sm font-semibold text-slate-900">{icon}{title}</div>
      <p className="mt-3 text-2xl font-black text-emerald-700">{value}</p>
    </div>
  );
}

function MiniMetric({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return (
    <div className="rounded-3xl bg-slate-50 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">{icon}{label}</div>
      <p className="mt-2 text-2xl font-black text-slate-900">{value}</p>
    </div>
  );
}