import { ReactNode } from 'react';

type StatCardProps = {
  title: string;
  value: string;
  delta?: string;
  icon: ReactNode;
  gradient?: string;
};

export function StatCard({ title, value, delta, icon, gradient = 'from-emerald-500 to-lime-400' }: StatCardProps) {
  return (
    <div className="farm-card relative overflow-hidden p-5">
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${gradient}`} />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-3 text-3xl font-black tracking-tight text-slate-900">{value}</p>
          {delta ? <p className="mt-2 text-sm font-semibold text-emerald-600">{delta}</p> : null}
        </div>
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-2xl text-emerald-700">
          {icon}
        </div>
      </div>
    </div>
  );
}
