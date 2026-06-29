import React, { useState } from 'react';
import type { ReactNode } from 'react';
import { FiActivity, FiClipboard, FiDroplet, FiHeart } from 'react-icons/fi';
import { Card } from '../components/ui/Card';
import { SectionHeading } from '../components/ui/SectionHeading';
import { FeedManagement } from '../components/livestock/FeedManagement';
import { HealthManagement } from '../components/livestock/HealthManagement';

const animals = [
  { name: 'Cow 201', health: 'Good', stats: 'Milk 18L/day' },
  { name: 'Cow 208', health: 'Monitor', stats: 'Feed due' },
  { name: 'Hen 51', health: 'Good', stats: 'Eggs 28/day' },
  { name: 'Goat 14', health: 'Excellent', stats: 'Weight gain 8%' },
];

export default function LivestockManagementPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'feed' | 'health'>('overview');

  return (
    <div className="section-shell py-10">
      <SectionHeading 
        eyebrow="Livestock" 
        title="Livestock management" 
        description="Manage animal records, health monitoring, feeding schedules, and production tracking in a clean dashboard." 
        tone="light" 
      />

      <div className="mb-8 flex space-x-1 rounded-xl bg-slate-100 p-1 md:w-max">
        <button
          onClick={() => setActiveTab('overview')}
          className={`rounded-lg px-6 py-2.5 text-sm font-semibold transition-all ${
            activeTab === 'overview' 
              ? 'bg-white text-slate-900 shadow-sm' 
              : 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-900'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('feed')}
          className={`rounded-lg px-6 py-2.5 text-sm font-semibold transition-all ${
            activeTab === 'feed' 
              ? 'bg-white text-slate-900 shadow-sm' 
              : 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-900'
          }`}
        >
          Feed Management
        </button>
        <button
          onClick={() => setActiveTab('health')}
          className={`rounded-lg px-6 py-2.5 text-sm font-semibold transition-all ${
            activeTab === 'health' 
              ? 'bg-white text-slate-900 shadow-sm' 
              : 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-900'
          }`}
        >
          Health & AI
        </button>
      </div>

      {activeTab === 'overview' && (
        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="grid gap-6 md:grid-cols-2">
            {animals.map((animal) => (
              <Card key={animal.name} title={animal.name} subtitle={animal.stats}>
                <div className="h-28 rounded-2xl bg-gradient-to-br from-emerald-100 via-lime-50 to-white" />
                <div className="mt-4 flex items-center justify-between text-sm">
                  <span className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-700">{animal.health}</span>
                  <span className="text-slate-500">Health monitoring</span>
                </div>
              </Card>
            ))}
          </div>
          <div className="space-y-6">
            <Card title="Feeding schedules" subtitle="Daily ration plan">
              <div className="space-y-4 text-sm text-slate-600">
                <ScheduleRow time="06:00" label="Morning feed" />
                <ScheduleRow time="12:00" label="Water refill" />
                <ScheduleRow time="16:00" label="Supplement feed" />
              </div>
            </Card>
            <Card title="Milk / Egg statistics" subtitle="Production tracking">
              <div className="grid gap-4 sm:grid-cols-2">
                <StatPill icon={<FiDroplet />} label="Milk" value="1,240L" />
                <StatPill icon={<FiClipboard />} label="Eggs" value="3,420" />
                <StatPill icon={<FiHeart />} label="Healthy" value="96%" />
                <StatPill icon={<FiActivity />} label="Alerts" value="4" />
              </div>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'feed' && (
        <div className="animate-in fade-in duration-300">
          <FeedManagement />
        </div>
      )}

      {activeTab === 'health' && (
        <div className="animate-in fade-in duration-300">
          <HealthManagement />
        </div>
      )}
    </div>
  );
}

function ScheduleRow({ time, label }: { time: string; label: string }) {
  return <div className="flex items-center justify-between rounded-2xl border border-slate-100 p-4"><span className="font-semibold text-emerald-700">{time}</span><span>{label}</span></div>;
}

function StatPill({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="rounded-3xl bg-slate-50 p-4"><div className="flex items-center gap-2 text-sm font-semibold text-slate-500">{icon}{label}</div><p className="mt-2 text-2xl font-black text-slate-900">{value}</p></div>;
}