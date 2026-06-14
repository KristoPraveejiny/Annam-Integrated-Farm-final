import type { ReactNode } from 'react';
import { FiAlertTriangle, FiCheckCircle, FiCloud, FiUsers } from 'react-icons/fi';
import { Card } from '../../components/ui/Card';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { alerts, tasks } from '../../data/mock';

function WorkerBlocks() {
  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="grid gap-6">
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

        </div>
      </div>
    </div>
  );
}

function MiniMetric({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return (
    <div className="rounded-3xl bg-slate-50 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
        {icon}{label}
      </div>
      <p className="mt-2 text-2xl font-black text-slate-900">{value}</p>
    </div>
  );
}

export default function WorkerDashboard() {
  return <WorkerBlocks />;
}
