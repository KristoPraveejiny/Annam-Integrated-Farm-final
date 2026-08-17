import React, { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { apiFetch } from '../../utils/apiFetch';

export default function WorkerPerformanceAnalytics({ workerId }: { workerId: string }) {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWorkerMetrics();
  }, [workerId]);

  const fetchWorkerMetrics = async () => {
    try {
        // In a real app, this hits a performance endpoint
        // const res = await apiFetch(`/api/workers/${workerId}/performance`);
        
        // Mocked response for demo
        setMetrics({
            attendancePercentage: 95,
            taskCompletionRate: 88,
            avgCompletionTime: '4.5 hrs',
            lateSubmissions: 2,
            missedShifts: 0,
            rejectedTasks: 1,
            reworkRequests: 3,
            overallScore: 92
        });
    } catch (error) {
        console.error('Failed to fetch worker metrics:', error);
    } finally {
        setLoading(false);
    }
  };

  if (loading) return <div>Loading Analytics...</div>;

  return (
    <Card title="Performance Analytics">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <div className="bg-slate-900/50 p-4 rounded-xl border border-white/5 text-center">
             <div className="text-3xl font-bold text-emerald-400">{metrics.overallScore}</div>
             <div className="text-xs text-slate-400 uppercase tracking-wider mt-1">Overall Score</div>
          </div>
          <div className="bg-slate-900/50 p-4 rounded-xl border border-white/5 text-center">
             <div className="text-3xl font-bold text-blue-400">{metrics.attendancePercentage}%</div>
             <div className="text-xs text-slate-400 uppercase tracking-wider mt-1">Attendance</div>
          </div>
          <div className="bg-slate-900/50 p-4 rounded-xl border border-white/5 text-center">
             <div className="text-3xl font-bold text-purple-400">{metrics.taskCompletionRate}%</div>
             <div className="text-xs text-slate-400 uppercase tracking-wider mt-1">Completion Rate</div>
          </div>
          <div className="bg-slate-900/50 p-4 rounded-xl border border-white/5 text-center">
             <div className="text-3xl font-bold text-orange-400">{metrics.lateSubmissions}</div>
             <div className="text-xs text-slate-400 uppercase tracking-wider mt-1">Late Submissions</div>
          </div>
      </div>
      
      <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="text-center p-3 border border-white/5 rounded-xl">
             <div className="text-xl font-bold text-rose-500">{metrics.missedShifts}</div>
             <div className="text-xs text-slate-400">Missed Shifts</div>
          </div>
          <div className="text-center p-3 border border-white/5 rounded-xl">
             <div className="text-xl font-bold text-yellow-500">{metrics.reworkRequests}</div>
             <div className="text-xs text-slate-400">Reworks</div>
          </div>
          <div className="text-center p-3 border border-white/5 rounded-xl">
             <div className="text-xl font-bold text-red-500">{metrics.rejectedTasks}</div>
             <div className="text-xs text-slate-400">Rejected</div>
          </div>
      </div>
    </Card>
  );
}
